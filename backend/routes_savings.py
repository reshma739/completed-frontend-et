from flask import Blueprint, request, jsonify, g
from backend.database import get_db_connection
from backend.auth import token_required

savings_bp = Blueprint("savings", __name__, url_prefix="/api/savings-goals")

@savings_bp.route("", methods=["GET"])
@token_required
def list_savings_goals():
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT id, name, target_amount, saved_amount, target_date, created_at FROM savings_goals WHERE user_id = ? ORDER BY id ASC",
        (g.user_id,)
    ).fetchall()
    conn.close()

    goals = []
    for r in rows:
        target = float(r["target_amount"])
        saved = float(r["saved_amount"])
        pct = min(round((saved / target) * 100), 100) if target > 0 else 0
        goals.append({
            "id": r["id"],
            "name": r["name"],
            "targetAmount": target,
            "savedAmount": saved,
            "targetDate": r["target_date"],
            "percentage": pct,
            "isCompleted": saved >= target
        })

    return jsonify({"goals": goals}), 200

@savings_bp.route("", methods=["POST"])
@token_required
def create_savings_goal():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    target_amount = data.get("targetAmount") or data.get("target_amount")
    target_date = (data.get("targetDate") or data.get("target_date") or "").strip()

    if not name:
        return jsonify({"error": "Goal name is required"}), 400
    if not target_date:
        return jsonify({"error": "Target date is required"}), 400

    try:
        target = float(target_amount)
        if target <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Target amount must be a positive number"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO savings_goals (user_id, name, target_amount, saved_amount, target_date)
        VALUES (?, ?, ?, 0.0, ?)
        """,
        (g.user_id, name, target, target_date)
    )
    conn.commit()
    goal_id = cursor.lastrowid

    row = conn.execute(
        "SELECT id, name, target_amount, saved_amount, target_date FROM savings_goals WHERE id = ?",
        (goal_id,)
    ).fetchone()
    conn.close()

    return jsonify({
        "message": "Savings goal created",
        "goal": {
            "id": row["id"],
            "name": row["name"],
            "targetAmount": float(row["target_amount"]),
            "savedAmount": float(row["saved_amount"]),
            "targetDate": row["target_date"],
            "percentage": 0,
            "isCompleted": False
        }
    }), 201

@savings_bp.route("/<int:goal_id>", methods=["PUT"])
@token_required
def update_savings_goal(goal_id):
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    target_amount = data.get("targetAmount") or data.get("target_amount")
    target_date = (data.get("targetDate") or data.get("target_date") or "").strip()

    if not name:
        return jsonify({"error": "Goal name is required"}), 400
    if not target_date:
        return jsonify({"error": "Target date is required"}), 400

    try:
        target = float(target_amount)
        if target <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Target amount must be a positive number"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    existing = cursor.execute(
        "SELECT id, saved_amount FROM savings_goals WHERE id = ? AND user_id = ?",
        (goal_id, g.user_id)
    ).fetchone()

    if not existing:
        conn.close()
        return jsonify({"error": "Savings goal not found or unauthorized"}), 404

    cursor.execute(
        """
        UPDATE savings_goals
        SET name = ?, target_amount = ?, target_date = ?
        WHERE id = ? AND user_id = ?
        """,
        (name, target, target_date, goal_id, g.user_id)
    )
    conn.commit()

    row = conn.execute(
        "SELECT id, name, target_amount, saved_amount, target_date FROM savings_goals WHERE id = ?",
        (goal_id,)
    ).fetchone()
    conn.close()

    saved = float(row["saved_amount"])
    pct = min(round((saved / target) * 100), 100) if target > 0 else 0

    return jsonify({
        "message": "Savings goal updated",
        "goal": {
            "id": row["id"],
            "name": row["name"],
            "targetAmount": target,
            "savedAmount": saved,
            "targetDate": row["target_date"],
            "percentage": pct,
            "isCompleted": saved >= target
        }
    }), 200

@savings_bp.route("/<int:goal_id>/add-savings", methods=["POST"])
@token_required
def add_savings(goal_id):
    data = request.get_json(silent=True) or {}
    raw_amount = data.get("amount")

    try:
        amount = float(raw_amount)
        if amount <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Amount must be a positive number"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    existing = cursor.execute(
        "SELECT id, target_amount, saved_amount FROM savings_goals WHERE id = ? AND user_id = ?",
        (goal_id, g.user_id)
    ).fetchone()

    if not existing:
        conn.close()
        return jsonify({"error": "Savings goal not found or unauthorized"}), 404

    target = float(existing["target_amount"])
    current_saved = float(existing["saved_amount"])
    remaining = max(target - current_saved, 0.0)

    if remaining <= 0:
        conn.close()
        return jsonify({"error": "This savings goal has already reached its target"}), 400

    if amount > remaining:
        conn.close()
        return jsonify({"error": f"Amount exceeds remaining requirement of {remaining:.2f}"}), 400

    new_saved = current_saved + amount
    cursor.execute(
        "UPDATE savings_goals SET saved_amount = ? WHERE id = ? AND user_id = ?",
        (new_saved, goal_id, g.user_id)
    )
    conn.commit()

    row = conn.execute(
        "SELECT id, name, target_amount, saved_amount, target_date FROM savings_goals WHERE id = ?",
        (goal_id,)
    ).fetchone()
    conn.close()

    pct = min(round((new_saved / target) * 100), 100) if target > 0 else 0

    return jsonify({
        "message": "Savings updated successfully",
        "goal": {
            "id": row["id"],
            "name": row["name"],
            "targetAmount": target,
            "savedAmount": new_saved,
            "targetDate": row["target_date"],
            "percentage": pct,
            "isCompleted": new_saved >= target
        }
    }), 200

@savings_bp.route("/<int:goal_id>", methods=["DELETE"])
@token_required
def delete_savings_goal(goal_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    existing = cursor.execute(
        "SELECT id FROM savings_goals WHERE id = ? AND user_id = ?",
        (goal_id, g.user_id)
    ).fetchone()

    if not existing:
        conn.close()
        return jsonify({"error": "Savings goal not found or unauthorized"}), 404

    cursor.execute("DELETE FROM savings_goals WHERE id = ? AND user_id = ?", (goal_id, g.user_id))
    conn.commit()
    conn.close()

    return jsonify({"message": "Savings goal deleted successfully"}), 200
