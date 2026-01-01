from flask import redirect, url_for, request, jsonify
from flask_login import login_required
from app.models import User, Conversation, Message
from app.ai import ai_bp
import boto3

client = boto3.client("bedrock-runtime", region_name="us-east-1")

@ai_bp.route("/api/sendPrompt", methods=["POST"])
@login_required
def send_receive_prompt():
    if request.is_json:
        data = request.json
        user_prompt = data['user_prompt']

        try:
            response = client.converse(
                modelId="anthropic.claude-3-haiku-20240307-v1:0",
                messages=[
                    {"role": "user", "content": [{"text": user_prompt}]}
                ],
                inferenceConfig={"maxTokens": 1024, "temperature": 0.7},
            )

            return jsonify({"aiResponse": response['output']['message']['content'][0]['text']})
        except (Exception) as e:
            print(e)
            return f"An error has occured, please try again.", 500

    else:
        return 'Request must be JSON', 400



