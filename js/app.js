/* =====================================================
   MONEYBLOOM COMMON APPLICATION LOGIC
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {

    const protectedPage =
        document.body.dataset.protected === "true";

    const token =
        localStorage.getItem("moneyBloomToken");

    const loggedIn =
        localStorage.getItem("moneyBloomLoggedIn") === "true" && Boolean(token);

    if (protectedPage && !loggedIn) {
        window.location.href = "login.html";
        return;
    }

    // Optional: Refresh current user profile if online
    if (protectedPage && window.MoneyBloomAPI) {
        window.MoneyBloomAPI.getMe().catch(function (err) {
            console.warn("Session check:", err.message);
        });
    }

});


/* ================= LOGOUT ================= */

function logout() {

    const confirmed = confirm(
        "Are you sure you want to logout?"
    );

    if (!confirmed) {
        return;
    }

    if (window.MoneyBloomAPI) {
        window.MoneyBloomAPI.logout();
    } else {
        localStorage.removeItem("moneyBloomToken");
        localStorage.removeItem("moneyBloomLoggedIn");
        localStorage.removeItem("moneyBloomCurrentUser");
        localStorage.removeItem("moneyBloomUser");
        window.location.href = "login.html";
    }
}

// Keep protected pages in sync when the login state changes in another tab.
window.addEventListener("storage", function (event) {
    if (event.key === "moneyBloomLoggedIn" && event.newValue !== "true") {
        if (document.body.dataset.protected === "true") {
            window.location.href = "login.html";
        }
    }
});
