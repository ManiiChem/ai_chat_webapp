from flask import redirect, url_for, request, jsonify, current_app, Flask
from flask_login import login_required, current_user
from app.extensions import db
from app.models import User, Conversation, Message
from app.ai import ai_bp
import boto3
import threading

model_id = "anthropic.claude-3-haiku-20240307-v1:0"

def get_title_from_prompt_and_update(app: Flask, user_id: int, conversation_id: int, prompt: str) -> None:
    with app.app_context():
        try:
            response = client.converse(
                modelId=model_id,
                messages=[{
                    "role": "user",
                    "content": [{"text": f"Generate a short, concise conversation title (max 6 words) based on this user prompt. Do not include quotes or words like 'Title:'. Prompt: {prompt}"}]
                }],
                inferenceConfig={"maxTokens": 50, "temperature": 0.5},
            )
            
            new_title = response['output']['message']['content'][0]['text'].strip('"')

            conversation = Conversation.query.filter_by(id=conversation_id, user_id=user_id).first()
            if conversation:
                conversation.title = new_title
                db.session.commit()

        except Exception as e:
            print("Title generatio failed:", e)


client = boto3.client("bedrock-runtime", region_name="us-east-1")
@ai_bp.route("/api/sendPrompt", methods=["POST"])
@login_required
def send_receive_prompt():
    if not request.is_json:
        return "Request must be JSON", 400
    
    data = request.json
    user_prompt = data.get("user_prompt", "").strip()
    conversation_id = data.get("conversation_id")
    created_at_local = data.get("created_at")
    #print(created_at_local)

    if not user_prompt:
        user_prompt = "Continue"

    try:
        conversation = None
        message_history = []

        if conversation_id:
            conversation = Conversation.query.filter_by(id=conversation_id, user_id=current_user.id).first()
            
            if not conversation:
                return "Conversation not found or unauthorized", 404
            
            # Fetch the last 20 messages 
            past_messages = Message.query.filter_by(conversation_id=conversation.id).order_by(Message.id.asc()).limit(20).all()
        
            for msg in past_messages:
                message_history.append({
                    "role": msg.message_role,
                    "content": [{"text": msg.content}]
                })
        else:
            convo_title = "Untitled Conversation"

            conversation = Conversation(
                user_id=current_user.id, 
                ai_model=model_id,
                title=convo_title,
                created_at=created_at_local
            )
            db.session.add(conversation)
            db.session.commit()

            # using a background thread to not halt the main execution (also gave it access to flasks app context)
            app_instance = current_app._get_current_object()
            threading.Thread(
                target=get_title_from_prompt_and_update,
                args=(app_instance, current_user.id, conversation.id, user_prompt)
            ).start()


        message_history.append({
            "role": "user",
            "content": [{"text": user_prompt}]
        })

        user_message = Message(
            conversation_id=conversation.id,
            message_role="user",
            content=user_prompt
        )

        db.session.add(user_message)

        # call bedrock
        response = client.converse(
            modelId=model_id,
            messages=message_history,
            inferenceConfig={"maxTokens": 1024, "temperature": 0.7},
        )
        
        ai_text = response['output']['message']['content'][0]['text']
        
        ai_message_db = Message(
            conversation_id=conversation.id,
            message_role="assistant",
            content=ai_text 
        )
        db.session.add(ai_message_db)
        
        db.session.commit() 

        return jsonify({
            "aiResponse": ai_text,
            "conversationId": conversation.id
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        return f"An error has occurred: {str(e)}", 500
    
@ai_bp.route("/api/getConversation/<int:conversation_id>", methods=["GET"])
@login_required
def get_conversation(conversation_id):
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=current_user.id).first()
    
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404
    
    messages = Message.query.filter_by(conversation_id=conversation.id).order_by(Message.id.asc()).all()
    
    return jsonify({
        "id": conversation.id,
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
    user_convos = current_user.conversations
    
    data = []
    for c in user_convos:
        data.append({
            "id": c.id,
            "title": c.title if c.title else "Untitled Conversation",
            "date": c.created_at.split(',')[0] if c.created_at else "",
            "message_count": len(c.messages), 
            "ai_model": c.ai_model
        })
    
    # descending aka newest first
    data.sort(key=lambda x: x['id'], reverse=True)
    
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
    data = request.json
    conversation_id = data.get("conversation_id")
    new_title = data.get("new_title")
    
    if not new_title:
        return jsonify({"error": "Title cannot be empty"}), 400

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