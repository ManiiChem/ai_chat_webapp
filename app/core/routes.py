from flask import render_template
from flask_login import login_required
from app.core import core_bp
from app.ai.ai_models import AI_MODELS_AVAILABLE

@core_bp.route("/")
@login_required
def index():
    return render_template("index.html", models_available=AI_MODELS_AVAILABLE)
