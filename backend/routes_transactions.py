from flask import Blueprint, request, jsonify, g
from backend.database import get_db_connection
from backend.auth import token_required

transactions_bp = Blueprint("transactions", __name__, url_prefix="/api/transactions")

@transactions_bp.route("", methods=["GET"])
@token_required
def list_transactions():
    trans_type = request.args.get("type", "all").lower()
    search = (request.args.get("search") or "").strip().lower()

    query = "SELECT id, type, item, category, amount, date, note, created_at FROM transactions WHERE user_id = ?"
    params = [g.user_id]

    if trans_type in ("income", "expense"):
        query += " AND type = ?"
        params.append(trans_type)

    if search:
        query += " AND (LOWER(item) LIKE ? OR LOWER(category) LIKE ? OR LOWER(note) LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    query += " ORDER BY date DESC, id DESC"

    conn = get_db_connection()
    rows = conn.execute(query, params).fetchall()
    conn.close()

    transactions = [dict(row) for row in rows]
    return jsonify({"transactions": transactions}), 200

@transactions_bp.route("", methods=["POST"])
@token_required
def create_transaction():
    data = request.get_json(silent=True) or {}
    trans_type = (data.get("type") or "").strip().lower()
    item = (data.get("item") or "").strip()
    category = (data.get("category") or "").strip()
    amount = data.get("amount")
    date_str = (data.get("date") or "").strip()
    note = (data.get("note") or "").strip()

    if trans_type not in ("income", "expense"):
        return jsonify({"error": "Transaction type must be 'income' or 'expense'"}), 400
    if not item:
        return jsonify({"error": "Item description is required"}), 400
    if not category:
        return jsonify({"error": "Category is required"}), 400
    if not date_str:
        return jsonify({"error": "Transaction date is required"}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Amount must be a positive number"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO transactions (user_id, type, item, category, amount, date, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (g.user_id, trans_type, item, category, amount, date_str, note)
    )
    conn.commit()
    trans_id = cursor.lastrowid

    created = conn.execute(
        "SELECT id, type, item, category, amount, date, note, created_at FROM transactions WHERE id = ?",
        (trans_id,)
    ).fetchone()
    conn.close()

    return jsonify({"transaction": dict(created)}), 201

@transactions_bp.route("/<int:trans_id>", methods=["PUT"])
@token_required
def update_transaction(trans_id):
    data = request.get_json(silent=True) or {}
    trans_type = (data.get("type") or "").strip().lower()
    item = (data.get("item") or "").strip()
    category = (data.get("category") or "").strip()
    amount = data.get("amount")
    date_str = (data.get("date") or "").strip()
    note = (data.get("note") or "").strip()

    if trans_type not in ("income", "expense"):
        return jsonify({"error": "Transaction type must be 'income' or 'expense'"}), 400
    if not item:
        return jsonify({"error": "Item description is required"}), 400
    if not category:
        return jsonify({"error": "Category is required"}), 400
    if not date_str:
        return jsonify({"error": "Transaction date is required"}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Amount must be a positive number"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check ownership
    existing = cursor.execute(
        "SELECT id FROM transactions WHERE id = ? AND user_id = ?",
        (trans_id, g.user_id)
    ).fetchone()

    if not existing:
        conn.close()
        return jsonify({"error": "Transaction not found or unauthorized"}), 404

    cursor.execute(
        """
        UPDATE transactions
        SET type = ?, item = ?, category = ?, amount = ?, date = ?, note = ?
        WHERE id = ? AND user_id = ?
        """,
        (trans_id_type := trans_type, item, category, amount, date_str, note, trans_id, g.user_id)
    )
    conn.commit()

    updated = conn.execute(
        "SELECT id, type, item, category, amount, date, note, created_at FROM transactions WHERE id = ?",
        (trans_id,)
    ).fetchone()
    conn.close()

    return jsonify({"transaction": dict(updated)}), 200

@transactions_bp.route("/<int:trans_id>", methods=["DELETE"])
@token_required
def delete_transaction(trans_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check ownership
    existing = cursor.execute(
        "SELECT id FROM transactions WHERE id = ? AND user_id = ?",
        (trans_id, g.user_id)
    ).fetchone()

    if not existing:
        conn.close()
        return jsonify({"error": "Transaction not found or unauthorized"}), 404

    cursor.execute("DELETE FROM transactions WHERE id = ? AND user_id = ?", (trans_id, g.user_id))
    conn.commit()
    conn.close()

    return jsonify({"message": "Transaction deleted successfully"}), 200
