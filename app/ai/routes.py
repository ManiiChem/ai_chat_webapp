from datetime import datetime, timezone
from flask import request, jsonify, current_app, Flask
from flask_login import login_required, current_user
from sqlalchemy import func
from app.extensions import db
from app.models import Conversation, Message
from app.ai import ai_bp
import boto3
import threading
from app.ai.ai_models import AI_MODELS_AVAILABLE

HISTORY_LIMIT = 20 # how many past messages get sent to the model as context
TITLE_MAX_LENGTH = 100 # matches the conversations.title column

client = boto3.client("bedrock-runtime", region_name="us-east-1")

# The only place that talks to the AI provider, so switching providers means changing just this function
def ask_model(model_id: str, messages: list, max_tokens: int, temperature: float) -> str:
    response = client.converse(
        modelId=model_id,
        messages=messages,
        inferenceConfig={"maxTokens": max_tokens, "temperature": temperature},
    )

    return response['output']['message']['content'][0]['text']

def get_title_from_prompt_and_update(app: Flask, user_id: int, conversation_id: int, prompt: str, selected_ai_model: str) -> None:
    with app.app_context():
        try:
            new_title = ask_model(
                selected_ai_model,
                [{
                    "role": "user",
                    "content": [{"text": f"Generate a short, concise conversation title (max 6 words) based on this user prompt. Do not include quotes or words like 'Title:'. Prompt: {prompt}"}]
                }],
                max_tokens=50,
                temperature=0.5
            ).strip().strip('"')[:TITLE_MAX_LENGTH]

            conversation = Conversation.query.filter_by(id=conversation_id, user_id=user_id).first()
            if conversation and new_title:
                conversation.title = new_title
                db.session.commit()

        except Exception as e:
            print("Title generation failed:", e)


@ai_bp.route("/api/sendPrompt", methods=["POST"])
@login_required
def send_receive_prompt():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return "Request must be JSON", 400

    user_prompt = str(data.get("user_prompt") or "").strip()
    conversation_id = data.get("conversation_id")
    selected_ai_model = data.get("ai_model")

    if not user_prompt:
        user_prompt = "Continue"

    conversation = None
    message_history = []

    if conversation_id:
        conversation = Conversation.query.filter_by(id=conversation_id, user_id=current_user.id).first()

        if not conversation:
            return "Conversation not found or unauthorized", 404

        # get the last 20 messages (newest first so the limit keeps the recent ones and then flipped back to oldest first)
        past_messages = Message.query.filter_by(conversation_id=conversation.id).order_by(Message.id.desc()).limit(HISTORY_LIMIT).all()

        for msg in reversed(past_messages):
            message_history.append({
                "role": msg.message_role,
                "content": [{"text": msg.content}]
            })

        selected_ai_model = conversation.ai_model # so users cant switch ai models for existing conversations
    elif selected_ai_model not in AI_MODELS_AVAILABLE.values():
        return "Unknown AI model", 400

    message_history.append({
        "role": "user",
        "content": [{"text": user_prompt}]
    })

    try:
        # call bedrock first so nothing is saved if it fails
        ai_text = ask_model(selected_ai_model, message_history, max_tokens=1024, temperature=0.7)

        is_new_conversation = conversation is None
        if is_new_conversation:
            conversation = Conversation(
                user_id=current_user.id,
                ai_model=selected_ai_model,
                title="Untitled Conversation",
                created_at=datetime.now(timezone.utc).isoformat(timespec="seconds")
            )
            db.session.add(conversation)
            db.session.flush() # assigns conversation.id without committing yet

        db.session.add(Message(
            conversation_id=conversation.id,
            message_role="user",
            content=user_prompt
        ))
        db.session.add(Message(
            conversation_id=conversation.id,
            message_role="assistant",
            content=ai_text
        ))

        db.session.commit()

    except Exception:
        db.session.rollback()
        current_app.logger.exception("sendPrompt failed")
        return "An error has occurred", 500

    if is_new_conversation:
        # using a background thread to not halt the main execution (also gave it access to flasks app context)
        app_instance = current_app._get_current_object()
        threading.Thread(
            target=get_title_from_prompt_and_update,
            args=(app_instance, current_user.id, conversation.id, user_prompt, selected_ai_model)
        ).start()

    return jsonify({
        "aiResponse": ai_text,
        "conversationId": conversation.id
    })

@ai_bp.route("/api/getConversation/<int:conversation_id>", methods=["GET"])
@login_required
def get_conversation(conversation_id):
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=current_user.id).first()

    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404

    messages = Message.query.filter_by(conversation_id=conversation.id).order_by(Message.id.asc()).all()

    return jsonify({
        "id": conversation.id,
        "conversationAiModel": conversation.ai_model,
        "messages": [
            {
                "role": msg.message_role,
                "content": msg.content
            } for msg in messages
        ]
    })

@ai_bp.route("/api/updateConversations", methods=["GET"])
@login_required
def update_conversations():
    # descending aka newest first
    user_convos = Conversation.query.filter_by(user_id=current_user.id).order_by(Conversation.id.desc()).all()

    # one COUNT query for all conversations instead of loading every message just to count them
    message_counts = dict(
        db.session.query(Message.conversation_id, func.count(Message.id))
        .join(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .group_by(Message.conversation_id)
        .all()
    )

    data = []
    for c in user_convos:
        data.append({
            "id": c.id,
            "title": c.title if c.title else "Untitled Conversation",
            "date": c.created_at or "",
            "message_count": message_counts.get(c.id, 0),
            "ai_model": c.ai_model
        })

    return jsonify(data)

@ai_bp.route("/api/deleteConversation/<int:conversation_id>", methods=["DELETE"])
@login_required
def delete_conversation(conversation_id):
    convo = Conversation.query.filter_by(id=conversation_id, user_id=current_user.id).first()

    if not convo:
        return jsonify({"error": "Conversation not found"}), 404

    try:
        db.session.delete(convo)
        db.session.commit()
        return jsonify({"success": True, "message": "Deleted successfully"}) # Keeping it for debugging in the network tab
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@ai_bp.route("/api/renameConversation", methods=["PUT"])
@login_required
def rename_conversation():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request must be JSON"}), 400

    conversation_id = data.get("conversation_id")
    new_title = str(data.get("new_title") or "").strip()

    if not new_title:
        return jsonify({"error": "Title cannot be empty"}), 400

    if len(new_title) > TITLE_MAX_LENGTH:
        return jsonify({"error": f"Title cannot be longer than {TITLE_MAX_LENGTH} characters"}), 400

    conversation = Conversation.query.filter_by(id=conversation_id, user_id=current_user.id).first()

    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404

    try:
        conversation.title = new_title
        db.session.commit()
        return jsonify({"success": True, "title": new_title})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
