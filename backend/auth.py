import os
import datetime
import jwt
from functools import wraps
from flask import request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
from backend.database import get_db_connection

JWT_SECRET = os.environ.get("JWT_SECRET", "moneybloom_secure_jwt_secret_key_2026_!@#$%^")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 30

def hash_password(password: str) -> str:
    """Hashes a password securely using Werkzeug's default algorithm."""
    return generate_password_hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    """Verifies a plain password against a stored password hash."""
    return check_password_hash(password_hash, password)

def generate_token(user_id: int, email: str, name: str) -> str:
    """Generates a signed JWT token valid for 30 days."""
    payload = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=JWT_EXPIRATION_DAYS),
        "iat": datetime.datetime.now(datetime.timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def token_required(f):
    """Decorator to protect routes requiring authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization token is missing"}), 401

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Authorization header must be Bearer token"}), 401

        token = parts[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("user_id")

            conn = get_db_connection()
            user = conn.execute(
                "SELECT id, name, email, currency, budget_notifications, savings_notifications FROM users WHERE id = ?",
                (user_id,)
            ).fetchone()
            conn.close()

            if not user:
                return jsonify({"error": "User no longer exists"}), 401

            g.current_user = dict(user)
            g.user_id = user["id"]

        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired, please log in again"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        except Exception as e:
            return jsonify({"error": f"Authentication failed: {str(e)}"}), 401

        return f(*args, **kwargs)
    return decorated
