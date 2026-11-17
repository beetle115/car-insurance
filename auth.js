// ===== 登入控管：只有登入且被 Firestore 規則允許的帳號才能看到資料 =====
const auth = firebase.auth();
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

const loginOverlay = document.getElementById("loginOverlay");
const loginBtn = document.getElementById("googleLoginBtn");
const loginMsg = document.getElementById("loginMsg");
const userBadge = document.getElementById("userBadge");
const logoutBtn = document.getElementById("logoutBtn");

function setLoginMsg(text, isInfo) {
loginMsg.textContent = text || "";
loginMsg.className = "login-msg" + (isInfo ? " info" : "");
}

// LINE / FB / IG 內建瀏覽器不能用 Google 登入，提示改用 Safari / Chrome
const inAppBrowser = /Line\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent);
if (inAppBrowser) {
setLoginMsg("你目前在 LINE（或 FB）內建瀏覽器，Google 不允許在這裡登入。請點右上角「⋯」→「用預設瀏覽器開啟」（Safari / Chrome）。");
}

const AUTH_ERRORS = {
"auth/operation-not-allowed": "Firebase 尚未開啟 Google 登入（後台設定）。",
"auth/unauthorized-domain": "這個網址尚未加入 Firebase 的授權網域（後台設定）。",
"auth/popup-closed-by-user": "登入視窗被關閉了，請再按一次。",
"auth/cancelled-popup-request": "",
"auth/network-request-failed": "網路連線失敗，請確認網路後再試。"
};

loginBtn.addEventListener("click", async () => {
loginBtn.disabled = true;
setLoginMsg("登入中…", true);
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
try {
await auth.signInWithPopup(provider);
} catch (err) {
if (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment") {
try { await auth.signInWithRedirect(provider); return; } catch (e2) { err = e2; }
}
const msg = AUTH_ERRORS[err.code];
setLoginMsg(msg === undefined ? "登入失敗：" + (err.message || err.code) : msg);
loginBtn.disabled = false;
}
});

auth.getRedirectResult().catch((err) => {
const msg = AUTH_ERRORS[err.code];
if (msg) setLoginMsg(msg);
});

logoutBtn.addEventListener("click", async () => {
if (!confirm("確定要登出嗎？")) return;
await auth.signOut();
});

auth.onAuthStateChanged((user) => {
if (user) {
loginOverlay.classList.add("hidden");
loginBtn.disabled = false;
const name = user.displayName || (user.email || "").split("@")[0];
userBadge.textContent = "👤 " + name;
userBadge.title = user.email || "";
logoutBtn.style.display = "";
startRecordsSync((err) => {
if (err && err.code === "permission-denied") {
setLoginMsg("此帳號（" + (user.email || "") + "）沒有使用權限，請聯絡管理者開通，或換一個帳號登入。");
auth.signOut();
} else {
showToast("資料讀取失敗：" + (err && err.message || "請重新整理"));
}
});
} else {
stopRecordsSyncNow();
renderList();
updateKpis();
userBadge.textContent = "⚡ 連線";
logoutBtn.style.display = "none";
loginOverlay.classList.remove("hidden");
}
});
