from datetime import datetime, timezone
from flask import request, jsonify, current_app, Flask, Response, stream_with_context
from flask_login import login_required, current_user
from sqlalchemy import func
from app.extensions import db
from app.models import Conversation, Message
from app.ai import ai_bp
from openai import OpenAI
import json
import threading
from app.ai.ai_models import AI_MODELS_AVAILABLE, DEFAULT_AI_MODEL, TITLE_AI_MODEL

HISTORY_LIMIT = 20 # how many past messages get sent to the model as context
TITLE_MAX_LENGTH = 100 # matches the conversations.title column
MESSAGE_MAX_LENGTH = 20000 # for messages the user rewrites by hand
REPLY_MAX_TOKENS = 2048
REPLY_TEMPERATURE = 0.7

# the only place that talks to the AI provider, groq uses the same API format as OpenAI, so the openai
# package works with it and any other OpenAI compatible provider only needs a different AI_BASE_URL (opt) and AI_API_KEY
def get_ai_client() -> OpenAI:
    return OpenAI(
        api_key=current_app.config["AI_API_KEY"],
        base_url=current_app.config["AI_BASE_URL"],
        timeout=60
    )

def ask_model(model_id: str, messages: list, max_tokens: int, temperature: float) -> str:
    # max_output_tokens also counts the tokens the model spends on reasoning before it writes the answer
    response = get_ai_client().responses.create(
        model=model_id,
        input=messages,
        max_output_tokens=max_tokens,
        temperature=temperature
    )

    ai_text = response.output_text
    if not ai_text:
        raise ValueError(f"{model_id} returned an empty response")

    return ai_text

# same as ask_model but gives the answer back piece by piece while the model is still writing it
def stream_model(model_id: str, messages: list, max_tokens: int, temperature: float):
    stream = get_ai_client().responses.create(
        model=model_id,
        input=messages,
        max_output_tokens=max_tokens,
        temperature=temperature,
        stream=True
    )

    for event in stream:
        # the reasoning comes as its own event type, only the actual answer text is passed on
        if event.type == "response.output_text.delta":
            yield event.delta
        elif event.type in ("response.failed", "error"):
            raise RuntimeError(f"{model_id} failed while streaming")

def get_title_from_prompt_and_update(app: Flask, user_id: int, conversation_id: int, prompt: str) -> None:
    with app.app_context():
        try:
            new_title = ask_model(
                TITLE_AI_MODEL,
                [{
                    "role": "user",
                    "content": f"Generate a short, concise conversation title (max 6 words) based on this user prompt. Do not include quotes or words like 'Title:'. Prompt: {prompt}"
                }],
                max_tokens=500,
                temperature=0.5
            ).strip().strip('"')[:TITLE_MAX_LENGTH]

            conversation = Conversation.query.filter_by(id=conversation_id, user_id=user_id).first()
            if conversation and new_title:
                conversation.title = new_title
                db.session.commit()

        except Exception as e:
            print("Title generation failed:", e)

def stream_event(event: dict) -> str:
    return json.dumps(event) + "\n" # one json object per line

def messages_to_history(messages: list) -> list:
    return [{"role": msg.message_role, "content": msg.content} for msg in messages]

def message_json(msg: Message) -> dict:
    return {"id": msg.id, "role": msg.message_role, "content": msg.content, "edited": msg.edited}

# finds a message but only if it belongs to a conversation of the logged in user
def get_own_message(message_id: int):
    return Message.query.join(Conversation).filter(Message.id == message_id, Conversation.user_id == current_user.id).first()

# streams the models answer to the browser and only saves to the database once the whole answer arrived,
# so a failed request never leaves anything half saved. conversation_id is None for a brand new chat and
# replaced_message_id is the old answer when regenerating
def stream_reply(conversation_id, selected_ai_model: str, message_history: list, user_prompt: str, replaced_message_id=None) -> Response:
    app_instance = current_app._get_current_object()
    user_id = current_user.id

    def generate():
        ai_text = ""
        client_connected = True

        try:
            for delta in stream_model(selected_ai_model, message_history, REPLY_MAX_TOKENS, REPLY_TEMPERATURE):
                ai_text += delta

                if client_connected:
                    try:
                        yield stream_event({"type": "delta", "text": delta})
                    except GeneratorExit:
                        # the browser left (refresh or closed tab), keep reading so the answer still gets saved
                        client_connected = False

            if not ai_text:
                raise ValueError(f"{selected_ai_model} returned an empty response")

            # the generator runs after the route function returned and gets a fresh db session, so the rows
            # aree looked up again here by id instead of reusing objects from the old session
            is_new_conversation = conversation_id is None
            if is_new_conversation:
                conversation = Conversation(
                    user_id=user_id,
                    ai_model=selected_ai_model,
                    title="Untitled Conversation",
                    created_at=datetime.now(timezone.utc).isoformat(timespec="seconds")
                )
                db.session.add(conversation)
                db.session.flush() # assigns conversation.id without committing yet
            else:
                conversation = Conversation.query.filter_by(id=conversation_id, user_id=user_id).one()
                conversation.ai_model = selected_ai_model # only changes anything for the old bedrock conversations

            user_message = None
            if replaced_message_id is not None:
                # the old answer only goes away now that the new one exists
                db.session.delete(Message.query.filter_by(id=replaced_message_id, conversation_id=conversation.id).one())
            else:
                user_message = Message(
                    conversation_id=conversation.id,
                    message_role="user",
                    content=user_prompt
                )
                db.session.add(user_message)

            ai_message = Message(
                conversation_id=conversation.id,
                message_role="assistant",
                content=ai_text
            )
            db.session.add(ai_message)
            db.session.commit()

        except Exception:
            db.session.rollback()
            current_app.logger.exception("streaming the reply failed")
            if client_connected:
                yield stream_event({"type": "error", "message": "An error has occurred"})
            return

        if is_new_conversation:
            # using a background thread to not halt the main execution (also gave it access to flasks app context)
            threading.Thread(
                target=get_title_from_prompt_and_update,
                args=(app_instance, user_id, conversation.id, user_prompt)
            ).start()

        if client_connected:
            yield stream_event({
                "type": "done",
                "conversationId": conversation.id,
                "messageId": ai_message.id,
                "userMessageId": user_message.id if user_message else None # the frontend needs both ids so the new messages can be edited right away
            })

    return Response(
        stream_with_context(generate()),
        mimetype="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

@ai_bp.route("/api/models", methods=["GET"])
@login_required
def get_models():
    return jsonify({
        "models": [{"name": name, "id": model_id} for name, model_id in AI_MODELS_AVAILABLE.items()],
        "default": DEFAULT_AI_MODEL
    })

@ai_bp.route("/api/sendPrompt", methods=["POST"])
@login_required
def send_receive_prompt():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request must be JSON"}), 400

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
            return jsonify({"error": "Conversation not found"}), 404

        # get the last 20 messages (newest first so the limit keeps the recent ones and then flipped back to oldest first)
        past_messages = Message.query.filter_by(conversation_id=conversation.id).order_by(Message.id.desc()).limit(HISTORY_LIMIT).all()
        message_history = messages_to_history(reversed(past_messages))

        selected_ai_model = conversation.ai_model # so users cant switch ai models for existing conversations

        # conversations from before the switch to groq still have a bedrock model id saved, those continue on the default model
        if selected_ai_model not in AI_MODELS_AVAILABLE.values():
            selected_ai_model = DEFAULT_AI_MODEL
    elif selected_ai_model not in AI_MODELS_AVAILABLE.values():
        return jsonify({"error": "Unknown AI model"}), 400

    message_history.append({
        "role": "user",
        "content": user_prompt
    })

    return stream_reply(conversation.id if conversation else None, selected_ai_model, message_history, user_prompt)

# throws away the last answer of a conversation and asks the model for a new one
@ai_bp.route("/api/regenerate/<int:conversation_id>", methods=["POST"])
@login_required
def regenerate_last_reply(conversation_id):
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=current_user.id).first()

    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404

    # newest first, the very first one is the answer being replaced
    past_messages = Message.query.filter_by(conversation_id=conversation.id).order_by(Message.id.desc()).limit(HISTORY_LIMIT).all()

    if len(past_messages) < 2 or past_messages[0].message_role != "assistant" or past_messages[1].message_role != "user":
        return jsonify({"error": "There is no answer to regenerate"}), 400

    old_answer = past_messages[0]
    last_user_message = past_messages[1]
    # without the old answer its an odd number of messages, so the history still starts and ends with a user message
    message_history = messages_to_history(reversed(past_messages[1:]))

    selected_ai_model = conversation.ai_model
    if selected_ai_model not in AI_MODELS_AVAILABLE.values():
        selected_ai_model = DEFAULT_AI_MODEL

    return stream_reply(conversation.id, selected_ai_model, message_history, last_user_message.content, replaced_message_id=old_answer.id)

@ai_bp.route("/api/getConversation/<int:conversation_id>", methods=["GET"])
@login_required
def get_conversation(conversation_id):
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=current_user.id).first()

    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404

    messages = Message.query.filter_by(conversation_id=conversation.id).order_by(Message.id.asc()).all()

    return jsonify({
        "id": conversation.id,
        "title": conversation.title if conversation.title else "Untitled Conversation",
        "conversationAiModel": conversation.ai_model,
        "messages": [message_json(msg) for msg in messages]
    })

# overwrites the text of a message (the users or the AIs), the model gets the history from the database
# on every request so from the next answer on it believes this is what was said
@ai_bp.route("/api/editMessage/<int:message_id>", methods=["PUT"])
@login_required
def edit_message(message_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Request must be JSON"}), 400

    new_content = str(data.get("content") or "")

    if not new_content.strip():
        return jsonify({"error": "Message cannot be empty"}), 400

    if len(new_content) > MESSAGE_MAX_LENGTH:
        return jsonify({"error": f"Message cannot be longer than {MESSAGE_MAX_LENGTH} characters"}), 400

    message = get_own_message(message_id)

    if not message:
        return jsonify({"error": "Message not found"}), 404

    try:
        if new_content != message.content: # saving without changing anything shouldnt mark it as edited
            message.content = new_content
            message.edited = True
            db.session.commit()

        return jsonify(message_json(message))
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# deletes a user message together with its answer, message_id can be either one of the two.
# always both so the history keeps going user, assistant, user, assistant
@ai_bp.route("/api/deleteExchange/<int:message_id>", methods=["DELETE"])
@login_required
def delete_exchange(message_id):
    message = get_own_message(message_id)

    if not message:
        return jsonify({"error": "Message not found"}), 404

    same_conversation = Message.query.filter_by(conversation_id=message.conversation_id)

    # the other half is the answer right after a user message or the user message right before an answer
    if message.message_role == "user":
        user_message = message
        ai_message = same_conversation.filter(Message.id > message.id).order_by(Message.id.asc()).first()
    else:
        ai_message = message
        user_message = same_conversation.filter(Message.id < message.id).order_by(Message.id.desc()).first()

    if not user_message or not ai_message or user_message.message_role != "user" or ai_message.message_role != "assistant":
        return jsonify({"error": "This message has no matching question or answer"}), 400

    try:
        deleted_ids = [user_message.id, ai_message.id]
        conversation = message.conversation

        # a conversation with nothing left in it goes away too (its messages get deleted along with it)
        conversation_deleted = same_conversation.count() <= 2
        if conversation_deleted:
            db.session.delete(conversation)
        else:
            db.session.delete(user_message)
            db.session.delete(ai_message)

        db.session.commit()
        return jsonify({"deletedIds": deleted_ids, "conversationDeleted": conversation_deleted})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

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
