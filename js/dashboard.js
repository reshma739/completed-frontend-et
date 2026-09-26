/* =====================================================
   MONEYBLOOM DASHBOARD - BACKEND CONNECTED
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {
    loadUserName();
    initDashboard();
});

async function initDashboard() {
    try {
        if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
            const summary = await window.MoneyBloomAPI.getDashboardSummary();
            renderDashboardFromSummary(summary);
            return;
        }
    } catch (error) {
        console.warn("Could not load dashboard summary from API, falling back to local:", error.message);
    }

    // Fallback if offline or not logged in
    updateDashboardFallback();
    createIncomeExpenseChartFallback();
}

/* ================= USER NAME ================= */

function loadUserName() {
    let currentUser = localStorage.getItem("moneyBloomCurrentUser");
    const userObj = window.MoneyBloomAPI ? window.MoneyBloomAPI.getCurrentUser() : null;
    if (userObj && userObj.name) {
        currentUser = userObj.name;
    }

    const userNameElement = document.getElementById("userName");
    const welcomeElement = document.getElementById("welcomeMessage");

    if (currentUser) {
        if (userNameElement) userNameElement.textContent = currentUser;
        if (welcomeElement) welcomeElement.textContent = `Welcome back, ${currentUser}! 👋`;
    }
}

/* ================= RENDER FROM API SUMMARY ================= */

function renderDashboardFromSummary(summary) {
    const incomeElement = document.getElementById("incomeAmount");
    const expenseElement = document.getElementById("expenseAmount");
    const balanceElement = document.getElementById("balanceAmount");
    const savingsElement = document.getElementById("savingsAmount");

    if (incomeElement) incomeElement.textContent = formatCurrency(summary.totalIncome);
    if (expenseElement) expenseElement.textContent = formatCurrency(summary.totalExpenses);
    if (balanceElement) balanceElement.textContent = formatCurrency(summary.balance);
    if (savingsElement) savingsElement.textContent = formatCurrency(summary.totalSavings);

    // Budget Summary
    const spentElement = document.getElementById("dashboardBudgetSpent");
    const totalElement = document.getElementById("dashboardBudgetTotal");
    const progress = document.getElementById("dashboardBudgetProgress");
    const text = document.getElementById("dashboardBudgetText");

    const budgetTotal = summary.budget ? summary.budget.total : 0;
    const budgetSpent = summary.budget ? summary.budget.spent : 0;
    const budgetRemaining = summary.budget ? summary.budget.remaining : 0;
    const budgetPct = summary.budget ? summary.budget.percentage : 0;

    if (spentElement) spentElement.textContent = formatCurrency(budgetSpent);
    if (totalElement) totalElement.textContent = formatCurrency(budgetTotal);

    if (progress && text) {
        if (budgetTotal <= 0) {
            progress.style.width = "0%";
            text.textContent = "Set your monthly budget";
        } else {
            progress.style.width = `${budgetPct}%`;
            text.textContent = `${formatCurrency(budgetRemaining)} remaining`;
        }
    }

    // Savings Summary
    renderSavingsGoal(summary.primaryGoal);

    // Income & Expense Chart
    renderChart(summary.chart.months, summary.chart.incomeData, summary.chart.expenseData, summary.chart.hasData);
}

function renderSavingsGoal(goal) {
    const container = document.getElementById("dashboardSavingsContent");
    if (!container) return;

    if (!goal) {
        container.innerHTML = `
            <div class="savings-goal-name">No savings goal yet</div>
            <div class="savings-amounts">
                <strong>₹0</strong>
                <span>/ ₹0</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <p class="progress-text">Add a savings goal to get started.</p>
        `;
        return;
    }

    const target = Number(goal.targetAmount) || 0;
    const saved = Number(goal.savedAmount) || 0;
    const percentage = target > 0 ? Math.min((saved / target) * 100, 100) : 0;

    container.innerHTML = `
        <div class="savings-goal-name">${escapeHTML(goal.name || "Savings Goal")}</div>
        <div class="savings-amounts">
            <strong>${formatCurrency(saved)}</strong>
            <span>/ ${formatCurrency(target)}</span>
        </div>
        <div class="progress-track">
            <div class="progress-fill" style="width: ${percentage}%"></div>
        </div>
        <p class="progress-text">${Math.round(percentage)}% completed</p>
    `;
}

function renderChart(months, incomeData, expenseData, hasData) {
    if (typeof Chart === "undefined") return;

    const canvas = document.getElementById("incomeExpenseChart");
    const emptyMessage = document.getElementById("emptyChartMessage");

    if (!canvas) return;

    if (emptyMessage) {
        emptyMessage.style.display = hasData ? "none" : "block";
    }

    if (window.moneyBloomChart) {
        window.moneyBloomChart.destroy();
    }

    const currencySymbol = getCurrencySymbol();

    window.moneyBloomChart = new Chart(canvas, {
        type: "line",
        data: {
            labels: months,
            datasets: [
                {
                    label: "Income",
                    data: incomeData,
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    borderWidth: 2,
                    tension: 0.35,
                    fill: false
                },
                {
                    label: "Expenses",
                    data: expenseData,
                    borderColor: "#ef4444",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    borderWidth: 2,
                    tension: 0.35,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: "top"
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return currencySymbol + value;
                        }
                    }
                }
            }
        }
    });
}

/* ================= FALLBACK LOGIC ================= */

function getLocalTransactions() {
    try {
        return JSON.parse(localStorage.getItem("moneyBloomTransactions")) || [];
    } catch (e) {
        return [];
    }
}

function getLocalBudget() {
    return Number(localStorage.getItem("moneyBloomBudget")) || 0;
}

function getLocalSavingsGoals() {
    try {
        return JSON.parse(localStorage.getItem("moneyBloomSavingsGoals")) || [];
    } catch (e) {
        return [];
    }
}

function updateDashboardFallback() {
    const transactions = getLocalTransactions();
    let totalIncome = 0;
    let totalExpenses = 0;

    transactions.forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === "income") totalIncome += amt;
        if (t.type === "expense") totalExpenses += amt;
    });

    const balance = totalIncome - totalExpenses;
    const goals = getLocalSavingsGoals();
    const totalSavings = goals.reduce((sum, g) => sum + (Number(g.savedAmount) || 0), 0);

    const incomeElement = document.getElementById("incomeAmount");
    const expenseElement = document.getElementById("expenseAmount");
    const balanceElement = document.getElementById("balanceAmount");
    const savingsElement = document.getElementById("savingsAmount");

    if (incomeElement) incomeElement.textContent = formatCurrency(totalIncome);
    if (expenseElement) expenseElement.textContent = formatCurrency(totalExpenses);
    if (balanceElement) balanceElement.textContent = formatCurrency(balance);
    if (savingsElement) savingsElement.textContent = formatCurrency(totalSavings);

    // Budget
    const budget = getLocalBudget();
    const spentElement = document.getElementById("dashboardBudgetSpent");
    const totalElement = document.getElementById("dashboardBudgetTotal");
    const progress = document.getElementById("dashboardBudgetProgress");
    const text = document.getElementById("dashboardBudgetText");

    if (spentElement) spentElement.textContent = formatCurrency(totalExpenses);
    if (totalElement) totalElement.textContent = formatCurrency(budget);

    if (progress && text) {
        if (budget <= 0) {
            progress.style.width = "0%";
            text.textContent = "Set your monthly budget";
        } else {
            const pct = Math.min((totalExpenses / budget) * 100, 100);
            progress.style.width = `${pct}%`;
            const rem = Math.max(budget - totalExpenses, 0);
            text.textContent = `${formatCurrency(rem)} remaining`;
        }
    }

    renderSavingsGoal(goals[0] || null);
}

function createIncomeExpenseChartFallback() {
    if (typeof Chart === "undefined") return;

    const transactions = getLocalTransactions();
    const canvas = document.getElementById("incomeExpenseChart");
    const emptyMessage = document.getElementById("emptyChartMessage");

    if (!canvas) return;

    const months = [];
    const incomeData = [];
    const expenseData = [];
    const today = new Date();

    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(d.toLocaleString("en-US", { month: "short" }));
        incomeData.push(0);
        expenseData.push(0);
    }

    transactions.forEach(t => {
        if (!t.date) return;
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return;

        const diff = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
        if (diff >= 0 && diff <= 5) {
            const idx = 5 - diff;
            const amt = Number(t.amount) || 0;
            if (t.type === "income") incomeData[idx] += amt;
            if (t.type === "expense") expenseData[idx] += amt;
        }
    });

    const hasData = incomeData.some(v => v > 0) || expenseData.some(v => v > 0);
    renderChart(months, incomeData, expenseData, hasData);
}

/* ================= CURRENCY & UTILS ================= */

function getCurrencySymbol() {
    const currency = localStorage.getItem("moneyBloomCurrency") || "INR";
    const symbols = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
    return symbols[currency] || "₹";
}

function formatCurrency(amount) {
    const currency = localStorage.getItem("moneyBloomCurrency") || "INR";
    const symbol = getCurrencySymbol();
    return symbol + Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
}
