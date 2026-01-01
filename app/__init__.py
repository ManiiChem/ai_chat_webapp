from flask import Flask
from app.extensions import migrate, bcrypt, login_mgr, db

def create_app(config_class=None):
    app = Flask(__name__)
    app.config.from_object(config_class or 'config.DevelopmentConfig')
    
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    login_mgr.init_app(app)

    from app.auth import auth_bp
    from app.core import core_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(core_bp, url_prefix="/")

    return app