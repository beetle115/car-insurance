// ===== 客戶資料卡（profiles）＋ 投保內容（coverage）=====
const profilesCol = db.collection("profiles");
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";
const escHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function geminiJSON(prompt, b64List, maxTokens) {
const apiKey = getStoredApiKey();
if (!apiKey) throw new Error("尚未設定 Gemini 金鑰");
const parts = [{ text: prompt }].concat(b64List.map(b => ({ inline_data: { mime_type: "image/jpeg", data: b.split(",")[1] } })));
const resp = await fetch(GEMINI_URL, {
method: "POST",
headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens || 800 } })
});
if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error?.message || "辨識請求失敗"); }
const data = await resp.json();
let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
text = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
return JSON.parse(text);
}

function compressImage(file, maxDim, quality) {
return new Promise((resolve) => {
const reader = new FileReader();
reader.readAsDataURL(file);
reader.onload = (e) => {
const img = new Image();
img.src = e.target.result;
img.onload = () => {
let w = img.width, h = img.height;
if (w > maxDim || h > maxDim) { if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; } else { w = Math.round(w * maxDim / h); h = maxDim; } }
const c = document.createElement("canvas"); c.width = w; c.height = h;
c.getContext("2d").drawImage(img, 0, 0, w, h);
resolve(c.toDataURL("image/jpeg", quality));
};
};
});
}

// ---------- 投保內容 ----------
const COVERAGE_ITEMS = [
{ key: "body", name: "車體險", short: "車體", hasType: true, ph: "保額，例：31.8萬" },
{ key: "tpBodily", name: "第三人責任－體傷", short: "第三人體傷", ph: "例：每人200萬/每事故2000萬" },
{ key: "tpProperty", name: "第三人責任－財損", short: "財損", ph: "例：20萬" },
{ key: "excess", name: "超額責任", short: "超額", ph: "例：1000萬" },
{ key: "driver", name: "駕駛人傷害", short: "駕駛人", ph: "例：200萬" },
{ key: "rental", name: "代步費用", short: "代步", ph: "例：每日1000元" },
{ key: "passenger", name: "乘客險", short: "乘客", ph: "例：每人200萬/每事故800萬" },
{ key: "consolation", name: "慰問金", short: "慰問金", ph: "例：每人5萬" },
{ key: "legal", name: "訴訟費用", short: "訴訟", ph: "例：20萬" },
{ key: "tow", name: "道路救援／拖吊", short: "拖吊", ph: "例：100公里" },
{ key: "other", name: "其他", short: "其他", ph: "自由填寫" }
];
const BODY_TYPES = ["甲式", "乙式", "丙式"];

function normalizeCoverage(raw) {
const out = {};
if (!raw || typeof raw !== "object") return out;
COVERAGE_ITEMS.forEach(it => {
const v = raw[it.key];
if (!v) return;
const on = typeof v === "object" ? !!v.on : !!v;
if (!on) return;
const o = { on: true, amount: typeof v === "object" ? String(v.amount || "").trim() : "" };
if (it.hasType) { const t = String(v.type || ""); o.type = BODY_TYPES.find(b => t.includes(b[0])) || ""; }
out[it.key] = o;
});
return out;
}
function coverageCount(cov) { return Object.values(cov || {}).filter(v => v && v.on).length; }
function coverageChips(cov) {
return COVERAGE_ITEMS.filter(it => cov && cov[it.key] && cov[it.key].on)
.map(it => it.key === "body" && cov.body.type ? `車體${cov.body.type}` : it.short);
}

// AI 建檔時一併讀出的投保內容（由 core.js 的辨識流程填入）
let aiCoverageTemp = null;
const COVERAGE_PROMPT = ',"coverage":{"body":{"on":有無車體損失險(含車對車碰撞),"type":"甲式/乙式/丙式","amount":"保額"},"tpBodily":{"on":有無第三人責任傷害,"amount":"每人/每事故"},"tpProperty":{"on":有無第三人責任財損,"amount":""},"excess":{"on":有無超額責任,"amount":""},"driver":{"on":有無駕駛人傷害,"amount":""},"rental":{"on":有無代步費用,"amount":""},"passenger":{"on":有無乘客體傷/乘客險,"amount":""},"consolation":{"on":有無慰問金/慰問保險金,"amount":""},"legal":{"on":有無訴訟/律師費用,"amount":""},"tow":{"on":有無道路救援/拖吊,"amount":""},"other":{"on":有無其他附加險,"amount":"險種名稱與保額"}}';
function setAiCoverage(parsed) {
aiCoverageTemp = normalizeCoverage(parsed && parsed.coverage);
const el = document.getElementById("aiCoverageSummary");
if (!el) return;
const chips = coverageChips(aiCoverageTemp);
el.innerText = chips.length ? `投保內容：辨識到 ${chips.length} 項（${chips.join("、")}）` : "投保內容：未辨識到險種，可存檔後在「投保」裡補上";
}

let covRecordId = null;
function openCoverageModal(id) {
const r = allRecords.find(x => x.id === id);
if (!r) return;
covRecordId = id;
const cov = r.coverage || {};
const cs = compState(r);
document.getElementById("covTitle").innerText = `${r.clientName || ""}｜${r.plateNumber || ""}｜${r.company || ""}｜${r.startDate || ""} 起保`;
document.getElementById("covCompulsory").innerText = !cs.has ? "強制險：未含" : cs.aligned ? "強制險：有（已切齊）" : `強制險：有（未切齊${cs.compStart ? "，" + fmtRocMD(cs.compStart) + " 起保" : ""}）`;
document.getElementById("covList").innerHTML = COVERAGE_ITEMS.map(it => {
const v = cov[it.key] || {};
const typeSel = it.hasType ? `<select class="cov-type" data-key="${it.key}">${["", ...BODY_TYPES].map(t => `<option value="${t}" ${v.type === t ? "selected" : ""}>${t || "式別"}</option>`).join("")}</select>` : "";
return `<div class="cov-row ${v.on ? "on" : ""}" data-key="${it.key}">
<label class="cov-check"><input type="checkbox" data-key="${it.key}" ${v.on ? "checked" : ""}><span class="cov-box"></span><span class="cov-name">${it.name}</span></label>
<div class="cov-fields">${typeSel}<input type="text" class="cov-amount" data-key="${it.key}" value="${escHtml(v.amount || "")}" placeholder="${it.ph}"></div>
</div>`;
}).join("");
document.getElementById("covNote").value = r.coverageNote || "";
refreshCovSummary();
document.getElementById("coverageModal").classList.add("active");
}
function readCoverageForm() {
const out = {};
COVERAGE_ITEMS.forEach(it => {
const on = document.querySelector(`#covList input[type=checkbox][data-key="${it.key}"]`).checked;
if (!on) return;
const o = { on: true, amount: document.querySelector(`#covList .cov-amount[data-key="${it.key}"]`).value.trim() };
if (it.hasType) o.type = document.querySelector(`#covList .cov-type[data-key="${it.key}"]`).value;
out[it.key] = o;
});
return out;
}
function refreshCovSummary() {
const cov = readCoverageForm();
const chips = coverageChips(cov);
document.getElementById("covCount").innerText = `已投保 ${chips.length} 項`;
document.getElementById("covChips").innerHTML = chips.length ? chips.map(c => `<span class="cov-chip">${escHtml(c)}</span>`).join("") : `<span style="color:#94a3b8;font-size:12px;">尚未記錄投保內容（舊資料續保重新拍照建檔時會自動帶入）</span>`;
document.querySelectorAll("#covList .cov-row").forEach(row => {
row.classList.toggle("on", !!cov[row.getAttribute("data-key")]);
});
}
document.getElementById("covList").addEventListener("change", refreshCovSummary);
document.getElementById("covList").addEventListener("input", (e) => {
if (e.target.classList.contains("cov-amount") && e.target.value.trim()) {
const cb = document.querySelector(`#covList input[type=checkbox][data-key="${e.target.getAttribute("data-key")}"]`);
if (cb && !cb.checked) { cb.checked = true; refreshCovSummary(); }
}
});
const closeCoverageModal = () => document.getElementById("coverageModal").classList.remove("active");
document.getElementById("closeCoverageBtn").addEventListener("click", closeCoverageModal);
document.getElementById("cancelCoverageBtn").addEventListener("click", closeCoverageModal);
document.getElementById("saveCoverageBtn").addEventListener("click", async () => {
if (!covRecordId) return;
const cov = readCoverageForm();
try {
await recordsCol.doc(covRecordId).update({ coverage: cov, coverageCount: coverageCount(cov), coverageNote: document.getElementById("covNote").value.trim() });
closeCoverageModal();
showToast("投保內容已儲存！");
} catch (e) { alert("儲存失敗：" + e.message); }
});

// ---------- 客戶資料卡 ----------
const PROFILE_FIELDS = ["pName", "pBirth", "pGender", "pPhone", "pLine", "pEmail", "pAddress", "pReferrer", "pNote", "pOwner", "pPlate", "pModel", "pMfg", "pCc", "pIssue", "pEngine", "pChassis"];
const PROFILE_SOURCES = ["轉介紹", "網路", "自己客戶", "其他"];
let profRecord = null;
let profIdNo = "";
let profShowId = false;
let profSource = "";
let profPhotos = [];      // {id?, label, data}
let profDeleted = [];     // 已存檔、要刪除的照片 id

function maskId(v) { return v && v.length >= 6 ? v.slice(0, 3) + "****" + v.slice(-3) : v; }
function renderIdField() {
const el = document.getElementById("pIdNo");
el.value = profShowId ? profIdNo : maskId(profIdNo);
el.readOnly = !profShowId;
document.getElementById("pIdToggle").innerText = profShowId ? "隱藏" : "顯示";
}
function renderSources() {
document.querySelectorAll("#pSources button").forEach(b => b.classList.toggle("active", b.getAttribute("data-src") === profSource));
}
function renderProfPhotos() {
const box = document.getElementById("pPhotos");
if (!profPhotos.length) { box.innerHTML = `<span style="font-size:12px;color:#64748b;">尚未上傳證件照片</span>`; return; }
box.innerHTML = profPhotos.map((p, i) => `<div class="prof-thumb"><img src="${p.data}" data-idx="${i}" alt="${escHtml(p.label)}"><button type="button" class="photo-del-btn" data-del="${i}" title="刪除照片">✕</button><span>${escHtml(p.label)}</span></div>`).join("");
}

async function openProfileModal(id) {
const r = allRecords.find(x => x.id === id);
if (!r) return;
profRecord = r;
profPhotos = []; profDeleted = []; profShowId = false; profSource = ""; profIdNo = "";
PROFILE_FIELDS.forEach(f => { document.getElementById(f).value = ""; });
document.getElementById("pName").value = r.clientName || "";
document.getElementById("pPlate").value = r.plateNumber || "";
document.getElementById("profTitle").innerText = `${r.clientName || ""}｜${r.plateNumber || ""}｜${TEAM_LABELS[r.team] || ""}`;
document.getElementById("pAiMsg").innerText = "";
renderIdField(); renderSources(); renderProfPhotos();
document.getElementById("profileModal").classList.add("active");
document.getElementById("pPhotos").innerHTML = `<span style="font-size:12px;color:#94a3b8;">載入中…</span>`;
try {
const snap = await profilesCol.doc(id).get();
if (snap.exists) {
const d = snap.data();
PROFILE_FIELDS.forEach(f => { if (d[f] !== undefined) document.getElementById(f).value = d[f]; });
profIdNo = d.pIdNo || ""; profSource = d.pSource || "";
renderIdField(); renderSources();
}
const ps = await profilesCol.doc(id).collection("photos").where("team", "==", r.team || currentTeam).get();
profPhotos = ps.docs.map(x => ({ id: x.id, label: x.data().label || "照片", data: x.data().data, at: x.data().createdAt })).sort((a, b) => (a.at?.seconds || 0) - (b.at?.seconds || 0));
} catch (e) {
document.getElementById("pAiMsg").innerText = "資料卡讀取失敗：" + e.message;
}
renderProfPhotos();
}

document.getElementById("pIdToggle").addEventListener("click", () => {
if (profShowId) profIdNo = document.getElementById("pIdNo").value.trim().toUpperCase();
profShowId = !profShowId; renderIdField();
});
document.getElementById("pSources").addEventListener("click", (e) => {
const b = e.target.closest("button[data-src]"); if (!b) return;
profSource = profSource === b.getAttribute("data-src") ? "" : b.getAttribute("data-src"); renderSources();
});
document.getElementById("pPhotos").addEventListener("click", (e) => {
const del = e.target.closest("button[data-del]");
if (del) {
const i = Number(del.getAttribute("data-del"));
if (!confirm(`刪除這張「${profPhotos[i].label}」照片？`)) return;
if (profPhotos[i].id) profDeleted.push(profPhotos[i].id);
profPhotos.splice(i, 1); renderProfPhotos(); return;
}
const img = e.target.closest("img[data-idx]");
if (img) openLightboxWithList(profPhotos.map(p => p.data), Number(img.getAttribute("data-idx")));
});

const PROFILE_AI_PROMPT = '這是台灣的證件照片（身分證正面/背面、行車執照、駕照或其他）。只輸出純JSON(勿用Markdown)，看不到的欄位給空字串，不要猜：\n{"docType":"idFront/idBack/license/other","name":"姓名","idNumber":"身分證統一編號","birthday":"出生日期，民國年格式 YYY/MM/DD","gender":"男或女","address":"住址","owner":"行照車主","plate":"牌照號碼(大寫英數加破折號)","model":"廠牌與型式","mfgDate":"出廠年月","cc":"排氣量","issueDate":"發照日期(民國 YYY/MM/DD)","engineNo":"引擎號碼","chassisNo":"車身號碼"}';
const DOC_LABEL = { idFront: "身分證正面", idBack: "身分證反面", license: "行照", other: "證件" };

async function handleProfileFiles(files) {
const msg = document.getElementById("pAiMsg");
for (const f of files) {
msg.innerText = `辨識中…（${f.name || "照片"}）`;
const stored = await compressImage(f, 1200, 0.72);
const forAi = await compressImage(f, 1100, 0.7);
let label = "證件";
try {
const p = await geminiJSON(PROFILE_AI_PROMPT, [forAi], 600);
label = DOC_LABEL[p.docType] || "證件";
const put = (id, v) => { v = String(v || "").trim(); if (v) document.getElementById(id).value = v; };
put("pName", p.name); put("pBirth", p.birthday); put("pAddress", p.address);
if (p.gender && /[男女]/.test(p.gender)) document.getElementById("pGender").value = p.gender.includes("男") ? "男" : "女";
if (p.idNumber && /[A-Z][0-9]{9}/i.test(p.idNumber.replace(/\s/g, ""))) { profIdNo = p.idNumber.replace(/\s/g, "").toUpperCase(); renderIdField(); }
put("pOwner", p.owner); put("pPlate", (p.plate || "").toUpperCase()); put("pModel", p.model); put("pMfg", p.mfgDate);
put("pCc", p.cc); put("pIssue", p.issueDate); put("pEngine", p.engineNo); put("pChassis", p.chassisNo);
msg.innerText = `✅ 已辨識「${label}」並填入，請核對後按儲存`;
} catch (e) {
msg.innerText = "辨識失敗（照片仍會保存）：" + e.message;
}
profPhotos.push({ label, data: stored });
renderProfPhotos();
}
}
const pickProfile = (inputId) => { const el = document.getElementById(inputId); el.value = ""; el.click(); };
document.getElementById("pSnapId").addEventListener("click", () => pickProfile("pCamInput"));
document.getElementById("pSnapLicense").addEventListener("click", () => pickProfile("pCamInput"));
document.getElementById("pPickAlbum").addEventListener("click", () => pickProfile("pAlbumInput"));
document.getElementById("pCamInput").addEventListener("change", (e) => handleProfileFiles(Array.from(e.target.files || [])));
document.getElementById("pAlbumInput").addEventListener("change", (e) => handleProfileFiles(Array.from(e.target.files || [])));

const closeProfileModal = () => document.getElementById("profileModal").classList.remove("active");
document.getElementById("closeProfileBtn").addEventListener("click", closeProfileModal);
document.getElementById("cancelProfileBtn").addEventListener("click", closeProfileModal);
document.getElementById("saveProfileBtn").addEventListener("click", async () => {
if (!profRecord) return;
const btn = document.getElementById("saveProfileBtn");
btn.disabled = true; btn.innerText = "儲存中…";
const team = profRecord.team || currentTeam;
if (profShowId) profIdNo = document.getElementById("pIdNo").value.trim().toUpperCase();
const data = { team, recordId: profRecord.id, pIdNo: profIdNo, pSource: profSource, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
PROFILE_FIELDS.forEach(f => { data[f] = document.getElementById(f).value.trim(); });
try {
const ref = profilesCol.doc(profRecord.id);
await ref.set(data, { merge: true });
for (const pid of profDeleted) await ref.collection("photos").doc(pid).delete();
for (const p of profPhotos.filter(x => !x.id)) {
const added = await ref.collection("photos").add({ team, label: p.label, data: p.data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
p.id = added.id;
}
profDeleted = [];
await recordsCol.doc(profRecord.id).update({ hasProfile: true });
closeProfileModal();
showToast("客戶資料卡已儲存！");
} catch (e) {
alert("儲存失敗：" + e.message);
} finally {
btn.disabled = false; btn.innerText = "儲存資料卡";
}
});
