from flask import Blueprint, request, jsonify, g
from backend.database import get_db_connection
from backend.auth import token_required

budget_bp = Blueprint("budget", __name__, url_prefix="/api/budget")

@budget_bp.route("", methods=["GET"])
@token_required
def get_budget():
    conn = get_db_connection()
    row = conn.execute("SELECT amount FROM budgets WHERE user_id = ?", (g.user_id,)).fetchone()
    
    if not row:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO budgets (user_id, amount) VALUES (?, 10000.0)", (g.user_id,))
        conn.commit()
        amount = 10000.0
    else:
        amount = float(row["amount"])

    # Calculate total expenses for current user
    spent_row = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) as total_spent FROM transactions WHERE user_id = ? AND type = 'expense'",
        (g.user_id,)
    ).fetchone()
    conn.close()

    total_spent = float(spent_row["total_spent"]) if spent_row else 0.0
    remaining = max(amount - total_spent, 0.0)
    percentage = min(round((total_spent / amount) * 100), 100) if amount > 0 else 0

    return jsonify({
        "budget": amount,
        "spent": total_spent,
        "remaining": remaining,
        "percentage": percentage
    }), 200

@budget_bp.route("", methods=["PUT"])
@token_required
def update_budget():
    data = request.get_json(silent=True) or {}
    raw_amount = data.get("amount")

    try:
        amount = float(raw_amount)
        if amount <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Budget amount must be a positive number"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO budgets (user_id, amount, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            amount = excluded.amount,
            updated_at = CURRENT_TIMESTAMP
        """,
        (g.user_id, amount)
    )
    conn.commit()

    # Recalculate spending
    spent_row = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) as total_spent FROM transactions WHERE user_id = ? AND type = 'expense'",
        (g.user_id,)
    ).fetchone()
    conn.close()

    total_spent = float(spent_row["total_spent"]) if spent_row else 0.0
    remaining = max(amount - total_spent, 0.0)
    percentage = min(round((total_spent / amount) * 100), 100) if amount > 0 else 0

    return jsonify({
        "message": "Budget updated successfully",
        "budget": amount,
        "spent": total_spent,
        "remaining": remaining,
        "percentage": percentage
    }), 200
