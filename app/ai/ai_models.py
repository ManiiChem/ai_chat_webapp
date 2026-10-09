# model ids r from https://console.groq.com/docs/models
AI_MODELS_AVAILABLE = {
    "GPT-OSS 120B": "openai/gpt-oss-120b",
    "GPT-OSS 20B": "openai/gpt-oss-20b"
}

DEFAULT_AI_MODEL = "openai/gpt-oss-120b"

# titles always use the small fast model so they dont eat into the daily limit of the model the user picked
TITLE_AI_MODEL = "openai/gpt-oss-20b"
