/* =====================================================
   MONEYBLOOM - TRANSACTIONS - BACKEND CONNECTED
   ===================================================== */

let currentTransactionType = "expense";
let editingTransactionId = null;
let currentTransactionsList = [];

/* =====================================================
   PAGE LOAD
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {
    loadUserName();
    loadTransactions();

    const searchInput = document.getElementById("searchTransaction");
    const filterInput = document.getElementById("transactionFilter");

    if (searchInput) searchInput.addEventListener("input", filterTransactions);
    if (filterInput) filterInput.addEventListener("change", filterTransactions);
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
   GET / LOAD TRANSACTIONS
   ===================================================== */

async function loadTransactions() {
    try {
        if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
            currentTransactionsList = await window.MoneyBloomAPI.getTransactions();
            localStorage.setItem("moneyBloomTransactions", JSON.stringify(currentTransactionsList));
            displayTransactions(currentTransactionsList);
            return;
        }
    } catch (error) {
        console.warn("Could not load transactions from API, falling back to local:", error.message);
    }

    // Fallback to localStorage if offline
    try {
        currentTransactionsList = JSON.parse(localStorage.getItem("moneyBloomTransactions")) || [];
    } catch (e) {
        currentTransactionsList = [];
    }
    displayTransactions(currentTransactionsList);
}

function getTransactions() {
    return currentTransactionsList;
}

/* =====================================================
   OPEN MODALS
   ===================================================== */

function openExpenseModal() {
    openTransactionModal("expense");
}

function openIncomeModal() {
    openTransactionModal("income");
}

function openTransactionModal(type) {
    currentTransactionType = type;
    editingTransactionId = null;

    const modal = document.getElementById("transactionModal");
    const form = document.getElementById("transactionForm");
    const title = document.getElementById("modalTitle");
    const button = document.getElementById("saveTransactionButton");

    if (form) form.reset();

    const dateInput = document.getElementById("transactionDate");
    if (dateInput) {
        const today = new Date();
        const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
            .toISOString().split("T")[0];
        dateInput.value = localToday;
    }

    if (title) {
        title.textContent = type === "income" ? "Add Income" : "Add Expense";
    }

    if (button) {
        button.textContent = type === "income" ? "Add Income" : "Add Expense";
    }

    if (modal) {
        modal.classList.remove("hidden");
    }
}

function closeTransactionModal() {
    const modal = document.getElementById("transactionModal");
    if (modal) {
        modal.classList.add("hidden");
    }
    editingTransactionId = null;
}

/* =====================================================
   SAVE TRANSACTION (CREATE OR EDIT)
   ===================================================== */

async function saveTransaction(event) {
    if (event) event.preventDefault();

    const itemInput = document.getElementById("transactionItem");
    const categoryInput = document.getElementById("transactionCategory");
    const amountInput = document.getElementById("transactionAmount");
    const dateInput = document.getElementById("transactionDate");
    const noteInput = document.getElementById("transactionNote");
    const saveButton = document.getElementById("saveTransactionButton");

    if (!itemInput || !categoryInput || !amountInput || !dateInput) return;

    const item = itemInput.value.trim();
    const category = categoryInput.value;
    const amount = Number(amountInput.value);
    const date = dateInput.value;
    const note = noteInput ? noteInput.value.trim() : "";

    // Validation
    if (!item) {
        alert("Please enter an item.");
        itemInput.focus();
        return;
    }

    if (!category) {
        alert("Please select a category.");
        categoryInput.focus();
        return;
    }

    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount.");
        amountInput.focus();
        return;
    }

    if (!date) {
        alert("Please select a date.");
        dateInput.focus();
        return;
    }

    const transactionData = {
        type: currentTransactionType,
        item,
        category,
        amount,
        date,
        note
    };

    if (saveButton) saveButton.disabled = true;

    try {
        if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
            if (editingTransactionId !== null) {
                await window.MoneyBloomAPI.updateTransaction(editingTransactionId, transactionData);
            } else {
                await window.MoneyBloomAPI.createTransaction(transactionData);
            }
        } else {
            // Local fallback
            if (editingTransactionId !== null) {
                const idx = currentTransactionsList.findIndex(t => String(t.id) === String(editingTransactionId));
                if (idx !== -1) {
                    currentTransactionsList[idx] = { ...currentTransactionsList[idx], ...transactionData };
                }
            } else {
                currentTransactionsList.push({ id: Date.now(), ...transactionData });
            }
            localStorage.setItem("moneyBloomTransactions", JSON.stringify(currentTransactionsList));
        }

        closeTransactionModal();
        await loadTransactions();
    } catch (error) {
        alert(error.message || "Failed to save transaction.");
    } finally {
        if (saveButton) saveButton.disabled = false;
    }
}

/* =====================================================
   EDIT TRANSACTION
   ===================================================== */

function editTransaction(id) {
    const transaction = currentTransactionsList.find(item => String(item.id) === String(id));
    if (!transaction) return;

    currentTransactionType = transaction.type;
    editingTransactionId = id;

    const modal = document.getElementById("transactionModal");
    const title = document.getElementById("modalTitle");
    const button = document.getElementById("saveTransactionButton");
    const itemInput = document.getElementById("transactionItem");
    const categoryInput = document.getElementById("transactionCategory");
    const amountInput = document.getElementById("transactionAmount");
    const dateInput = document.getElementById("transactionDate");
    const noteInput = document.getElementById("transactionNote");

    if (itemInput) itemInput.value = transaction.item || "";
    if (categoryInput) categoryInput.value = transaction.category || "";
    if (amountInput) amountInput.value = transaction.amount || "";
    if (dateInput) dateInput.value = transaction.date || "";
    if (noteInput) noteInput.value = transaction.note || "";

    if (title) {
        title.textContent = transaction.type === "income" ? "Edit Income" : "Edit Expense";
    }

    if (button) {
        button.textContent = "Save Changes";
    }

    if (modal) {
        modal.classList.remove("hidden");
    }
}

/* =====================================================
   DELETE TRANSACTION
   ===================================================== */

async function deleteTransaction(id) {
    const confirmed = confirm("Are you sure you want to delete this transaction?");
    if (!confirmed) return;

    try {
        if (window.MoneyBloomAPI && window.MoneyBloomAPI.getToken()) {
            await window.MoneyBloomAPI.deleteTransaction(id);
        } else {
            currentTransactionsList = currentTransactionsList.filter(t => String(t.id) !== String(id));
            localStorage.setItem("moneyBloomTransactions", JSON.stringify(currentTransactionsList));
        }
        await loadTransactions();
    } catch (error) {
        alert(error.message || "Failed to delete transaction.");
    }
}

/* =====================================================
   DISPLAY TRANSACTIONS
   ===================================================== */

function displayTransactions(transactions) {
    const container = document.getElementById("transactionList");
    const empty = document.getElementById("emptyTransactions");

    if (!container) return;

    container.innerHTML = "";

    const count = document.getElementById("transactionCount");
    if (count) {
        count.textContent = `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`;
    }

    if (transactions.length === 0) {
        if (empty) empty.style.display = "block";
        return;
    }

    if (empty) empty.style.display = "none";

    // Newest first
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(transaction => {
        const card = createTransactionCard(transaction);
        container.appendChild(card);
    });
}

/* =====================================================
   CREATE TRANSACTION CARD
   ===================================================== */

function createTransactionCard(transaction) {
    const card = document.createElement("div");
    card.className = "transaction-row";

    // Icon
    const icon = document.createElement("div");
    icon.className = "transaction-type-icon " + transaction.type;
    icon.textContent = transaction.type === "income" ? "📈" : "💸";

    // Details
    const main = document.createElement("div");
    main.className = "transaction-main";

    const details = document.createElement("div");
    details.className = "transaction-details";

    const item = document.createElement("h3");
    item.textContent = transaction.item;

    const info = document.createElement("p");
    info.textContent = transaction.category + " • " + formatDate(transaction.date);

    if (transaction.note) {
        info.textContent += " • " + transaction.note;
    }

    details.appendChild(item);
    details.appendChild(info);

    // Amount & Actions
    const amountArea = document.createElement("div");
    amountArea.className = "transaction-right";

    const amount = document.createElement("strong");
    const sign = transaction.type === "income" ? "+" : "-";
    amount.textContent = sign + formatCurrency(transaction.amount);
    amount.className = transaction.type;

    const actions = document.createElement("div");
    actions.className = "transaction-actions-small";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "✏️";
    editButton.className = "transaction-edit";
    editButton.setAttribute("aria-label", "Edit transaction");
    editButton.title = "Edit";
    editButton.addEventListener("click", () => editTransaction(transaction.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "🗑️";
    deleteButton.className = "transaction-delete";
    deleteButton.setAttribute("aria-label", "Delete transaction");
    deleteButton.title = "Delete";
    deleteButton.addEventListener("click", () => deleteTransaction(transaction.id));

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    amountArea.appendChild(amount);
    amountArea.appendChild(actions);

    main.appendChild(icon);
    main.appendChild(details);

    card.appendChild(main);
    card.appendChild(amountArea);

    return card;
}

/* =====================================================
   SEARCH & FILTER
   ===================================================== */

function filterTransactions() {
    const searchInput = document.getElementById("searchTransaction");
    const filterInput = document.getElementById("transactionFilter");

    const search = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const filter = filterInput ? filterInput.value : "all";

    const filtered = currentTransactionsList.filter(t => {
        const matchesSearch =
            String(t.item || "").toLowerCase().includes(search) ||
            String(t.category || "").toLowerCase().includes(search) ||
            String(t.note || "").toLowerCase().includes(search);

        const matchesFilter = filter === "all" || t.type === filter;
        return matchesSearch && matchesFilter;
    });

    displayTransactions(filtered);
}

/* =====================================================
   EXPORT TRANSACTIONS
   ===================================================== */

function exportTransactions() {
    if (!currentTransactionsList.length) {
        alert("There are no transactions to export.");
        return;
    }

    const headers = ["Type", "Item", "Category", "Amount", "Date", "Note"];
    const rows = currentTransactionsList.map(t => [
        t.type, t.item, t.category, t.amount, t.date, t.note || ""
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "MoneyBloom_Transactions.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
        return sym + Number(amount).toLocaleString("en-IN");
    }
}

function formatDate(dateString) {
    if (!dateString) return "-";
    const date = new Date(dateString + "T00:00:00");
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

/* =====================================================
   CLOSE MODAL LISTENERS
   ===================================================== */

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeTransactionModal();
});

document.addEventListener("click", function (event) {
    const modal = document.getElementById("transactionModal");
    if (modal && event.target === modal) {
        closeTransactionModal();
    }
});
