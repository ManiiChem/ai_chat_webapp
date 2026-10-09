import os
from flask import current_app, jsonify, send_from_directory
from werkzeug.security import safe_join
from app.core import core_bp

# the react app gets built into frontend/dist (npm run build) and flask just hands those files out
def get_dist_dir() -> str:
    return os.path.abspath(os.path.join(current_app.root_path, "..", "frontend", "dist"))

@core_bp.route("/", defaults={"path": ""})
@core_bp.route("/<path:path>")
def frontend(path):
    # a wrong api url should say so instead of quietly returning the react page
    if path.startswith(("ai/", "auth/")):
        return jsonify({"error": "Not found"}), 404

    dist_dir = get_dist_dir()

    if not os.path.isfile(os.path.join(dist_dir, "index.html")):
        return "The frontend isnt built yet, run 'npm install' and 'npm run build' inside the frontend folder", 503

    # real files (js, css, icons) get served as they are
    file_path = safe_join(dist_dir, path) if path else None
    if file_path and os.path.isfile(file_path):
        return send_from_directory(dist_dir, path)

    # everything else is a page url like /login or /c/5 and react router figures out what to show
    return send_from_directory(dist_dir, "index.html")
