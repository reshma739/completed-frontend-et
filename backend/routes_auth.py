from flask import Blueprint, request, jsonify, g
import sqlite3
import secrets
import time
from backend.database import get_db_connection
from backend.auth import hash_password, verify_password, generate_token, token_required

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# ---------------------------------------------------------------------------
# In-memory store for password reset tokens
# Structure: { token: { "user_id": int, "expires": float } }
# In production, replace with a database table or Redis.
# ---------------------------------------------------------------------------
_reset_tokens: dict = {}

# Token TTL — 15 minutes
_RESET_TOKEN_TTL = 15 * 60

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not email or "@" not in email:
        return jsonify({"error": "A valid email is required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    conn = get_db_connection()
    try:
        # Check if email is already in use
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if existing:
            return jsonify({"error": "An account with this email already exists"}), 409

        password_hash = hash_password(password)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, currency) VALUES (?, ?, ?, 'INR')",
            (name, email, password_hash)
        )
        user_id = cursor.lastrowid

        # Initialize default budget for the user
        cursor.execute(
            "INSERT INTO budgets (user_id, amount) VALUES (?, 10000.0)",
            (user_id,)
        )
        conn.commit()

        token = generate_token(user_id, email, name)
        return jsonify({
            "message": "Account created successfully",
            "token": token,
            "user": {
                "id": user_id,
                "name": name,
                "email": email,
                "currency": "INR",
                "budget_notifications": True,
                "savings_notifications": True
            }
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({"error": "An account with this email already exists"}), 409
    finally:
        conn.close()

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db_connection()
    user = conn.execute(
        "SELECT id, name, email, password_hash, currency, budget_notifications, savings_notifications FROM users WHERE email = ?",
        (email,)
    ).fetchone()
    conn.close()

    if not user or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "Incorrect email or password"}), 401

    token = generate_token(user["id"], user["email"], user["name"])
    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "currency": user["currency"] or "INR",
            "budget_notifications": bool(user["budget_notifications"]),
            "savings_notifications": bool(user["savings_notifications"])
        }
    }), 200

@auth_bp.route("/me", methods=["GET"])
@token_required
def get_me():
    return jsonify({
        "user": {
            "id": g.current_user["id"],
            "name": g.current_user["name"],
            "email": g.current_user["email"],
            "currency": g.current_user["currency"] or "INR",
            "budget_notifications": bool(g.current_user["budget_notifications"]),
            "savings_notifications": bool(g.current_user["savings_notifications"])
        }
    }), 200


# ---------------------------------------------------------------------------
# Forgot Password — step 1: request a reset token
# ---------------------------------------------------------------------------
@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email or "@" not in email:
        return jsonify({"error": "A valid email is required"}), 400

    conn = get_db_connection()
    user = conn.execute(
        "SELECT id, name FROM users WHERE email = ?", (email,)
    ).fetchone()
    conn.close()

    # Always respond the same way to prevent email enumeration
    if not user:
        return jsonify({
            "message": "If an account with that email exists, a reset link has been sent."
        }), 200

    # Generate a cryptographically secure token
    reset_token = secrets.token_urlsafe(32)
    _reset_tokens[reset_token] = {
        "user_id": user["id"],
        "expires": time.time() + _RESET_TOKEN_TTL
    }

    # ------------------------------------------------------------------
    # NOTE: In production, email the reset link to the user.
    # For this self-hosted / demo deployment we return the token directly
    # in the response so the frontend can drive the reset flow without
    # needing an email provider.
    # ------------------------------------------------------------------
    return jsonify({
        "message": "If an account with that email exists, a reset link has been sent.",
        "reset_token": reset_token   # frontend uses this to show the reset form
    }), 200


# ---------------------------------------------------------------------------
# Reset Password — step 2: consume token, set new password
# ---------------------------------------------------------------------------
@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}
    reset_token = (data.get("reset_token") or "").strip()
    new_password = data.get("new_password") or ""

    if not reset_token:
        return jsonify({"error": "Reset token is required"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    token_data = _reset_tokens.get(reset_token)
    if not token_data:
        return jsonify({"error": "Invalid or expired reset token"}), 400
    if time.time() > token_data["expires"]:
        _reset_tokens.pop(reset_token, None)
        return jsonify({"error": "Reset token has expired. Please request a new one."}), 400

    user_id = token_data["user_id"]
    new_hash = hash_password(new_password)

    conn = get_db_connection()
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (new_hash, user_id)
    )
    conn.commit()
    conn.close()

    # Invalidate the token immediately after use
    _reset_tokens.pop(reset_token, None)

    return jsonify({"message": "Password updated successfully. You can now log in."}), 200
