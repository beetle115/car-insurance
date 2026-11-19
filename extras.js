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
document.getElementById("pBirth").value = toWesternDate(d.pBirth);
document.getElementById("pMfg").value = toWesternDate(d.pMfg, true);
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

const PROFILE_AI_PROMPT = '這是台灣的證件照片（身分證正面/背面、居留證、行車執照、駕照或其他）。只輸出純JSON(勿用Markdown)，看不到的欄位給空字串，不要猜：\n{"docType":"idFront/idBack/residence/license/other（居留證填 residence）","name":"姓名（含外文姓名）","idNumber":"身分證統一編號或居留證統一證號","birthday":"出生日期，一律西元 YYYY/MM/DD（民國年加1911）","gender":"男或女","address":"身分證或居留證上的住址；行照上的地址不要填在這裡","owner":"行照車主","plate":"牌照號碼(大寫英數加破折號)","model":"廠牌與型式","mfgDate":"出廠年月，一律西元 YYYY/MM","cc":"排氣量","issueDate":"發照日期(民國 YYY/MM/DD)","engineNo":"引擎號碼","chassisNo":"車身號碼"}';
const DOC_LABEL = { idFront: "身分證正面", idBack: "身分證反面", residence: "居留證", license: "行照", other: "證件" };
// 民國／西元日期 → 西元 YYYY/MM/DD（monthOnly 時 YYYY/MM）
function toWesternDate(s, monthOnly) {
s = String(s || "").trim().replace(/^(民國|民|西元)\s*/, "");
if (!s) return "";
let m = s.match(/^0*(\d{2,4})\s*[\/.年-]\s*(\d{1,2})(?:\s*[\/.月-]\s*(\d{1,2}))?/);
if (!m) { const c = s.match(/^0*(\d{2,3})(\d{2})(\d{2})$/); if (c) m = [c[0], c[1], c[2], c[3]]; }
if (!m) return s;
let y = parseInt(m[1], 10); if (y < 1911) y += 1911;
const mm = String(parseInt(m[2], 10)).padStart(2, "0");
if (monthOnly || !m[3]) return `${y}/${mm}`;
return `${y}/${mm}/${String(parseInt(m[3], 10)).padStart(2, "0")}`;
}

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
put("pName", p.name); put("pBirth", toWesternDate(p.birthday));
// 地址只採用身分證／居留證上的，行照的地址不帶入
if (p.docType !== "license") put("pAddress", p.address);
if (p.gender && /[男女]/.test(p.gender)) document.getElementById("pGender").value = p.gender.includes("男") ? "男" : "女";
if (p.idNumber && /[A-Z][0-9]{9}/i.test(p.idNumber.replace(/\s/g, ""))) { profIdNo = p.idNumber.replace(/\s/g, "").toUpperCase(); renderIdField(); }
put("pOwner", p.owner); put("pPlate", (p.plate || "").toUpperCase()); put("pModel", p.model); put("pMfg", toWesternDate(p.mfgDate, true));
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
data.pBirth = toWesternDate(data.pBirth);
data.pMfg = toWesternDate(data.pMfg, true);
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

// ===== 夥伴業績表匯入（投保日期／客人名字／居留證號／生日／電話／車牌號碼／投保期間／保險種類／投保金額／聯絡方式）=====
function parseCsv(text) {
const rows = []; let row = [], cur = "", q = false;
for (let i = 0; i < text.length; i++) {
const ch = text[i];
if (q) {
if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
else cur += ch;
} else if (ch === '"') q = true;
else if (ch === ",") { row.push(cur); cur = ""; }
else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
else cur += ch;
}
if (cur || row.length) { row.push(cur); rows.push(row); }
return rows.map(r => r.map(c => c.replace(/^﻿/, "").trim()));
}
const addYearIso = (iso) => { const [y, m, d] = iso.split("-"); return `${parseInt(y, 10) + 1}-${m}-${d}`; };
const rocToIso = (y, m, d) => { y = parseInt(y, 10); if (y < 1911) y += 1911; return `${y}-${String(parseInt(m, 10)).padStart(2, "0")}-${String(parseInt(d, 10)).padStart(2, "0")}`; };
// 日期自動判斷西元／民國：4 位數年份＝西元，2～3 位數（含前面多一個 0，如 0115）＝民國
const DATE_RE = "0*(\\d{2,4})\\s*[\\/.年-]\\s*(\\d{1,2})\\s*[\\/.月-]\\s*(\\d{1,2})";
function parseOneDate(s) {
const m = String(s || "").match(new RegExp(DATE_RE));
return m ? rocToIso(m[1], m[2], m[3]) : "";
}
function parsePeriod(s) {
const m = String(s || "").match(new RegExp(DATE_RE + "\\D+" + DATE_RE));
if (!m) return { start: "", end: "", years: 0 };
const start = rocToIso(m[1], m[2], m[3]), end = rocToIso(m[4], m[5], m[6]);
return { start, end, years: parseInt(end.slice(0, 4), 10) - parseInt(start.slice(0, 4), 10) };
}
function normBirth(s) {
s = String(s || "").trim();
let m = s.match(/^0*(\d{2,3})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
if (m) return `${m[1]}/${m[2].padStart(2, "0")}/${m[3].padStart(2, "0")}`;
m = s.match(/^(\d{2,3})(\d{2})(\d{2})$/);
if (m) return `${m[1]}/${m[2]}/${m[3]}`;
return s;
}
function normPhone(s) {
let d = String(s || "").replace(/\D/g, "");
if (d.length === 9 && d[0] === "9") d = "0" + d;
return d.length === 10 ? `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}` : String(s || "").trim();
}
function contactInfo(s) {
s = String(s || "").trim();
const lower = s.toLowerCase();
const out = { line: "", source: "", note: s };
if (lower.startsWith("line")) out.line = s.replace(/^line\s*/i, "").trim();
if (/^(fb|facebook|tiktok|ig|instagram)/i.test(s)) out.source = "網路";
return out;
}

let partnerImportRows = [];
function tryPartnerImport(text) {
const rows = parseCsv(text);
const hi = rows.findIndex(r => r.some(c => c.includes("車牌")) && r.some(c => c.includes("投保期間")));
if (hi < 0) return false;
const h = rows[hi];
const col = (kw) => h.findIndex(c => c.includes(kw));
const C = { sold: col("投保日期"), name: col("名字"), id: col("證"), birth: col("生日"), phone: col("電話"), plate: col("車牌"), period: col("投保期間"), kind: col("種類"), fee: col("金額"), contact: col("聯絡") };
const get = (r, k) => (C[k] >= 0 ? (r[C[k]] || "") : "").trim();
partnerImportRows = [];
rows.slice(hi + 1).forEach(r => {
const plate = get(r, "plate").toUpperCase().replace(/\s/g, "");
const name = get(r, "name");
if (!plate && !name) return;
let per = parsePeriod(get(r, "period"));
const soldIso = parseOneDate(get(r, "sold"));
let noPeriod = false;
if (!per.start && soldIso) { per = { start: soldIso, end: addYearIso(soldIso), years: 1 }; noPeriod = true; }
const fee = Number(get(r, "fee").replace(/[^\d.]/g, "")) || 0;
const kind = get(r, "kind");
const isVoluntary = kind.includes("任意");
const ct = contactInfo(get(r, "contact"));
const exist = allRecords.find(x => normPlate(x.plateNumber) === normPlate(plate));
let action = "add", reason = "";
if (exist && exist.startDate === per.start) { action = "skip"; reason = "已存在"; }
else if (exist && per.start && (exist.startDate || "") < per.start) { action = "update"; reason = "續保更新"; }
else if (exist) { action = "skip"; reason = "系統內資料較新"; }
const warns = [];
if (!name) warns.push("缺姓名");
if (!per.start) warns.push("投保期間看不懂");
if (noPeriod) warns.push("沒填投保期間，暫用投保日期");
if (plate && normPlate(plate).length < 5) warns.push("車牌不完整");
if (isVoluntary) warns.push("任意險：請進「投保」補險種");
if (per.years >= 2) warns.push(`${per.years}年期`);
partnerImportRows.push({
action, reason, warns, existId: exist ? exist.id : null,
record: {
clientName: name, plateNumber: plate,
vehicleType: fee >= 2000 ? "汽車 🚗" : "機車 🛵",
company: "", startDate: per.start, expiryDate: per.end || per.start,
fee, premium: fee, soldDate: soldIso || get(r, "sold"), policyYears: per.years || 1,
...(isVoluntary
? { coverage: { other: { on: true, amount: "任意險（險種待補）" } }, coverageCount: 1 }
: { hasCompulsory: true, compulsoryAligned: true, compulsoryStartDate: "", uncompulsory: false }),
note: [ct.note, per.years >= 2 ? `${per.years}年期，到期 ${fmtRocMD(per.end)}` : ""].filter(Boolean).join("｜")
},
profile: {
pName: name, pIdNo: get(r, "id").toUpperCase(), pBirth: toWesternDate(normBirth(get(r, "birth"))),
pPhone: normPhone(get(r, "phone")), pLine: ct.line, pSource: ct.source, pNote: ct.note, pPlate: plate
}
});
});
renderPartnerImport();
document.getElementById("importModal").classList.add("active");
return true;
}

function renderPartnerImport() {
const n = { add: 0, update: 0, skip: 0 };
partnerImportRows.forEach(x => n[x.action]++);
document.getElementById("impTeam").innerText = TEAM_LABELS[currentTeam] || currentTeam;
document.getElementById("impSummary").innerText = `新增 ${n.add} 筆、續保更新 ${n.update} 筆、略過 ${n.skip} 筆`;
const tag = { add: '<span class="imp-tag add">新增</span>', update: '<span class="imp-tag upd">更新</span>', skip: '<span class="imp-tag skip">略過</span>' };
document.getElementById("impList").innerHTML = partnerImportRows.map(x => `<tr class="${x.action === "skip" ? "imp-skip" : ""}">
<td>${tag[x.action]}</td><td>${escHtml(x.record.clientName || "—")}</td><td style="font-family:ui-monospace,Menlo,monospace">${escHtml(x.record.plateNumber)}</td>
<td>${escHtml(fmtRocMD(x.record.startDate))}</td><td>${x.record.fee || ""}</td><td>${escHtml(x.record.vehicleType)}</td>
<td style="color:#fbbf24;font-size:11.5px">${escHtml([x.reason, ...x.warns].filter(Boolean).join("、"))}</td></tr>`).join("");
const go = n.add + n.update;
const btn = document.getElementById("impGo");
btn.disabled = !go;
btn.innerText = go ? `匯入 ${go} 筆到「${TEAM_LABELS[currentTeam] || currentTeam}」` : "沒有要匯入的資料";
}

const closeImportModal = () => document.getElementById("importModal").classList.remove("active");
document.getElementById("impCancel").addEventListener("click", closeImportModal);
document.getElementById("impClose").addEventListener("click", closeImportModal);
document.getElementById("impGo").addEventListener("click", async () => {
const btn = document.getElementById("impGo");
btn.disabled = true;
const team = currentTeam;
let ok = 0, fail = 0;
const todo = partnerImportRows.filter(x => x.action !== "skip");
for (const x of todo) {
btn.innerText = `匯入中… ${ok + fail + 1}/${todo.length}`;
try {
let id = x.existId;
if (x.action === "update") {
await recordsCol.doc(id).update({ ...x.record, hasProfile: true, renewedAt: firebase.firestore.FieldValue.serverTimestamp() });
} else {
const ref = await recordsCol.add({ ...x.record, team, hasProfile: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
id = ref.id;
}
const p = {};
Object.entries(x.profile).forEach(([k, v]) => { if (v) p[k] = v; });
await profilesCol.doc(id).set({ ...p, team, recordId: id, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
ok++;
} catch (e) { console.error(e); fail++; }
}
closeImportModal();
alert(`匯入完成：成功 ${ok} 筆${fail ? `，失敗 ${fail} 筆` : ""}。`);
btn.disabled = false;
});
