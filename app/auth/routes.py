from flask import request, session, jsonify
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy import func
from app.extensions import login_mgr, bcrypt, db
from app.auth import auth_bp
from app.models import User

USERNAME_MIN_LENGTH = 3
USERNAME_MAX_LENGTH = 32

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 32

def input_length(username: str, password: str) -> bool:
    username_length = len(username)
    password_length = len(password)

    if username_length < USERNAME_MIN_LENGTH or username_length > USERNAME_MAX_LENGTH or password_length < PASSWORD_MIN_LENGTH or password_length > PASSWORD_MAX_LENGTH:
        return False

    return True

def user_json(user: User) -> dict:
    return {"id": user.id, "username": user.username}

# the react forms send json, this pulls the username and password out of it
def get_credentials() -> tuple[str, str]:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return "", ""

    return str(data.get("username") or "").strip(), str(data.get("password") or "").strip()

@login_mgr.user_loader
def load_user(uid):
    return db.session.get(User, int(uid))

# every route that needs a login is an api route now, so the frontend gets a 401 and decides where to send the user
@login_mgr.unauthorized_handler
def unauthorized_callback():
    return jsonify({"error": "You must be logged in"}), 401

@auth_bp.route("/api/me", methods=["GET"])
@login_required
def me():
    return jsonify(user_json(current_user))

@auth_bp.route("/api/signup", methods=["POST"])
def signup():
    if current_user.is_authenticated:
        return jsonify(user_json(current_user))

    username, password = get_credentials()

    if not (username and password and input_length(username, password)):
        return jsonify({"error": f"Username must be between {USERNAME_MIN_LENGTH}-{USERNAME_MAX_LENGTH} and password must be between {PASSWORD_MIN_LENGTH}-{PASSWORD_MAX_LENGTH}"}), 400

    user = User.query.filter(func.lower(User.username) == username.lower()).first() # case insensitive so we dont have multiple usernames like JOhn, john, JOHN
    if user:
        return jsonify({"error": "That username is already taken"}), 400

    password_hash = bcrypt.generate_password_hash(password).decode("utf-8") # Do not forget this for the love of god
    new_user = User(username=username, password_hash=password_hash, role="user")

    db.session.add(new_user)
    db.session.commit()
    login_user(new_user)
    return jsonify(user_json(new_user))

@auth_bp.route("/api/login", methods=["POST"])
def login():
    if current_user.is_authenticated:
        return jsonify(user_json(current_user))

    username, password = get_credentials()

    if username and password:
        user = User.query.filter_by(username=username).first()
        if user and bcrypt.check_password_hash(user.password_hash, password):
            login_user(user)
            return jsonify(user_json(user))

    return jsonify({"error": "Incorrect username or password"}), 401

@auth_bp.route("/api/logout", methods=["POST"]) # POST so a link or image on another site cant log the user out
@login_required
def logout():
    logout_user()
    session.clear()
    return jsonify({"success": True})
