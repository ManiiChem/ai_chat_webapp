from flask import render_template, redirect, url_for, session
from flask_login import login_required, current_user
from app.core import core_bp
from app.ai.ai_models import AI_MODELS_AVAILABLE

@core_bp.route("/")
@login_required
def index():
    session["models_available"] = AI_MODELS_AVAILABLE
    return render_template("index.html")
