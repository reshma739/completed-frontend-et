import os
import sys
import unittest
import json

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import create_app
from backend.database import get_db_connection

class MoneyBloomBackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Setup test app
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def setUp(self):
        # Clean database before each test suite
        conn = get_db_connection()
        conn.execute("DELETE FROM transactions")
        conn.execute("DELETE FROM savings_goals")
        conn.execute("DELETE FROM budgets")
        conn.execute("DELETE FROM users")
        conn.commit()
        conn.close()

    def test_complete_moneybloom_workflow_and_user_isolation(self):
        print("\n--- 1. Testing Registration for User A (Alice) ---")
        res_a = self.client.post("/api/auth/register", json={
            "name": "Alice Wonderland",
            "email": "alice@example.com",
            "password": "password123"
        })
        self.assertEqual(res_a.status_code, 201)
        data_a = res_a.get_json()
        self.assertIn("token", data_a)
        token_a = data_a["token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        print("--- 2. Testing Registration for User B (Bob) ---")
        res_b = self.client.post("/api/auth/register", json={
            "name": "Bob Builder",
            "email": "bob@example.com",
            "password": "securepassword"
        })
        self.assertEqual(res_b.status_code, 201)
        data_b = res_b.get_json()
        token_b = data_b["token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        print("--- 3. Testing Duplicate Registration Prevention ---")
        res_dup = self.client.post("/api/auth/register", json={
            "name": "Alice Duplicate",
            "email": "alice@example.com",
            "password": "password123"
        })
        self.assertEqual(res_dup.status_code, 409)

        print("--- 4. Testing Login for Alice ---")
        res_login = self.client.post("/api/auth/login", json={
            "email": "alice@example.com",
            "password": "password123"
        })
        self.assertEqual(res_login.status_code, 200)

        print("--- 5. User A creates Transactions (Income & Expense) ---")
        res_inc = self.client.post("/api/transactions", headers=headers_a, json={
            "type": "income",
            "item": "Tech Monthly Salary",
            "category": "Salary",
            "amount": 75000.0,
            "date": "2026-09-01",
            "note": "Direct bank deposit"
        })
        self.assertEqual(res_inc.status_code, 201)
        inc_id = res_inc.get_json()["transaction"]["id"]

        res_exp = self.client.post("/api/transactions", headers=headers_a, json={
            "type": "expense",
            "item": "Monthly Organic Groceries",
            "category": "Food",
            "amount": 12000.0,
            "date": "2026-09-05",
            "note": "Supermarket receipt"
        })
        self.assertEqual(res_exp.status_code, 201)
        exp_id = res_exp.get_json()["transaction"]["id"]

        print("--- 6. User A updates Budget ---")
        res_bg = self.client.put("/api/budget", headers=headers_a, json={"amount": 30000.0})
        self.assertEqual(res_bg.status_code, 200)
        bg_data = res_bg.get_json()
        self.assertEqual(bg_data["budget"], 30000.0)
        self.assertEqual(bg_data["spent"], 12000.0)
        self.assertEqual(bg_data["remaining"], 18000.0)

        print("--- 7. User A creates Savings Goal & Contributes ---")
        res_sg = self.client.post("/api/savings-goals", headers=headers_a, json={
            "name": "New Laptop",
            "targetAmount": 80000.0,
            "targetDate": "2026-12-15"
        })
        self.assertEqual(res_sg.status_code, 201)
        sg_id = res_sg.get_json()["goal"]["id"]

        res_add_sav = self.client.post(f"/api/savings-goals/{sg_id}/add-savings", headers=headers_a, json={
            "amount": 20000.0
        })
        self.assertEqual(res_add_sav.status_code, 200)
        self.assertEqual(res_add_sav.get_json()["goal"]["savedAmount"], 20000.0)

        print("--- 8. User A Dashboard Summary Verification ---")
        res_dash_a = self.client.get("/api/dashboard/summary", headers=headers_a)
        self.assertEqual(res_dash_a.status_code, 200)
        dash_a = res_dash_a.get_json()
        self.assertEqual(dash_a["totalIncome"], 75000.0)
        self.assertEqual(dash_a["totalExpenses"], 12000.0)
        self.assertEqual(dash_a["balance"], 63000.0)
        self.assertEqual(dash_a["totalSavings"], 20000.0)
        self.assertEqual(dash_a["budget"]["total"], 30000.0)
        self.assertEqual(dash_a["budget"]["spent"], 12000.0)
        self.assertIsNotNone(dash_a["primaryGoal"])
        self.assertEqual(dash_a["primaryGoal"]["name"], "New Laptop")
        self.assertTrue(dash_a["chart"]["hasData"])

        print("--- 9. CRITICAL TEST: User Data Privacy & Isolation (Bob vs Alice) ---")
        # Bob checks transactions -> MUST BE EMPTY
        res_bob_trans = self.client.get("/api/transactions", headers=headers_b)
        self.assertEqual(res_bob_trans.status_code, 200)
        self.assertEqual(len(res_bob_trans.get_json()["transactions"]), 0)

        # Bob checks savings goals -> MUST BE EMPTY
        res_bob_goals = self.client.get("/api/savings-goals", headers=headers_b)
        self.assertEqual(res_bob_goals.status_code, 200)
        self.assertEqual(len(res_bob_goals.get_json()["goals"]), 0)

        # Bob checks dashboard -> MUST BE ZERO
        res_bob_dash = self.client.get("/api/dashboard/summary", headers=headers_b)
        self.assertEqual(res_bob_dash.status_code, 200)
        dash_b = res_bob_dash.get_json()
        self.assertEqual(dash_b["totalIncome"], 0.0)
        self.assertEqual(dash_b["totalExpenses"], 0.0)
        self.assertEqual(dash_b["balance"], 0.0)
        self.assertEqual(dash_b["totalSavings"], 0.0)
        self.assertIsNone(dash_b["primaryGoal"])

        # Bob attempts to UPDATE Alice's transaction -> MUST BE 404 / Forbidden
        res_hack_trans = self.client.put(f"/api/transactions/{exp_id}", headers=headers_b, json={
            "type": "expense",
            "item": "Hacked",
            "category": "Food",
            "amount": 999.0,
            "date": "2026-09-05"
        })
        self.assertEqual(res_hack_trans.status_code, 404)

        # Bob attempts to DELETE Alice's transaction -> MUST BE 404 / Forbidden
        res_del_hack = self.client.delete(f"/api/transactions/{exp_id}", headers=headers_b)
        self.assertEqual(res_del_hack.status_code, 404)

        # Bob attempts to ADD SAVINGS or DELETE Alice's goal -> MUST BE 404 / Forbidden
        res_sav_hack = self.client.post(f"/api/savings-goals/{sg_id}/add-savings", headers=headers_b, json={
            "amount": 100.0
        })
        self.assertEqual(res_sav_hack.status_code, 404)

        res_del_sg_hack = self.client.delete(f"/api/savings-goals/{sg_id}", headers=headers_b)
        self.assertEqual(res_del_sg_hack.status_code, 404)

        print("--- 10. User A Profile and Settings Updates ---")
        res_prof = self.client.patch("/api/user/profile", headers=headers_a, json={
            "name": "Alice W. Cooper"
        })
        self.assertEqual(res_prof.status_code, 200)

        res_sett = self.client.patch("/api/user/settings", headers=headers_a, json={
            "currency": "USD",
            "budget_notifications": False
        })
        self.assertEqual(res_sett.status_code, 200)
        self.assertEqual(res_sett.get_json()["settings"]["currency"], "USD")

        res_me = self.client.get("/api/auth/me", headers=headers_a)
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.get_json()["user"]["name"], "Alice W. Cooper")
        self.assertEqual(res_me.get_json()["user"]["currency"], "USD")
        self.assertEqual(res_me.get_json()["user"]["budget_notifications"], False)

        print("--- 11. User A Reset Financial Data ---")
        res_reset = self.client.post("/api/user/reset-data", headers=headers_a)
        self.assertEqual(res_reset.status_code, 200)

        # Verify transactions wiped for Alice
        res_check_trans = self.client.get("/api/transactions", headers=headers_a)
        self.assertEqual(len(res_check_trans.get_json()["transactions"]), 0)

        # Verify savings wiped for Alice
        res_check_goals = self.client.get("/api/savings-goals", headers=headers_a)
        self.assertEqual(len(res_check_goals.get_json()["goals"]), 0)

        # Verify profile is still preserved
        res_check_me = self.client.get("/api/auth/me", headers=headers_a)
        self.assertEqual(res_check_me.status_code, 200)
        self.assertEqual(res_check_me.get_json()["user"]["email"], "alice@example.com")

        print("[OK] ALL TESTS PASSED! MoneyBloom backend is completely verified with strict user data isolation.")

if __name__ == "__main__":
    unittest.main()
