/* =====================================================
   MONEYBLOOM - API CLIENT & BACKEND INTEGRATION
   ===================================================== */

(function (window) {
    // ---------------------------------------------------------------------------
    // API base URL detection
    //   • Vercel / any production host → same origin (relative URL)
    //   • Local dev served by Flask on port 5000 → same origin (relative URL)
    //   • Local dev opened directly as a file (file://) → fall back to localhost:5000
    // ---------------------------------------------------------------------------
    function resolveApiBase() {
        const proto = window.location.protocol;
        const port  = window.location.port;

        // Opened as a local HTML file — backend must be running on localhost
        if (proto === "file:") {
            return "http://127.0.0.1:5000/api";
        }

        // HTTP/HTTPS — use relative path so it works on any host (Vercel, local Flask, etc.)
        return "/api";
    }

    const API_BASE = resolveApiBase();

    const api = {
        // Token & Session Storage
        getToken() {
            return localStorage.getItem("moneyBloomToken");
        },

        setToken(token) {
            localStorage.setItem("moneyBloomToken", token);
            localStorage.setItem("moneyBloomLoggedIn", "true");
        },

        clearSession() {
            localStorage.removeItem("moneyBloomToken");
            localStorage.removeItem("moneyBloomLoggedIn");
            localStorage.removeItem("moneyBloomCurrentUser");
            localStorage.removeItem("moneyBloomUser");
        },

        getCurrentUser() {
            try {
                return JSON.parse(localStorage.getItem("moneyBloomUser")) || null;
            } catch (e) {
                return null;
            }
        },

        setCurrentUser(user) {
            localStorage.setItem("moneyBloomUser", JSON.stringify(user));
            if (user && user.name) {
                localStorage.setItem("moneyBloomCurrentUser", user.name);
            }
            if (user && user.currency) {
                localStorage.setItem("moneyBloomCurrency", user.currency);
            }
        },

        // Core HTTP Request method
        async request(endpoint, options = {}) {
            const url = `${API_BASE}${endpoint}`;
            const headers = {
                "Content-Type": "application/json",
                ...(options.headers || {})
            };

            const token = this.getToken();
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const config = {
                ...options,
                headers
            };

            let response;
            try {
                response = await fetch(url, config);
            } catch (networkError) {
                console.error("Network error connecting to MoneyBloom API:", networkError);
                throw new Error("Unable to connect to the MoneyBloom server. Please ensure the backend is running at http://127.0.0.1:5000.");
            }

            if (response.status === 401) {
                this.clearSession();
                if (document.body && document.body.dataset && document.body.dataset.protected === "true") {
                    window.location.href = "login.html";
                }
            }

            let result = null;
            const text = await response.text();
            try {
                result = text ? JSON.parse(text) : {};
            } catch (e) {
                result = { message: text };
            }

            if (!response.ok) {
                const message = (result && (result.error || result.message)) || `Request failed with status ${response.status}`;
                throw new Error(message);
            }

            return result;
        },

        // Auth API
        async register(name, email, password) {
            const data = await this.request("/auth/register", {
                method: "POST",
                body: JSON.stringify({ name, email, password })
            });
            if (data.token) {
                this.setToken(data.token);
                this.setCurrentUser(data.user);
            }
            return data;
        },

        async login(email, password) {
            const data = await this.request("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
            });
            if (data.token) {
                this.setToken(data.token);
                this.setCurrentUser(data.user);
            }
            return data;
        },

        async getMe() {
            const data = await this.request("/auth/me", { method: "GET" });
            if (data.user) {
                this.setCurrentUser(data.user);
            }
            return data.user;
        },

        logout() {
            this.clearSession();
            window.location.href = "login.html";
        },

        // Dashboard Summary API
        async getDashboardSummary() {
            return await this.request("/dashboard/summary", { method: "GET" });
        },

        // Transactions API
        async getTransactions(params = {}) {
            const query = new URLSearchParams();
            if (params.type && params.type !== "all") query.append("type", params.type);
            if (params.search) query.append("search", params.search);
            const qs = query.toString() ? `?${query.toString()}` : "";
            const res = await this.request(`/transactions${qs}`, { method: "GET" });
            return res.transactions || [];
        },

        async createTransaction(transaction) {
            return await this.request("/transactions", {
                method: "POST",
                body: JSON.stringify(transaction)
            });
        },

        async updateTransaction(id, transaction) {
            return await this.request(`/transactions/${id}`, {
                method: "PUT",
                body: JSON.stringify(transaction)
            });
        },

        async deleteTransaction(id) {
            return await this.request(`/transactions/${id}`, { method: "DELETE" });
        },

        // Budget API
        async getBudget() {
            return await this.request("/budget", { method: "GET" });
        },

        async updateBudget(amount) {
            return await this.request("/budget", {
                method: "PUT",
                body: JSON.stringify({ amount })
            });
        },

        // Savings Goals API
        async getSavingsGoals() {
            const res = await this.request("/savings-goals", { method: "GET" });
            return res.goals || [];
        },

        async createSavingsGoal(goal) {
            return await this.request("/savings-goals", {
                method: "POST",
                body: JSON.stringify(goal)
            });
        },

        async updateSavingsGoal(id, goal) {
            return await this.request(`/savings-goals/${id}`, {
                method: "PUT",
                body: JSON.stringify(goal)
            });
        },

        async addSavings(id, amount) {
            return await this.request(`/savings-goals/${id}/add-savings`, {
                method: "POST",
                body: JSON.stringify({ amount })
            });
        },

        async deleteSavingsGoal(id) {
            return await this.request(`/savings-goals/${id}`, { method: "DELETE" });
        },

        // Settings & Profile API
        async updateProfile(name) {
            const res = await this.request("/user/profile", {
                method: "PATCH",
                body: JSON.stringify({ name })
            });
            const user = this.getCurrentUser() || {};
            user.name = name;
            this.setCurrentUser(user);
            return res;
        },

        async updateSettings(settings) {
            const res = await this.request("/user/settings", {
                method: "PATCH",
                body: JSON.stringify(settings)
            });
            const user = this.getCurrentUser() || {};
            if (settings.currency) user.currency = settings.currency;
            if (settings.budget_notifications !== undefined) user.budget_notifications = settings.budget_notifications;
            if (settings.savings_notifications !== undefined) user.savings_notifications = settings.savings_notifications;
            this.setCurrentUser(user);
            return res;
        },

        async resetData() {
            return await this.request("/user/reset-data", { method: "POST" });
        }
    };

    api._base = API_BASE;
    window.MoneyBloomAPI = api;
})(window);
