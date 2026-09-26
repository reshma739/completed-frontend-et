from flask import Blueprint, request, jsonify, g
from backend.database import get_db_connection
from backend.auth import token_required

settings_bp = Blueprint("settings", __name__, url_prefix="/api/user")

SUPPORTED_CURRENCIES = {"INR", "USD", "EUR", "GBP"}

@settings_bp.route("/profile", methods=["PATCH"])
@token_required
def update_profile():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()

    if not name:
        return jsonify({"error": "Name cannot be empty"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET name = ? WHERE id = ?", (name, g.user_id))
    conn.commit()
    conn.close()

    return jsonify({"message": "Profile updated successfully", "name": name}), 200

@settings_bp.route("/settings", methods=["PATCH"])
@token_required
def update_settings():
    data = request.get_json(silent=True) or {}
    currency = data.get("currency")
    budget_notif = data.get("budget_notifications")
    savings_notif = data.get("savings_notifications")

    updates = []
    params = []

    if currency is not None:
        if currency not in SUPPORTED_CURRENCIES:
            return jsonify({"error": f"Currency must be one of {list(SUPPORTED_CURRENCIES)}"}), 400
        updates.append("currency = ?")
        params.append(currency)

    if budget_notif is not None:
        updates.append("budget_notifications = ?")
        params.append(1 if budget_notif else 0)

    if savings_notif is not None:
        updates.append("savings_notifications = ?")
        params.append(1 if savings_notif else 0)

    if not updates:
        return jsonify({"message": "No settings to update"}), 200

    params.append(g.user_id)
    query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    conn.commit()

    user = conn.execute(
        "SELECT id, name, email, currency, budget_notifications, savings_notifications FROM users WHERE id = ?",
        (g.user_id,)
    ).fetchone()
    conn.close()

    return jsonify({
        "message": "Settings updated successfully",
        "settings": {
            "currency": user["currency"],
            "budget_notifications": bool(user["budget_notifications"]),
            "savings_notifications": bool(user["savings_notifications"])
        }
    }), 200

@settings_bp.route("/reset-data", methods=["POST"])
@token_required
def reset_financial_data():
    """Deletes all transactions and savings goals, and resets budget for the current user."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM transactions WHERE user_id = ?", (g.user_id,))
    cursor.execute("DELETE FROM savings_goals WHERE user_id = ?", (g.user_id,))
    cursor.execute("UPDATE budgets SET amount = 10000.0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?", (g.user_id,))

    conn.commit()
    conn.close()

    return jsonify({"message": "All financial data has been cleared successfully"}), 200
