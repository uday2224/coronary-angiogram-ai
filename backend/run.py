import os
from app import create_app

app = create_app()

if __name__ == "__main__":
    # Allow controlling debug mode via .env (default to True for development)
    debug_mode = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1", "yes")
    # Keep use_reloader=False to prevent Werkzeug from loading the 200MB PyTorch models twice
    use_reloader = os.getenv("FLASK_USE_RELOADER", "False").lower() in ("true", "1", "yes")

    app.run(
        host=app.config["HOST"],
        port=app.config["PORT"],
        debug=debug_mode,
        use_reloader=use_reloader,
    )
