/* =====================================================
   MONEYBLOOM - SETTINGS - BACKEND CONNECTED
   ===================================================== */

/* =====================================================
   PAGE LOAD
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {
    loadProfile();
    loadCurrency();
    loadNotificationSettings();
});

/* =====================================================
   LOAD PROFILE
   ===================================================== */

async function loadProfile() {
    const nameInput = document.getElementById("profileName");
    const emailInput = document.getElementById("profileEmail");
    const userName = document.getElementById("userName");

    let user = null;

    if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
        try {
            user = await window.MoneyBloomAPI.getMe();
        } catch (e) {
            console.warn("Could not fetch user from API, falling back to local:", e.message);
        }
    }

    if (!user) {
        try {
            user = JSON.parse(localStorage.getItem("moneyBloomUser"));
        } catch (error) {
            user = null;
        }
    }

    if (!user) return;

    if (nameInput) nameInput.value = user.name || "";
    if (emailInput) emailInput.value = user.email || "";
    if (userName) userName.textContent = user.name || "User";
}

/* =====================================================
   SAVE PROFILE
   ===================================================== */

async function saveProfile() {
    const nameInput = document.getElementById("profileName");
    if (!nameInput) return;

    const name = nameInput.value.trim();
    if (!name) {
        alert("Please enter your name.");
        nameInput.focus();
        return;
    }

    try {
        if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
            await window.MoneyBloomAPI.updateProfile(name);
        } else {
            let user = JSON.parse(localStorage.getItem("moneyBloomUser")) || {};
            user.name = name;
            localStorage.setItem("moneyBloomUser", JSON.stringify(user));
            localStorage.setItem("moneyBloomCurrentUser", name);
        }

        const userName = document.getElementById("userName");
        if (userName) userName.textContent = name;

        alert("Profile updated successfully.");
    } catch (error) {
        alert(error.message || "Failed to update profile.");
    }
}

/* =====================================================
   LOAD CURRENCY
   ===================================================== */

function loadCurrency() {
    const select = document.getElementById("currencySelect");
    if (!select) return;

    let savedCurrency = "INR";
    if (window.MoneyBloomAPI) {
        const user = window.MoneyBloomAPI.getCurrentUser();
        if (user && user.currency) savedCurrency = user.currency;
    }
    if (!savedCurrency || savedCurrency === "INR") {
        savedCurrency = localStorage.getItem("moneyBloomCurrency") || "INR";
    }

    select.value = savedCurrency;
    if (select.value !== savedCurrency) {
        select.value = "INR";
    }
}

/* =====================================================
   SAVE CURRENCY
   ===================================================== */

async function saveCurrency() {
    const select = document.getElementById("currencySelect");
    if (!select) return;

    const currency = select.value;

    try {
        if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
            await window.MoneyBloomAPI.updateSettings({ currency });
        }
        localStorage.setItem("moneyBloomCurrency", currency);
        alert("Currency updated successfully.");
        window.location.reload();
    } catch (error) {
        alert(error.message || "Failed to update currency.");
    }
}

/* =====================================================
   LOAD NOTIFICATION SETTINGS
   ===================================================== */

function loadNotificationSettings() {
    const budgetToggle = document.getElementById("budgetNotifications");
    const savingsToggle = document.getElementById("savingsNotifications");

    let budgetEnabled = true;
    let savingsEnabled = true;

    if (window.MoneyBloomAPI) {
        const user = window.MoneyBloomAPI.getCurrentUser();
        if (user) {
            if (user.budget_notifications !== undefined) budgetEnabled = Boolean(user.budget_notifications);
            if (user.savings_notifications !== undefined) savingsEnabled = Boolean(user.savings_notifications);
        }
    }

    if (budgetToggle) budgetToggle.checked = budgetEnabled;
    if (savingsToggle) savingsToggle.checked = savingsEnabled;

    if (budgetToggle) {
        budgetToggle.addEventListener("change", async function () {
            try {
                if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
                    await window.MoneyBloomAPI.updateSettings({ budget_notifications: budgetToggle.checked });
                }
                localStorage.setItem("moneyBloomBudgetNotifications", String(budgetToggle.checked));
            } catch (err) {
                console.error("Failed to save budget notification setting:", err);
            }
        });
    }

    if (savingsToggle) {
        savingsToggle.addEventListener("change", async function () {
            try {
                if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
                    await window.MoneyBloomAPI.updateSettings({ savings_notifications: savingsToggle.checked });
                }
                localStorage.setItem("moneyBloomSavingsNotifications", String(savingsToggle.checked));
            } catch (err) {
                console.error("Failed to save savings notification setting:", err);
            }
        });
    }
}

/* =====================================================
   CLEAR ALL FINANCIAL DATA
   ===================================================== */

async function clearAllData() {
    const confirmed = confirm(
        "Are you sure you want to clear all financial data?\n\nThis will delete your transactions, budget and savings goals."
    );
    if (!confirmed) return;

    const secondConfirmation = confirm("This action cannot be undone. Continue?");
    if (!secondConfirmation) return;

    try {
        if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
            await window.MoneyBloomAPI.resetData();
        }

        localStorage.removeItem("moneyBloomTransactions");
        localStorage.removeItem("moneyBloomBudget");
        localStorage.removeItem("moneyBloomSavingsGoals");

        alert("All financial data has been cleared.");
        window.location.href = "dashboard.html";
    } catch (error) {
        alert(error.message || "Failed to clear financial data.");
    }
}
