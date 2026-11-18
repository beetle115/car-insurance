const firebaseConfig = {
apiKey: "AIzaSyDSY6f7x1OojDowvM8mXhYofJtLBI0NiIM",
authDomain: "codeartifact-omega-ten.vercel.app",
projectId: "carinsurance-d84b5",
storageBucket: "carinsurance-d84b5.firebasestorage.app",
messagingSenderId: "754004537582",
appId: "1:754004537582:web:f31e387d02ca8c39bfc3ff"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const recordsCol = db.collection("car_insurances");
let allRecords = [];
const TEAM_LABELS = { beetle: "甲霖的客戶", hoang: "阮氏秋恒的客戶" };
let currentTeam = "beetle";
let editTempPhotos = [];
const expandedMonths = new Set();
let sharedGeminiKey = "";
function getStoredApiKey() { return sharedGeminiKey || localStorage.getItem("GEMINI_API_KEY") || ""; }
document.getElementById("openApiKeyBtn").addEventListener("click", () => {
document.getElementById("apiKeyInput").value = getStoredApiKey();
document.getElementById("apiKeyModal").classList.add("active");
});
const closeApiKeyModal = () => document.getElementById("apiKeyModal").classList.remove("active");
document.getElementById("cancelApiKeyBtn").addEventListener("click", closeApiKeyModal);
document.getElementById("saveApiKeyBtn").addEventListener("click", async () => {
const v = document.getElementById("apiKeyInput").value.trim();
localStorage.setItem("GEMINI_API_KEY", v);
closeApiKeyModal();
if (!v) { showToast("金鑰已清除"); return; }
try {
await db.doc("config/gemini").set({ key: v, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
sharedGeminiKey = v;
showToast("已設為所有人共用的金鑰！");
} catch (e) {
showToast("金鑰已儲存在這台裝置（只有管理者能設定共用金鑰）");
}
});
function showToast(msg) {
const t = document.getElementById("toast");
t.innerText = msg;
t.className = "show";
setTimeout(() => t.className = "", 2500);
}
const toggleManual = () => document.getElementById("manualFormCard").classList.toggle("active");
document.getElementById("toggleManualBtn").addEventListener("click", toggleManual);
document.getElementById("cancelManualBtn").addEventListener("click", toggleManual);
function triggerAi(type) {
if (!getStoredApiKey()) {
alert("請先點擊右上角「⚙️ 設定 AI 金鑰」！");
document.getElementById("openApiKeyBtn").click();
return;
}
const el = document.getElementById(type === 'camera' ? 'aiCameraInput' : 'aiAlbumInput');
el.value = "";
el.click();
}
document.getElementById("aiCameraBtn").addEventListener("click", () => triggerAi('camera'));
document.getElementById("aiAlbumBtn").addEventListener("click", () => triggerAi('album'));
document.getElementById("editSnapCameraBtn").addEventListener("click", () => {
const el = document.getElementById("editCameraInput");
el.value = "";
el.click();
});
document.getElementById("editPickAlbumBtn").addEventListener("click", () => {
const el = document.getElementById("editAlbumInput");
el.value = "";
el.click();
});
function compressForStorage(file) {
return new Promise((resolve) => {
const reader = new FileReader();
reader.readAsDataURL(file);
reader.onload = (e) => {
const img = new Image();
img.src = e.target.result;
img.onload = () => {
const canvas = document.createElement("canvas");
let w = img.width, h = img.height;
const maxDim = 1000;
if (w > maxDim || h > maxDim) {
if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
else { w = Math.round((w * maxDim) / h); h = maxDim; }
}
canvas.width = w; canvas.height = h;
const ctx = canvas.getContext("2d");
ctx.drawImage(img, 0, 0, w, h);
resolve(canvas.toDataURL("image/jpeg", 0.70));
};
};
});
}
document.getElementById("editCameraInput").addEventListener("change", async (e) => {
if (!e.target.files[0]) return;
const b64 = await compressForStorage(e.target.files[0]);
editTempPhotos.push(b64);
renderEditPhotos();
showToast("已暫存 1 張照片，可繼續拍攝！");
e.target.value = "";
});
document.getElementById("editAlbumInput").addEventListener("change", async (e) => {
const files = Array.from(e.target.files || []);
for (const f of files) {
const b64 = await compressForStorage(f);
editTempPhotos.push(b64);
}
renderEditPhotos();
showToast(`已新增 ${files.length} 張照片！`);
e.target.value = "";
});
function renderEditPhotos() {
const container = document.getElementById("editPhotoGallery");
if (!editTempPhotos.length) {
container.innerHTML = "<span style='font-size:12px;color:#64748b;padding:6px 0;'>尚未加入照片</span>";
return;
}
container.innerHTML = editTempPhotos.map((src, idx) => `
<div class="photo-thumb-wrap">
<img src="${src}" data-index="${idx}" class="preview-edit-thumb" title="點擊放大預覽">
<button type="button" class="photo-del-btn" data-delindex="${idx}" title="刪除照片">✕</button>
</div>
`).join('');
}
document.getElementById("editPhotoGallery").addEventListener("click", (e) => {
const delBtn = e.target.closest("button[data-delindex]");
if (delBtn) {
const idx = parseInt(delBtn.getAttribute("data-delindex"), 10);
editTempPhotos.splice(idx, 1);
renderEditPhotos();
return;
}
const thumb = e.target.closest("img.preview-edit-thumb");
if (thumb) {
const idx = parseInt(thumb.getAttribute("data-index"), 10);
openLightbox(editTempPhotos[idx]);
}
});
let currentLightboxSrc = "";
let lightboxPhotosList = [];
let currentLightboxIndex = 0;
function openLightboxWithList(photos, startIndex = 0) {
if (!photos || photos.length === 0) return;
lightboxPhotosList = photos;
currentLightboxIndex = startIndex;
updateLightboxDisplay();
document.getElementById("lightboxModal").classList.add("active");
}
function updateLightboxDisplay() {
if (!lightboxPhotosList.length) return;
if (currentLightboxIndex < 0) currentLightboxIndex = 0;
if (currentLightboxIndex >= lightboxPhotosList.length) currentLightboxIndex = lightboxPhotosList.length - 1;
currentLightboxSrc = lightboxPhotosList[currentLightboxIndex];
document.getElementById("lightboxImg").src = currentLightboxSrc;
document.getElementById("lightboxCounter").innerText = `第 ${currentLightboxIndex + 1} / ${lightboxPhotosList.length} 張`;
const prevBtn = document.getElementById("lightboxPrevBtn");
const nextBtn = document.getElementById("lightboxNextBtn");
const thumbsBar = document.getElementById("lightboxThumbsBar");
if (lightboxPhotosList.length <= 1) {
prevBtn.style.display = "none";
nextBtn.style.display = "none";
thumbsBar.innerHTML = "";
} else {
prevBtn.style.display = "flex";
nextBtn.style.display = "flex";
thumbsBar.innerHTML = lightboxPhotosList.map((src, idx) => `
<img src="${src}" class="lightbox-thumb ${idx === currentLightboxIndex ? 'active' : ''}" data-idx="${idx}">
`).join('');
}
}
document.getElementById("lightboxPrevBtn").addEventListener("click", () => {
if (currentLightboxIndex > 0) {
currentLightboxIndex--;
} else {
currentLightboxIndex = lightboxPhotosList.length - 1; // 循環到最後一張
}
updateLightboxDisplay();
});
document.getElementById("lightboxNextBtn").addEventListener("click", () => {
if (currentLightboxIndex < lightboxPhotosList.length - 1) {
currentLightboxIndex++;
} else {
currentLightboxIndex = 0; // 循環回第一張
}
updateLightboxDisplay();
});
document.getElementById("lightboxThumbsBar").addEventListener("click", (e) => {
const thumb = e.target.closest("img.lightbox-thumb");
if (thumb) {
const idx = parseInt(thumb.getAttribute("data-idx"), 10);
currentLightboxIndex = idx;
updateLightboxDisplay();
}
});
const closeLightbox = () => document.getElementById("lightboxModal").classList.remove("active");
document.getElementById("lightboxCloseBtn").addEventListener("click", closeLightbox);
document.getElementById("lightboxOpenNewTabBtn").addEventListener("click", () => {
if (!currentLightboxSrc) return;
const w = window.open("");
w.document.write(`<img src="${currentLightboxSrc}" style="max-width:100%;height:auto;display:block;margin:auto;">`);
});
document.getElementById("editPhotoGallery").addEventListener("click", (e) => {
const delBtn = e.target.closest("button[data-delindex]");
if (delBtn) {
const idx = parseInt(delBtn.getAttribute("data-delindex"), 10);
editTempPhotos.splice(idx, 1);
renderEditPhotos();
return;
}
const thumb = e.target.closest("img.preview-edit-thumb");
if (thumb) {
const idx = parseInt(thumb.getAttribute("data-index"), 10);
openLightboxWithList(editTempPhotos, idx);
}
});
function compressForAi(file) {
return new Promise((resolve) => {
const reader = new FileReader();
reader.readAsDataURL(file);
reader.onload = (e) => {
const img = new Image();
img.src = e.target.result;
img.onload = () => {
const canvas = document.createElement("canvas");
let w = img.width, h = img.height;
if (w > 900) { h = Math.round((h * 900) / w); w = 900; }
canvas.width = w; canvas.height = h;
const ctx = canvas.getContext("2d");
ctx.drawImage(img, 0, 0, w, h);
resolve(canvas.toDataURL("image/jpeg", 0.65));
};
};
});
}
function cleanCompany(c) {
return (c || "").replace(/(產物保險股份有限公司|產物保險|產險|股份有限公司|保險)/g, "").trim() || "富邦";
}
function cleanDate(dStr) {
if (!dStr) return "";
let m = dStr.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
m = dStr.match(/(\d{2,3})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
if (m) {
let yr = parseInt(m[1], 10) + 1911;
return `${yr}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}
return "";
}
function findMatchedRecord(extractedPlate, extractedName) {
if (!extractedPlate && !extractedName) return null;
const cleanPlate = (extractedPlate || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
const numOnly = cleanPlate.replace(/[^0-9]/g, "");
let hit = allRecords.find(r => (r.plateNumber || "").replace(/[^A-Z0-9]/gi, "").toUpperCase() === cleanPlate);
if (hit) return hit;
if (extractedName && numOnly.length >= 3) {
hit = allRecords.find(r => {
const rName = (r.clientName || "").trim();
const rNum = (r.plateNumber || "").replace(/[^0-9]/g, "");
return rName === extractedName.trim() && rNum === numOnly;
});
if (hit) return hit;
}
if (numOnly.length >= 3) {
hit = allRecords.find(r => {
const rPlate = (r.plateNumber || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
const rNum = rPlate.replace(/[^0-9]/g, "");
if (rNum !== numOnly) return false;
if (rPlate.length === cleanPlate.length) {
let diff = 0;
for (let i = 0; i < cleanPlate.length; i++) {
if (cleanPlate[i] !== rPlate[i]) diff++;
}
return diff <= 1;
}
return false;
});
if (hit) return hit;
}
return null;
}
// ===== 新／舊客戶切換 =====
const normPlate = (p) => (p || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
let aiMatched = null;        // 比對到的舊客戶（可能是車牌差一個字的相似車牌）
let aiMode = "new";          // "new" 新客戶建檔／"old" 舊客戶續保
let aiModeLocked = false;    // 使用者手動選過，就不再自動切換
let aiExtractedPlate = "";   // AI 原始辨識的車牌

function refreshAiMatch() {
const p = document.getElementById("aiPlateNumber").value;
const n = document.getElementById("aiClientName").value;
// 舊客戶模式下，車牌欄顯示的是舊客戶車牌，比對時改用 AI 原始車牌，避免互相影響
aiMatched = findMatchedRecord(p, n) || (aiExtractedPlate ? findMatchedRecord(aiExtractedPlate, n) : null);
if (!aiModeLocked) {
const exact = aiMatched && normPlate(aiMatched.plateNumber) === normPlate(p);
const sameName = aiMatched && n.trim() && (aiMatched.clientName || "").trim() === n.trim();
aiMode = aiMatched && (exact || sameName) ? "old" : "new";
}
renderAiMode();
}

function renderAiMode() {
const badge = document.getElementById("aiCustomerBadge");
const idInput = document.getElementById("aiExistingDocId");
const hint = document.getElementById("aiMatchHint");
document.getElementById("aiModeNew").classList.toggle("active", aiMode === "new");
document.getElementById("aiModeOld").classList.toggle("active", aiMode === "old");
const m = aiMatched;
const desc = m ? `${m.clientName || "（無姓名）"}｜${m.plateNumber || ""}｜${m.company || ""}` : "";
if (aiMode === "old" && m) {
idInput.value = m.id;
badge.innerText = "舊客戶：確認續保";
badge.className = "badge-status badge-old";
const curName = document.getElementById("aiClientName").value.trim();
const nameDiff = curName && m.clientName && m.clientName.trim() !== curName;
hint.className = nameDiff ? "cust-hint warn" : "cust-hint ok";
hint.innerText = nameDiff
? `⚠️ 姓名不同（舊資料：${m.clientName}／這次：${curName}）。如果是新客戶，請按「🆕 新客戶建檔」`
: `將更新舊客戶：${desc}`;
} else {
idInput.value = "";
badge.innerText = "全新客戶：自動建檔";
badge.className = "badge-status badge-new";
if (aiMode === "old" && !m) {
hint.className = "cust-hint warn";
hint.innerText = "找不到相符的舊客戶，存檔時會建立為新客戶";
} else if (m) {
hint.className = "cust-hint info";
hint.innerText = `有相似的舊客戶：${desc}。如果是同一位，請切到「舊客戶續保」`;
} else {
hint.className = "cust-hint";
hint.innerText = "";
}
}
}

function setAiMode(mode) {
aiMode = mode;
aiModeLocked = true;
const plateEl = document.getElementById("aiPlateNumber");
if (mode === "old" && aiMatched) {
plateEl.value = aiMatched.plateNumber;
} else if (mode === "new" && aiMatched && normPlate(plateEl.value) === normPlate(aiMatched.plateNumber) && aiExtractedPlate) {
plateEl.value = aiExtractedPlate;   // 改回 AI 辨識的車牌，不沿用舊客戶的
}
renderAiMode();
}
document.getElementById("aiModeNew").addEventListener("click", () => setAiMode("new"));
document.getElementById("aiModeOld").addEventListener("click", () => setAiMode("old"));
document.getElementById("aiPlateNumber").addEventListener("input", refreshAiMatch);
document.getElementById("aiClientName").addEventListener("input", refreshAiMatch);
let aiPhotoTemp = null;   // 這次 AI 辨識的保單照片，存檔時一併保存
async function handleAiFile(file) {
if (!file) return;
const btn = document.getElementById("aiCameraBtn");
btn.innerText = "辨識中...";
btn.disabled = true;
try {
const b64 = await compressForAi(file);
aiPhotoTemp = await compressForStorage(file);
const pureB64 = b64.split(",")[1];
const apiKey = getStoredApiKey();
const prompt = '解析此車險保單。輸出純JSON格式(勿用Markdown):\n{"clientName":"被保險人姓名","plateNumber":"牌照號碼(大寫英數加破折號)","company":"承保公司簡稱(去除產險二字)","startDate":"保險期間開始日YYYY-MM-DD(民國115年為2026,116年為2027)","vehicleType":"機車 🛵或汽車 🚗","endDate":"任意險保險期間到期日YYYY-MM-DD","fee":總保險費純數字(任意險加強制險合計),"hasCompulsory":true若有強制汽(機)車責任保險否則false,"compulsoryStartDate":"強制險保險期間開始日YYYY-MM-DD,沒有填空字串","compulsoryEndDate":"強制險保險期間到期日YYYY-MM-DD,沒有填空字串"' + COVERAGE_PROMPT + '}\n注意:startDate/endDate取任意險(車體、第三人責任等)的保險期間;若只有強制險則填強制險期間。';
const body = {
contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: pureB64 } }] }],
generationConfig: {
temperature: 0.1,
maxOutputTokens: 1500
}
};
const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent", {
method: "POST",
headers: {
"Content-Type": "application/json",
"x-goog-api-key": apiKey
},
body: JSON.stringify(body)
});
if (!resp.ok) {
const err = await resp.json();
throw new Error(err.error?.message || "辨識請求失敗");
}
const data = await resp.json();
let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
text = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
const parsed = JSON.parse(text);
const extractedName = (parsed.clientName || "").trim();
const extractedPlate = (parsed.plateNumber || "").trim().toUpperCase();
const exist = findMatchedRecord(extractedPlate, extractedName);
aiExtractedPlate = extractedPlate;
aiModeLocked = false;
document.getElementById("aiClientName").value = extractedName || (exist ? exist.clientName : "");
document.getElementById("aiPlateNumber").value = extractedPlate;
document.getElementById("aiCompany").value = cleanCompany(parsed.company || (exist ? exist.company : ""));
document.getElementById("aiVehicleType").value = parsed.vehicleType || (exist ? exist.vehicleType : "機車 🛵");
document.getElementById("aiStartDate").value = cleanDate(parsed.startDate) || "";
document.getElementById("aiFee").value = parsed.fee || "";
writeComp("ai", compFromAi(parsed));
setAiCoverage(parsed);
document.getElementById("aiNote").value = "";
refreshAiMatch();
if (aiMode === "old" && aiMatched) document.getElementById("aiPlateNumber").value = aiMatched.plateNumber;
document.getElementById("aiConfirmModal").classList.add("active");
} catch (err) {
alert("辨識失敗：" + err.message);
} finally {
btn.innerText = "📸 拍照歸檔";
btn.disabled = false;
}
}
document.getElementById("aiCameraInput").addEventListener("change", (e) => handleAiFile(e.target.files[0]));
document.getElementById("aiAlbumInput").addEventListener("change", (e) => handleAiFile(e.target.files[0]));
const closeAiConfirmModal = () => document.getElementById("aiConfirmModal").classList.remove("active");
document.getElementById("closeAiModalBtn").addEventListener("click", closeAiConfirmModal);
document.getElementById("cancelAiModalBtn").addEventListener("click", closeAiConfirmModal);
document.getElementById("aiConfirmForm").addEventListener("submit", async (e) => {
e.preventDefault();
const existId = document.getElementById("aiExistingDocId").value;
const sDate = document.getElementById("aiStartDate").value;
const feeVal = Number(document.getElementById("aiFee").value) || 0;
const data = {
clientName: document.getElementById("aiClientName").value.trim(),
plateNumber: document.getElementById("aiPlateNumber").value.trim().toUpperCase(),
company: cleanCompany(document.getElementById("aiCompany").value.trim()),
vehicleType: document.getElementById("aiVehicleType").value,
startDate: sDate,
expiryDate: sDate,
fee: feeVal,
premium: feeVal,
...readComp("ai"),
...(aiCoverageTemp && coverageCount(aiCoverageTemp) ? { coverage: aiCoverageTemp, coverageCount: coverageCount(aiCoverageTemp) } : {}),
note: document.getElementById("aiNote").value.trim()
};
let photoNote = "";
if (aiPhotoTemp) {
const old = existId ? allRecords.find(r => r.id === existId) : null;
const oldPhotos = old ? (Array.isArray(old.photos) ? old.photos : (old.photo ? [old.photo] : [])) : [];
const merged = oldPhotos.concat([aiPhotoTemp]);
// Firestore 單筆上限約 1MB，照片太多時保留最新的幾張
while (merged.length > 1 && JSON.stringify({ ...(old || {}), ...data, photos: merged }).length > 900000) merged.shift();
data.photos = merged;
photoNote = merged.length < oldPhotos.length + 1 ? "（照片較多，已移除最舊的照片）" : "，保單照片已保存";
}
try {
if (existId) {
await recordsCol.doc(existId).update(data);
showToast("已完成續保並覆蓋更新" + photoNote + "！");
} else {
data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
await recordsCol.add({ ...data, team: currentTeam });
showToast("已建立新客戶保單" + photoNote + "！");
}
aiPhotoTemp = null;
closeAiConfirmModal();
} catch (err) {
alert("存檔失敗: " + err.message);
}
});
document.getElementById("manualForm").addEventListener("submit", async (e) => {
e.preventDefault();
const p = document.getElementById("mPlateNumber").value.trim().toUpperCase();
const n = document.getElementById("mClientName").value.trim();
const exist = allRecords.find(r => normPlate(r.plateNumber) === normPlate(p)) || null;
const sDate = document.getElementById("mStartDate").value;
const feeVal = Number(document.getElementById("mFee").value) || 0;
const data = {
clientName: n,
plateNumber: p,
company: cleanCompany(document.getElementById("mCompany").value.trim()),
vehicleType: document.getElementById("mVehicleType").value,
startDate: sDate,
expiryDate: sDate,
fee: feeVal,
premium: feeVal,
...readComp("m"),
note: document.getElementById("mNote").value.trim()
};
try {
if (exist) {
await recordsCol.doc(exist.id).update(data);
showToast("舊客戶資料已覆蓋更新！");
} else {
data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
await recordsCol.add({ ...data, team: currentTeam });
showToast("新客戶已建立！");
}
document.getElementById("manualForm").reset();
writeComp("m", { has: true, aligned: true, compStart: "" });
toggleManual();
} catch (err) {
alert("手動儲存失敗: " + err.message);
}
});