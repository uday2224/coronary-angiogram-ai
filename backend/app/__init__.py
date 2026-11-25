import logging
import os
from pathlib import Path

from flask import Flask, request
from flask_cors import CORS
from dotenv import load_dotenv

from .routes import api
from .model_adapter import ModelAdapter


def create_app():
    load_dotenv()

    # --- Logging ---
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    logger = logging.getLogger(__name__)

    app = Flask(__name__)

    # --- Paths ---
    base = Path(__file__).resolve().parents[1]
    out = base / "outputs"
    out.mkdir(parents=True, exist_ok=True)
    models_dir = base / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    # --- Configuration ---
    app.config.update(
        OUTPUT_DIR=str(out),
        MODELS_DIR=str(models_dir),
        MAX_CONTENT_LENGTH=int(os.getenv("MAX_UPLOAD_MB", "12")) * 1024 * 1024,
        HOST=os.getenv("FLASK_HOST", os.getenv("HOST", "0.0.0.0")),
        PORT=int(os.getenv("PORT", os.getenv("FLASK_PORT", "5000"))),
        MODEL_TYPE=os.getenv("MODEL_TYPE", "integrated_pipeline"),
        SEGMENTATION_THRESHOLD=float(os.getenv("SEGMENTATION_THRESHOLD", "0.3")),
    )

    # --- CORS ---
    CORS(
        app,
        resources={
            r"/*": {
                "origins": "*",
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
            }
        },
    )
    logger.info("CORS enabled for all origins on /api and /outputs")

    # --- Blueprint ---
    app.register_blueprint(api)

    @app.route("/")
    def index():
        if request.accept_mimetypes.accept_json and not request.accept_mimetypes.accept_html:
            return {
                "status": "online",
                "service": "Coronary Angiogram AI API",
                "version": "2.0.0",
                "health_check": "/api/health",
            }, 200

        html = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Coronary Angiogram AI - Backend Online</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1120; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1.5rem; box-sizing: border-box; }
        .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; border: 1px solid #334155; max-width: 520px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
        .badge { display: inline-block; background: #065f46; color: #34d399; font-weight: 600; font-size: 0.85rem; padding: 0.35rem 0.85rem; border-radius: 9999px; margin-bottom: 1.25rem; }
        h1 { margin: 0 0 0.5rem; font-size: 1.5rem; color: #ffffff; }
        p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin: 0.5rem 0 1.5rem; }
        a.btn { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 0.65rem 1.25rem; border-radius: 0.5rem; font-weight: 600; transition: background 0.2s; }
        a.btn:hover { background: #1d4ed8; }
        .notice { font-size: 0.75rem; color: #64748b; margin-top: 1.5rem; border-top: 1px solid #334155; padding-top: 1rem; line-height: 1.4; }
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">&#9679; Backend API Online</span>
        <h1>Coronary Angiogram AI Workstation</h1>
        <p>The Flask API server and AI pipeline are running successfully. Connect your frontend web client or inspect the system health check.</p>
        <a class="btn" href="/api/health" target="_blank">Check /api/health Status &rarr;</a>
        <div class="notice">Investigational Use Only (IUO). Not for primary diagnostic use without clinical correlation.</div>
    </div>
</body>
</html>"""
        return html, 200, {"Content-Type": "text/html"}

    # Explicit global CORS headers for all requests & preflights
    @app.before_request
    def handle_options_preflight():
        if request.method == "OPTIONS":
            response = app.make_default_options_response()
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
            return response

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        return response

    # --- Load AI Pipeline once at startup ---
    adapter = ModelAdapter(
        model_type=app.config["MODEL_TYPE"],
        models_dir=models_dir,
        threshold=app.config["SEGMENTATION_THRESHOLD"],
    )
    adapter.load()
    app.extensions["model_adapter"] = adapter

    logger.info("App initialized — pipeline ready: %s", adapter.loaded)

    return app
