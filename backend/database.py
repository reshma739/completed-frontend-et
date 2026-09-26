import sqlite3
import os

if os.environ.get("VERCEL"):
    # On Vercel serverless functions, the root directory is read-only; /tmp is writable
    DB_PATH = "/tmp/moneybloom.db"
else:
    DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "moneybloom.db")

def get_db_connection():
    """Returns a SQLite connection with foreign keys enabled and row dictionary factory."""
    db_exists = os.path.exists(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    if not db_exists:
        _init_db_tables(conn)
    return conn

def _init_db_tables(conn):
    """Internal helper to create tables using an active connection."""
    cursor = conn.cursor()

    # Users Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            currency TEXT DEFAULT 'INR',
            budget_notifications INTEGER DEFAULT 1,
            savings_notifications INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Budget Table (one active budget configuration per user)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            amount REAL NOT NULL DEFAULT 10000.0 CHECK(amount >= 0),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Transactions Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
            item TEXT NOT NULL,
            category TEXT NOT NULL,
            amount REAL NOT NULL CHECK(amount > 0),
            date TEXT NOT NULL,
            note TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Savings Goals Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS savings_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            target_amount REAL NOT NULL CHECK(target_amount > 0),
            saved_amount REAL NOT NULL DEFAULT 0.0 CHECK(saved_amount >= 0),
            target_date TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Performance & Isolation Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, date DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_savings_user ON savings_goals(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id)")
    conn.commit()

def init_db():
    """Initializes tables and indexes for MoneyBloom."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    _init_db_tables(conn)
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at", DB_PATH)
