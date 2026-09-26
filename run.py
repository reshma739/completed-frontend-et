import os
import sys

# Ensure UTF-8 stdout on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from backend.app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("=" * 60)
    print("MoneyBloom Backend Server Started")
    print(f"Web Application URL: http://127.0.0.1:{port}")
    print(f"API Base URL:        http://127.0.0.1:{port}/api")
    print("=" * 60)
    app.run(host="127.0.0.1", port=port, debug=False)
