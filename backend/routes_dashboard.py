import datetime
from flask import Blueprint, jsonify, g
from backend.database import get_db_connection
from backend.auth import token_required

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

@dashboard_bp.route("/summary", methods=["GET"])
@token_required
def get_dashboard_summary():
    conn = get_db_connection()

    # 1. Total Income & Total Expenses
    income_row = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'income'",
        (g.user_id,)
    ).fetchone()
    expense_row = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense'",
        (g.user_id,)
    ).fetchone()

    total_income = float(income_row["total"]) if income_row else 0.0
    total_expenses = float(expense_row["total"]) if expense_row else 0.0
    balance = total_income - total_expenses

    # 2. Total Savings
    savings_row = conn.execute(
        "SELECT COALESCE(SUM(saved_amount), 0) as total FROM savings_goals WHERE user_id = ?",
        (g.user_id,)
    ).fetchone()
    total_savings = float(savings_row["total"]) if savings_row else 0.0

    # 3. Monthly Budget & Spent
    budget_row = conn.execute("SELECT amount FROM budgets WHERE user_id = ?", (g.user_id,)).fetchone()
    budget_amount = float(budget_row["amount"]) if budget_row else 10000.0
    budget_remaining = max(budget_amount - total_expenses, 0.0)
    budget_percentage = min(round((total_expenses / budget_amount) * 100), 100) if budget_amount > 0 else 0

    # 4. Primary Savings Goal (first one created)
    primary_goal_row = conn.execute(
        "SELECT name, target_amount, saved_amount FROM savings_goals WHERE user_id = ? ORDER BY id ASC LIMIT 1",
        (g.user_id,)
    ).fetchone()

    primary_goal = None
    if primary_goal_row:
        tgt = float(primary_goal_row["target_amount"])
        svd = float(primary_goal_row["saved_amount"])
        pct = min(round((svd / tgt) * 100), 100) if tgt > 0 else 0
        primary_goal = {
            "name": primary_goal_row["name"],
            "targetAmount": tgt,
            "savedAmount": svd,
            "percentage": pct
        }

    # 5. Six-Month Trend Data for Income & Expense Chart
    today = datetime.date.today()
    # Compute the past 6 months
    months_labels = []
    month_keys = []  # List of (year, month) tuples

    for i in range(5, -1, -1):
        # Calculate year and month for (today - i months)
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1
        d = datetime.date(year, month, 1)
        months_labels.append(d.strftime("%b"))
        month_keys.append((year, month))

    income_by_month = [0.0] * 6
    expense_by_month = [0.0] * 6

    # Fetch transactions from the past 7 months to bucket
    earliest_date = f"{month_keys[0][0]:04d}-{month_keys[0][1]:02d}-01"
    trans_rows = conn.execute(
        "SELECT type, amount, date FROM transactions WHERE user_id = ? AND date >= ?",
        (g.user_id, earliest_date)
    ).fetchall()
    conn.close()

    for t in trans_rows:
        try:
            t_date = datetime.datetime.strptime(t["date"][:10], "%Y-%m-%d").date()
            key = (t_date.year, t_date.month)
            if key in month_keys:
                idx = month_keys.index(key)
                amt = float(t["amount"])
                if t["type"] == "income":
                    income_by_month[idx] += amt
                elif t["type"] == "expense":
                    expense_by_month[idx] += amt
        except Exception:
            continue

    has_chart_data = any(v > 0 for v in income_by_month) or any(v > 0 for v in expense_by_month)

    return jsonify({
        "balance": balance,
        "totalIncome": total_income,
        "totalExpenses": total_expenses,
        "totalSavings": total_savings,
        "budget": {
            "total": budget_amount,
            "spent": total_expenses,
            "remaining": budget_remaining,
            "percentage": budget_percentage
        },
        "primaryGoal": primary_goal,
        "chart": {
            "months": months_labels,
            "incomeData": income_by_month,
            "expenseData": expense_by_month,
            "hasData": has_chart_data
        }
    }), 200
