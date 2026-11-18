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
const TEAM_LABELS = { beetle: "甲霖的客戶", hoang: "夥伴的客戶" };
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
function updateBadgeAndId(existRecord) {
const badge = document.getElementById("aiCustomerBadge");
const idInput = document.getElementById("aiExistingDocId");
if (existRecord) {
idInput.value = existRecord.id;
badge.innerText = "舊客戶：確認續保";
badge.className = "badge-status badge-old";
} else {
idInput.value = "";
badge.innerText = "全新客戶：自動建檔";
badge.className = "badge-status badge-new";
}
}
document.getElementById("aiPlateNumber").addEventListener("input", () => {
const p = document.getElementById("aiPlateNumber").value;
const n = document.getElementById("aiClientName").value;
const exist = findMatchedRecord(p, n);
updateBadgeAndId(exist);
});
async function handleAiFile(file) {
if (!file) return;
const btn = document.getElementById("aiCameraBtn");
btn.innerText = "辨識中...";
btn.disabled = true;
try {
const b64 = await compressForAi(file);
const pureB64 = b64.split(",")[1];
const apiKey = getStoredApiKey();
const prompt = '解析此車險保單。輸出純JSON格式(勿用Markdown):\n{"clientName":"被保險人姓名","plateNumber":"牌照號碼(大寫英數加破折號)","company":"承保公司簡稱(去除產險二字)","startDate":"保險期間開始日YYYY-MM-DD(民國115年為2026,116年為2027)","vehicleType":"機車 🛵或汽車 🚗","fee":總保險費純數字,"uncompulsory":true若不含強制險否則false}';
const body = {
contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: pureB64 } }] }],
generationConfig: {
temperature: 0.1,
maxOutputTokens: 250
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
document.getElementById("aiClientName").value = extractedName || (exist ? exist.clientName : "");
document.getElementById("aiPlateNumber").value = exist ? exist.plateNumber : extractedPlate;
document.getElementById("aiCompany").value = cleanCompany(parsed.company || (exist ? exist.company : ""));
document.getElementById("aiVehicleType").value = parsed.vehicleType || (exist ? exist.vehicleType : "機車 🛵");
document.getElementById("aiStartDate").value = cleanDate(parsed.startDate) || "";
document.getElementById("aiFee").value = parsed.fee || "";
document.getElementById("aiUncompulsory").checked = !!parsed.uncompulsory;
document.getElementById("aiNote").value = "";
updateBadgeAndId(exist);
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
uncompulsory: document.getElementById("aiUncompulsory").checked,
note: document.getElementById("aiNote").value.trim()
};
try {
if (existId) {
await recordsCol.doc(existId).update(data);
showToast("已完成續保並覆蓋更新！");
} else {
data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
await recordsCol.add({ ...data, team: currentTeam });
showToast("已建立新客戶保單！");
}
closeAiConfirmModal();
} catch (err) {
alert("存檔失敗: " + err.message);
}
});
document.getElementById("manualForm").addEventListener("submit", async (e) => {
e.preventDefault();
const p = document.getElementById("mPlateNumber").value.trim().toUpperCase();
const n = document.getElementById("mClientName").value.trim();
const exist = findMatchedRecord(p, n);
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
uncompulsory: document.getElementById("mUncompulsory").checked,
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
toggleManual();
} catch (err) {
alert("手動儲存失敗: " + err.message);
}
});