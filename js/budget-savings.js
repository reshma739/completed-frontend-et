/* =====================================================
   MONEYBLOOM - BUDGET & SAVINGS - BACKEND CONNECTED
   ===================================================== */

let editingGoalId = null;
let currentSavingsGoalsList = [];

/* =====================================================
   PAGE LOAD
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {
    loadUserName();
    loadBudget();
    loadSavingsGoals();
});

/* =====================================================
   USER NAME
   ===================================================== */

function loadUserName() {
    const element = document.getElementById("userName");
    if (!element) return;

    let userName = "User";
    if (window.MoneyBloomAPI) {
        const user = window.MoneyBloomAPI.getCurrentUser();
        if (user && user.name) userName = user.name;
    } else {
        try {
            const user = JSON.parse(localStorage.getItem("moneyBloomUser"));
            if (user && user.name) userName = user.name;
        } catch (e) {}
    }

    element.textContent = userName;
}

/* =====================================================
   BUDGET
   ===================================================== */

async function loadBudget() {
    try {
        if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
            const data = await window.MoneyBloomAPI.getBudget();
            updateBudgetDisplayFromAPI(data);
            return;
        }
    } catch (error) {
        console.warn("Could not load budget from API, using fallback:", error.message);
    }

    // Fallback if offline
    let budget = Number(localStorage.getItem("moneyBloomBudget")) || 10000;
    updateBudgetDisplayLocal(budget);
}

function updateBudgetDisplayFromAPI(data) {
    const amountElement = document.getElementById("budgetAmount");
    const spentElement = document.getElementById("budgetSpent");
    const remainingElement = document.getElementById("budgetRemaining");
    const percentageElement = document.getElementById("budgetPercentage");
    const progressElement = document.getElementById("budgetProgress");

    if (amountElement) amountElement.textContent = formatCurrency(data.budget);
    if (spentElement) spentElement.textContent = formatCurrency(data.spent);
    if (remainingElement) remainingElement.textContent = formatCurrency(data.remaining);
    if (percentageElement) percentageElement.textContent = data.percentage + "%";
    if (progressElement) progressElement.style.width = data.percentage + "%";
}

function updateBudgetDisplayLocal(budget) {
    let transactions = [];
    try {
        transactions = JSON.parse(localStorage.getItem("moneyBloomTransactions")) || [];
    } catch (e) {}

    let spent = 0;
    transactions.forEach(t => {
        if (t.type === "expense") spent += Number(t.amount) || 0;
    });

    const remaining = Math.max(budget - spent, 0);
    const percentage = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;

    const amountElement = document.getElementById("budgetAmount");
    const spentElement = document.getElementById("budgetSpent");
    const remainingElement = document.getElementById("budgetRemaining");
    const percentageElement = document.getElementById("budgetPercentage");
    const progressElement = document.getElementById("budgetProgress");

    if (amountElement) amountElement.textContent = formatCurrency(budget);
    if (spentElement) spentElement.textContent = formatCurrency(spent);
    if (remainingElement) remainingElement.textContent = formatCurrency(remaining);
    if (percentageElement) percentageElement.textContent = percentage + "%";
    if (progressElement) progressElement.style.width = percentage + "%";
}

function editBudget() {
    const modal = document.getElementById("budgetModal");
    const input = document.getElementById("budgetInput");
    if (!modal || !input) return;

    // Read current displayed budget amount
    const amountElem = document.getElementById("budgetAmount");
    let currentBudget = 10000;
    if (amountElem) {
        const text = amountElem.textContent.replace(/[^0-9.]/g, "");
        if (text && !isNaN(Number(text))) currentBudget = Number(text);
    }

    input.value = currentBudget;
    modal.classList.add("active");
    input.focus();
    input.select();
}

function closeBudgetModal() {
    const modal = document.getElementById("budgetModal");
    if (modal) modal.classList.remove("active");
}

async function saveBudget() {
    const input = document.getElementById("budgetInput");
    if (!input) return;

    const value = Number(input.value);
    if (isNaN(value) || value <= 0) {
        alert("Please enter a valid budget amount.");
        return;
    }

    try {
        if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
            const updated = await window.MoneyBloomAPI.updateBudget(value);
            updateBudgetDisplayFromAPI(updated);
        } else {
            localStorage.setItem("moneyBloomBudget", String(value));
            updateBudgetDisplayLocal(value);
        }
        closeBudgetModal();
    } catch (error) {
        alert(error.message || "Failed to update budget.");
    }
}

/* =====================================================
   SAVINGS GOALS
   ===================================================== */

async function loadSavingsGoals() {
    const container = document.getElementById("savingsGoals");
    const empty = document.getElementById("savingsEmpty");
    if (!container) return;

    try {
        if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
            currentSavingsGoalsList = await window.MoneyBloomAPI.getSavingsGoals();
            localStorage.setItem("moneyBloomSavingsGoals", JSON.stringify(currentSavingsGoalsList));
            renderGoals(currentSavingsGoalsList);
            return;
        }
    } catch (error) {
        console.warn("Could not load savings goals from API, using fallback:", error.message);
    }

    // Local fallback
    try {
        currentSavingsGoalsList = JSON.parse(localStorage.getItem("moneyBloomSavingsGoals")) || [];
    } catch (e) {
        currentSavingsGoalsList = [];
    }
    renderGoals(currentSavingsGoalsList);
}

function renderGoals(goals) {
    const container = document.getElementById("savingsGoals");
    const empty = document.getElementById("savingsEmpty");
    if (!container) return;

    container.innerHTML = "";

    if (!goals || goals.length === 0) {
        if (empty) empty.style.display = "block";
        return;
    }

    if (empty) empty.style.display = "none";

    goals.forEach(goal => {
        const card = createGoalCard(goal);
        container.appendChild(card);
    });
}

function createGoalCard(goal) {
    const card = document.createElement("div");
    card.className = "goal-card";

    const target = Number(goal.targetAmount) || 0;
    const saved = Number(goal.savedAmount) || 0;
    let percentage = target > 0 ? Math.min(Math.round((saved / target) * 100), 100) : 0;

    // Header
    const header = document.createElement("div");
    header.className = "goal-header";

    const titleArea = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = goal.name || "Savings Goal";

    const date = document.createElement("p");
    date.textContent = "Target date: " + formatDate(goal.targetDate);

    titleArea.appendChild(title);
    titleArea.appendChild(date);

    const actions = document.createElement("div");
    actions.className = "goal-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "✏️";
    editButton.title = "Edit";
    editButton.addEventListener("click", () => editSavingsGoal(goal.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "🗑️";
    deleteButton.title = "Delete";
    deleteButton.addEventListener("click", () => deleteSavingsGoal(goal.id));

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    header.appendChild(titleArea);
    header.appendChild(actions);

    // Amounts
    const amounts = document.createElement("div");
    amounts.className = "goal-amounts";

    const savedBox = document.createElement("div");
    const savedLabel = document.createElement("span");
    savedLabel.textContent = "Saved";
    const savedValue = document.createElement("strong");
    savedValue.textContent = formatCurrency(saved);
    savedBox.appendChild(savedLabel);
    savedBox.appendChild(savedValue);

    const targetBox = document.createElement("div");
    const targetLabel = document.createElement("span");
    targetLabel.textContent = "Target";
    const targetValue = document.createElement("strong");
    targetValue.textContent = formatCurrency(target);
    targetBox.appendChild(targetLabel);
    targetBox.appendChild(targetValue);

    amounts.appendChild(savedBox);
    amounts.appendChild(targetBox);

    // Progress
    const progressArea = document.createElement("div");
    progressArea.className = "goal-progress";

    const track = document.createElement("div");
    track.className = "progress-track";

    const fill = document.createElement("div");
    fill.className = "progress-fill";
    fill.style.width = percentage + "%";

    track.appendChild(fill);

    const percentText = document.createElement("span");
    percentText.textContent = percentage + "%";

    progressArea.appendChild(track);
    progressArea.appendChild(percentText);

    // Footer
    const footer = document.createElement("div");
    footer.className = "goal-footer";

    const amountText = document.createElement("span");
    amountText.textContent = formatCurrency(saved) + " of " + formatCurrency(target);

    const statusText = document.createElement("span");
    if (percentage >= 100) {
        statusText.textContent = "🎉 Goal reached!";
    } else {
        statusText.textContent = percentage + "% complete";
    }

    footer.appendChild(amountText);
    footer.appendChild(statusText);

    // Add Savings Button
    const addSavingsButton = document.createElement("button");
    addSavingsButton.type = "button";
    addSavingsButton.className = "primary-button";
    addSavingsButton.textContent = "+ Add Savings";
    addSavingsButton.addEventListener("click", () => updateSavedAmount(goal.id));

    // Assembly
    card.appendChild(header);
    card.appendChild(amounts);
    card.appendChild(progressArea);
    card.appendChild(footer);
    card.appendChild(addSavingsButton);

    return card;
}

/* =====================================================
   ADD / EDIT SAVINGS MODAL
   ===================================================== */

function openSavingsModal() {
    editingGoalId = null;

    const modal = document.getElementById("savingsModal");
    const title = document.getElementById("savingsModalTitle");
    const button = document.getElementById("goalSubmitButton");
    const form = document.getElementById("savingsForm");

    if (form) form.reset();
    if (title) title.textContent = "Add Savings Goal";
    if (button) button.textContent = "Add Goal";
    if (modal) modal.classList.add("active");
}

function closeSavingsModal() {
    const modal = document.getElementById("savingsModal");
    if (modal) modal.classList.remove("active");
    editingGoalId = null;
}

async function saveSavingsGoal() {
    const nameInput = document.getElementById("goalName");
    const targetInput = document.getElementById("goalTarget");
    const dateInput = document.getElementById("goalDate");
    const submitBtn = document.getElementById("goalSubmitButton");

    if (!nameInput || !targetInput || !dateInput) return;

    const name = nameInput.value.trim();
    const target = Number(targetInput.value);
    const targetDate = dateInput.value;

    if (!name) {
        alert("Please enter a goal name.");
        return;
    }

    if (isNaN(target) || target <= 0) {
        alert("Please enter a valid target amount.");
        return;
    }

    if (!targetDate) {
        alert("Please select a target date.");
        return;
    }

    const payload = {
        name,
        targetAmount: target,
        targetDate
    };

    if (submitBtn) submitBtn.disabled = true;

    try {
        if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
            if (editingGoalId !== null) {
                await window.MoneyBloomAPI.updateSavingsGoal(editingGoalId, payload);
            } else {
                await window.MoneyBloomAPI.createSavingsGoal(payload);
            }
        } else {
            // Local fallback
            if (editingGoalId !== null) {
                const idx = currentSavingsGoalsList.findIndex(g => String(g.id) === String(editingGoalId));
                if (idx !== -1) {
                    currentSavingsGoalsList[idx] = { ...currentSavingsGoalsList[idx], ...payload };
                }
            } else {
                currentSavingsGoalsList.push({ id: Date.now(), savedAmount: 0, ...payload });
            }
            localStorage.setItem("moneyBloomSavingsGoals", JSON.stringify(currentSavingsGoalsList));
        }

        closeSavingsModal();
        await loadSavingsGoals();
    } catch (error) {
        alert(error.message || "Failed to save goal.");
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function editSavingsGoal(id) {
    const goal = currentSavingsGoalsList.find(g => String(g.id) === String(id));
    if (!goal) return;

    editingGoalId = id;

    const nameInput = document.getElementById("goalName");
    const targetInput = document.getElementById("goalTarget");
    const dateInput = document.getElementById("goalDate");
    const title = document.getElementById("savingsModalTitle");
    const button = document.getElementById("goalSubmitButton");
    const modal = document.getElementById("savingsModal");

    if (nameInput) nameInput.value = goal.name || "";
    if (targetInput) targetInput.value = goal.targetAmount || "";
    if (dateInput) dateInput.value = goal.targetDate || "";
    if (title) title.textContent = "Edit Savings Goal";
    if (button) button.textContent = "Save Changes";
    if (modal) modal.classList.add("active");
}

async function deleteSavingsGoal(id) {
    const confirmed = confirm("Are you sure you want to delete this savings goal?");
    if (!confirmed) return;

    try {
        if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
            await window.MoneyBloomAPI.deleteSavingsGoal(id);
        } else {
            currentSavingsGoalsList = currentSavingsGoalsList.filter(g => String(g.id) !== String(id));
            localStorage.setItem("moneyBloomSavingsGoals", JSON.stringify(currentSavingsGoalsList));
        }
        await loadSavingsGoals();
    } catch (error) {
        alert(error.message || "Failed to delete savings goal.");
    }
}

async function updateSavedAmount(id) {
    const goal = currentSavingsGoalsList.find(g => String(g.id) === String(id));
    if (!goal) return;

    const target = Number(goal.targetAmount) || 0;
    const current = Number(goal.savedAmount) || 0;
    const remaining = Math.max(target - current, 0);

    if (remaining <= 0) {
        alert("This savings goal has already been reached.");
        return;
    }

    const input = prompt("How much did you save now?", "");
    if (input === null) return;

    const value = Number(input);
    if (isNaN(value) || value <= 0) {
        alert("Please enter a valid savings amount.");
        return;
    }

    if (value > remaining) {
        alert("You can add up to " + formatCurrency(remaining) + " to reach this goal.");
        return;
    }

    try {
        if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
            await window.MoneyBloomAPI.addSavings(id, value);
        } else {
            goal.savedAmount = current + value;
            localStorage.setItem("moneyBloomSavingsGoals", JSON.stringify(currentSavingsGoalsList));
        }
        await loadSavingsGoals();
    } catch (error) {
        alert(error.message || "Failed to update savings amount.");
    }
}

/* =====================================================
   CURRENCY & DATE FORMATTING
   ===================================================== */

function formatCurrency(amount) {
    const currency = localStorage.getItem("moneyBloomCurrency") || "INR";
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: currency,
            maximumFractionDigits: 2
        }).format(amount);
    } catch (error) {
        const symbols = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
        const sym = symbols[currency] || "₹";
        return sym + Number(amount).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
}

function formatDate(dateString) {
    if (!dateString) return "-";
    const date = new Date(dateString + "T00:00:00");
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

/* =====================================================
   MODAL OUTSIDE CLICK
   ===================================================== */

document.addEventListener("click", function (event) {
    const budgetModal = document.getElementById("budgetModal");
    const savingsModal = document.getElementById("savingsModal");

    if (budgetModal && event.target === budgetModal) {
        closeBudgetModal();
    }

    if (savingsModal && event.target === savingsModal) {
        closeSavingsModal();
    }
});
