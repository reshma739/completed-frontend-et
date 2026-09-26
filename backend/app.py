import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from backend.database import init_db
from backend.routes_auth import auth_bp
from backend.routes_transactions import transactions_bp
from backend.routes_budget import budget_bp
from backend.routes_savings import savings_bp
from backend.routes_dashboard import dashboard_bp
from backend.routes_settings import settings_bp

# Project root path (where index.html, dashboard.html, css/, js/ live)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def create_app():
    # Initialize SQLite database schema
    init_db()

    app = Flask(__name__, static_folder=PROJECT_ROOT, static_url_path="")
    
    # ---------------------------------------------------------------------------
    # CORS
    #   • Local development: allow all origins (convenient for file:// and
    #     other dev tools)
    #   • Production (VERCEL env var present): restrict to same origin to prevent
    #     cross-site credential theft
    # ---------------------------------------------------------------------------
    if os.environ.get("VERCEL"):
        CORS(app, resources={r"/api/*": {"origins": os.environ.get("VERCEL_URL", "*")}},
             supports_credentials=True)
    else:
        CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)


    # Register API Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(transactions_bp)
    app.register_blueprint(budget_bp)
    app.register_blueprint(savings_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(settings_bp)

    # Static file serving routes
    @app.route("/")
    def index():
        return send_from_directory(PROJECT_ROOT, "index.html")

    @app.route("/<path:path>")
    def static_files(path):
        full_path = os.path.join(PROJECT_ROOT, path)
        if os.path.exists(full_path) and os.path.isfile(full_path):
            return send_from_directory(PROJECT_ROOT, path)
        return send_from_directory(PROJECT_ROOT, "index.html")

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5000))
    print(f"MoneyBloom server running at http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
