from flask import render_template, redirect, flash, url_for, request, session
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

@login_mgr.user_loader
def load_user(uid):
    return db.session.get(User, int(uid))

@login_mgr.unauthorized_handler
def unauthorized_callback():
    flash("You must be logged in to view this page.", "warning")
    return redirect(url_for("auth.login"))

@auth_bp.route("/signup", methods=["GET", "POST"])
def signup():
    if current_user.is_authenticated:
        flash("You are already logged in.", "warning")
        return redirect(url_for("core.index"))
    
    if request.method == "POST":
        username = request.form.get("usernameInput", "").strip()
        password = request.form.get("passwordInput", "").strip()

        if username and password and input_length(username, password):
            user = User.query.filter(func.lower(User.username) == username.lower()).first() # case insensitive so we dont have multiple usernames like JOhn, john, JOHN
            if not user:
                password_hash = bcrypt.generate_password_hash(password).decode("utf-8") # Do not forget this for the love of god
                new_user = User(username=username, password_hash=password_hash, role="user")

                db.session.add(new_user)
                db.session.commit()
                login_user(new_user)
                flash("Successfully made an account!", "success")
                return redirect(url_for("core.index"))
            else:
                flash("Invalid Information. Please try again.", "warning")
        else:
            flash(f'Username must be between {USERNAME_MIN_LENGTH}-{USERNAME_MAX_LENGTH} and password must be between {PASSWORD_MIN_LENGTH}-{PASSWORD_MAX_LENGTH}', 'warning')

    return render_template("signup.html")

@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        flash("You are already logged in.", "warning")
        return redirect(url_for("core.index"))
    
    if request.method == "POST":
        username = request.form.get("usernameInput", "").strip()
        password = request.form.get("passwordInput", "").strip()

        if username and password:
            user = User.query.filter_by(username=username).first()
            if user and bcrypt.check_password_hash(user.password_hash, password):
                login_user(user)
                flash("Successfully logged in!", "success")
                return redirect(url_for("core.index"))
            
        flash('Incorrect username or password', 'warning')

    return render_template('login.html')

@auth_bp.route("/logout", methods=["POST"]) # POST so a link or image on another site cant log the user out
@login_required
def logout():
    logout_user()
    session.clear()
    flash("Logged out", "info")
    return redirect(url_for("auth.login"))
