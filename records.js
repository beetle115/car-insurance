function openRenewModalById(id) {
const record = allRecords.find(r => r.id === id);
if (!record) return;
document.getElementById("renewDocId").value = record.id;
document.getElementById("renewInfoText").innerText = `客戶：${record.clientName || ''} (車牌：${record.plateNumber || ''}) - ${record.company || ''}`;
let nextDate = "";
const curDate = record.startDate || record.expiryDate || "";
if (curDate && curDate.includes("-")) {
const parts = curDate.split("-");
if (parts.length >= 3) {
const nextYear = parseInt(parts[0], 10) + 1;
nextDate = `${nextYear}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
}
}
document.getElementById("renewStartDate").value = nextDate;
const feeVal = record.fee !== undefined ? record.fee : (record.premium !== undefined ? record.premium : "");
document.getElementById("renewFee").value = feeVal;
document.getElementById("renewNote").value = `${new Date().getFullYear()}續保完成`;
document.getElementById("renewModal").classList.add("active");
}
const closeRenewModal = () => document.getElementById("renewModal").classList.remove("active");
document.getElementById("closeRenewModalBtn").addEventListener("click", closeRenewModal);
document.getElementById("cancelRenewBtn").addEventListener("click", closeRenewModal);
document.getElementById("renewForm").addEventListener("submit", async (e) => {
e.preventDefault();
const id = document.getElementById("renewDocId").value;
if (!id) return;
const newDate = document.getElementById("renewStartDate").value;
const feeVal = Number(document.getElementById("renewFee").value) || 0;
const noteVal = document.getElementById("renewNote").value.trim();
try {
if (newDate && newDate.includes("-")) {
const m = parseInt(newDate.split("-")[1], 10);
if (m >= 1 && m <= 12) expandedMonths.add(m);
}
await recordsCol.doc(id).update({
startDate: newDate,
expiryDate: newDate,
fee: feeVal,
premium: feeVal,
note: noteVal,
renewedAt: firebase.firestore.FieldValue.serverTimestamp()
});
closeRenewModal();
showToast("已成功完成續保並展延 1 年！");
} catch (err) {
alert("續保失敗: " + err.message);
}
});
function openEditModalById(id) {
const record = allRecords.find(r => r.id === id);
if (!record) return;
editTempPhotos = Array.isArray(record.photos) ? [...record.photos] : (record.photo ? [record.photo] : []);
renderEditPhotos();
document.getElementById("editDocId").value = record.id;
document.getElementById("editClientName").value = record.clientName || "";
document.getElementById("editPlateNumber").value = record.plateNumber || "";
document.getElementById("editVehicleType").value = record.vehicleType || "機車 🛵";
document.getElementById("editCompany").value = record.company || "";
document.getElementById("editStartDate").value = record.startDate || record.expiryDate || "";
document.getElementById("editFee").value = record.fee !== undefined ? record.fee : (record.premium !== undefined ? record.premium : "");
writeComp("edit", compState(record));
document.getElementById("editNote").value = record.note || record.coverageDetails || "";
document.getElementById("editModal").classList.add("active");
}
const closeEditModal = () => document.getElementById("editModal").classList.remove("active");
document.getElementById("closeEditModalBtn").addEventListener("click", closeEditModal);
document.getElementById("cancelEditBtn").addEventListener("click", closeEditModal);
document.getElementById("editForm").addEventListener("submit", async (e) => {
e.preventDefault();
const id = document.getElementById("editDocId").value;
if (!id) return;
const sDate = document.getElementById("editStartDate").value;
const feeVal = Number(document.getElementById("editFee").value) || 0;
const updatedData = {
clientName: document.getElementById("editClientName").value.trim(),
plateNumber: document.getElementById("editPlateNumber").value.trim().toUpperCase(),
company: cleanCompany(document.getElementById("editCompany").value.trim()),
vehicleType: document.getElementById("editVehicleType").value,
startDate: sDate,
expiryDate: sDate,
fee: feeVal,
premium: feeVal,
...readComp("edit"),
note: document.getElementById("editNote").value.trim(),
photos: editTempPhotos
};
try {
await recordsCol.doc(id).update(updatedData);
closeEditModal();
showToast("資料與保單照片已成功更新！");
} catch (err) {
alert("更新失敗：" + err.message);
}
});
async function copyNotificationById(id) {
const r = allRecords.find(item => item.id === id);
if (!r) return;
const dateStr = r.startDate || r.expiryDate || "";
let monthDay = "";
if (dateStr) {
const parts = dateStr.split("-");
if (parts.length >= 3) {
monthDay = `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
}
}
const feeNum = Number(r.fee !== undefined ? r.fee : (r.premium !== undefined ? r.premium : 0));
const feeLine = feeNum > 0 ? `💰 續保參考保費：約 NT$ ${feeNum.toLocaleString()} 元\n` : "";
const cst = compState(r);
let uncompulsoryWarning = "";
if (!cst.has) uncompulsoryWarning = "⚠️ 提醒：此件原無投保強制險，本次建議一併投保完整保障。\n";
else if (!cst.aligned) uncompulsoryWarning = `⚠️ 提醒：您的強制險${cst.compStart ? "（" + fmtRocMD(cst.compStart) + " 起保）" : ""}與任意險到期日不同，本次建議一併切齊，之後只要記一個到期日。\n`;
const rawName = (r.clientName || "").trim();
let givenName = "車主";
if (rawName) {
const compoundSurnames = ["歐陽", "司馬", "上官", "諸葛", "東方", "皇甫", "尉遲", "公孫", "令狐", "宇文", "長孫", "慕容", "司徒", "司空", "端木", "百里", "東郭", "南宮", "呼延", "軒轅", "范姜", "張簡"];
const matchedCompound = compoundSurnames.find(s => rawName.startsWith(s) && rawName.length > s.length);
if (matchedCompound) {
givenName = rawName.slice(matchedCompound.length);
} else if (rawName.length >= 2) {
givenName = rawName.slice(1);
} else {
givenName = rawName;
}
}
// 夥伴（阮氏秋恒）的客戶用越南文通知；系統介面維持中文
const NOTICE_LANG = { hoang: "vi" };
let message;
if (NOTICE_LANG[r.team || currentTeam] === "vi") {
let viDate = dateStr;
if (dateStr && dateStr.split("-").length >= 3) { const p = dateStr.split("-"); viDate = `${parseInt(p[2], 10)}/${parseInt(p[1], 10)}`; }
const viFee = feeNum > 0 ? `💰 Phí tái tục tham khảo: khoảng NT$ ${feeNum.toLocaleString("vi-VN")}\n` : "";
let viWarn = "";
if (!cst.has) viWarn = "⚠️ Lưu ý: xe này trước đây chưa có bảo hiểm bắt buộc, lần này anh/chị nên mua kèm để được bảo vệ đầy đủ.\n";
else if (!cst.aligned) {
let cs = "";
if (cst.compStart) { const q = cst.compStart.split("-"); cs = ` (bắt đầu từ ${parseInt(q[2], 10)}/${parseInt(q[1], 10)}/${q[0]})`; }
viWarn = `⚠️ Lưu ý: bảo hiểm bắt buộc${cs} của anh/chị hết hạn khác ngày với bảo hiểm tự nguyện, lần này nên gộp chung một ngày để sau này chỉ cần nhớ một ngày hết hạn.\n`;
}
message = `Xin chào anh/chị! 🌸\n` +
`Em xin nhắc: bảo hiểm của xe 【${r.plateNumber || ""}】${r.company ? "（" + r.company + "）" : ""} sẽ hết hạn vào ngày ${viDate} ạ!\n` +
viFee + viWarn +
`Để xe của anh/chị luôn được bảo hiểm liên tục, em đã chuẩn bị sẵn báo giá tái tục và phiếu đóng phí. Nếu muốn điều chỉnh gói bảo hiểm hoặc có thắc mắc gì, anh/chị cứ nhắn cho em nhé! Chúc anh/chị lái xe bình an, thuận lợi 😊\n` +
`Đóng phí xong anh/chị nhớ chụp giúp em biên lai hoặc ảnh màn hình nhé.`;
} else
message = `${givenName}您好！🌸\n` +
`提醒您，您的愛車【${r.plateNumber || ''}】（${r.company || '產險'}）車險即將於 ${monthDay || dateStr} 到期囉！\n` +
`${feeLine}` +
`${uncompulsoryWarning}` +
`為確保您的行車保障不中斷，已為您準備好續保試算及繳款單，若需調整方案或有任何問題，隨時回覆我為您處理喔！祝您行車平安順心 😊\n` +
`提醒繳完幫我拍一下收據或截圖喔。`;
try {
if (navigator.clipboard && navigator.clipboard.writeText) {
await navigator.clipboard.writeText(message);
} else {
const tempArea = document.createElement("textarea");
tempArea.value = message;
tempArea.style.position = "fixed";
tempArea.style.left = "-9999px";
document.body.appendChild(tempArea);
tempArea.select();
document.execCommand("copy");
document.body.removeChild(tempArea);
}
showToast(`已複製【${r.clientName || r.plateNumber}】續保通知${NOTICE_LANG[r.team || currentTeam] === "vi" ? "（越南文）" : ""}！`);
} catch (err) {
showToast("複製失敗，請手動複製");
}
}
document.getElementById("accordionContainer").addEventListener("click", async (e) => {
const header = e.target.closest(".month-header");
if (header) {
const acc = header.closest(".month-accordion");
if (acc) {
acc.classList.toggle("active");
const m = Number(acc.getAttribute("data-month"));
if (acc.classList.contains("active")) expandedMonths.add(m);
else expandedMonths.delete(m);
}
return;
}
const btn = e.target.closest("button[data-action]");
if (!btn) return;
const action = btn.getAttribute("data-action");
const id = btn.getAttribute("data-id");
if (action === "copy") {
await copyNotificationById(id);
} else if (action === "renew") {
openRenewModalById(id);
} else if (action === "edit") {
openEditModalById(id);
} else if (action === "delete") {
if (confirm("確認刪除這筆車險資料？")) {
try {
await recordsCol.doc(id).delete();
showToast("已刪除該筆資料");
} catch (err) {
alert("刪除失敗: " + err.message);
}
}
} else if (action === "profile") {
openProfileModal(id);
} else if (action === "coverage") {
openCoverageModal(id);
} else if (action === "view-photo") {
const r = allRecords.find(item => item.id === id);
const list = r ? (Array.isArray(r.photos) ? r.photos : (r.photo ? [r.photo] : [])) : [];
if (list.length > 0) openLightboxWithList(list, 0);
}
});
let stopRecordsSync = null;
function startRecordsSync(onError) {
if (stopRecordsSync) return;
stopRecordsSync = recordsCol.where("team", "==", currentTeam).onSnapshot((snap) => {
allRecords = [];
snap.forEach(d => allRecords.push({ id: d.id, ...d.data() }));
renderList();
updateKpis();
}, (err) => {
stopRecordsSync = null;
if (onError) onError(err);
});
}
function stopRecordsSyncNow() {
if (stopRecordsSync) { stopRecordsSync(); stopRecordsSync = null; }
allRecords = [];
}
const INCOME_RATE = 0.15;
function recordFee(r) {
const val = Number(r.fee !== undefined ? r.fee : (r.premium !== undefined ? r.premium : (r.totalFee || 0)));
return !isNaN(val) && val > 0 ? val : 0;
}
function estIncome(list) { return Math.round(list.reduce((t, r) => t + recordFee(r), 0) * INCOME_RATE); }
function updateKpis() {
document.getElementById("kpiTotalCount").innerText = `${allRecords.length} 件`;
const income = estIncome(allRecords);
document.getElementById("kpiEstimatedIncome").innerText = `NT$ ${income.toLocaleString()}`;
}
document.getElementById("searchInput").addEventListener("input", renderList);
document.getElementById("sortSelect").addEventListener("change", renderList);
function renderList() {
const q = document.getElementById("searchInput").value.toLowerCase();
const sortMode = document.getElementById("sortSelect").value;
const container = document.getElementById("accordionContainer");
let filtered = allRecords.filter(r =>
(r.clientName||"").toLowerCase().includes(q) ||
(r.plateNumber||"").toLowerCase().includes(q) ||
(r.company||"").toLowerCase().includes(q)
);
if (!filtered.length) {
container.innerHTML = "<div style='text-align:center; padding:32px; background:#1e293b; border-radius:12px; color:#94a3b8;'>尚無相符車險記錄</div>";
return;
}
filtered.sort((a, b) => {
const da = a.startDate || a.expiryDate || "9999";
const db = b.startDate || b.expiryDate || "9999";
return sortMode === 'date-asc' ? da.localeCompare(db) : db.localeCompare(da);
});
const groups = {};
for (let i = 1; i <= 12; i++) groups[i] = [];
filtered.forEach(r => {
let m = 0;
const d = r.startDate || r.expiryDate;
if (d) {
const parts = d.split("-");
if (parts[1]) m = parseInt(parts[1], 10);
}
if (m >= 1 && m <= 12) groups[m].push(r);
else (groups[1] = groups[1] || []).push(r);
});
let html = "";
for (let i = 1; i <= 12; i++) {
const list = groups[i] || [];
if (list.length === 0 && q) continue;
const isActive = expandedMonths.has(i) ? " active" : "";
html += `
<div class="month-accordion${isActive}" data-month="${i}">
<div class="month-header">
<div>📅 ${i} 月 <span class="month-badge">${list.length} 筆</span>${list.length ? `<span class="month-income">推估收入 NT$ ${estIncome(list).toLocaleString()}</span>` : ""}</div>
<span class="month-arrow">▼</span>
</div>
<div class="month-content">
<div class="table-wrapper">
<table>
<thead>
<tr>
<th class="col-name">客戶</th>
<th class="col-plate">車牌</th>
<th>車種</th>
<th>公司</th>
<th>起保日</th>
<th>保費</th>
<th>狀態</th>
<th>照片</th>
<th>自填備註</th>
<th>操作</th>
</tr>
</thead>
<tbody>
${list.map(r => {
const feeNum = Number(r.fee !== undefined ? r.fee : (r.premium !== undefined ? r.premium : 0));
const feeStr = feeNum > 0 ? `NT$ ${feeNum.toLocaleString()}` : '-';
const isCar = (r.vehicleType || "").includes("汽");
const tagClass = isCar ? "tag-car" : "tag-moto";
const dateStr = r.startDate || r.expiryDate || "-";
const photoList = Array.isArray(r.photos) ? r.photos : (r.photo ? [r.photo] : []);
const photoBadge = photoList.length > 0
? `<button type="button" class="badge-photo" data-action="view-photo" data-id="${r.id}">📷 ${photoList.length}張</button>`
: `<span style="color:#64748b;font-size:12px;">-</span>`;
return `
<tr>
<td class="col-name">${r.clientName || '-'}</td>
<td class="col-plate">${r.plateNumber || '-'}</td>
<td><span class="tag-vehicle ${tagClass}">${r.vehicleType || '機車 🛵'}</span></td>
<td>${r.company || '-'}</td>
<td>${dateStr}</td>
<td style="font-weight:700; color:#34d399;">${feeStr}</td>
<td>${(() => { const c = compState(r); return !c.has ? '<span class="tag-uncompulsory">未含強</span>' : !c.aligned ? `<span class="tag-uncompulsory">強未切齊${c.compStart ? ' ' + fmtRocMD(c.compStart) : ''}</span>` : '-'; })()}</td>
<td>${photoBadge}</td>
<td style="color:#94a3b8; font-size:13px;">${r.note || r.coverageDetails || '-'}</td>
<td>
<div style="display:flex; gap:5px; align-items:center;">
<button type="button" class="btn-op btn-op-notice" data-action="copy" data-id="${r.id}">📋 通知</button>
<button type="button" class="btn-op btn-op-profile" data-action="profile" data-id="${r.id}">資料卡<span class="prof-dot ${r.hasProfile ? 'on' : ''}"></span></button>
<button type="button" class="btn-op btn-op-coverage" data-action="coverage" data-id="${r.id}">投保<span class="cov-cnt">${r.coverageCount || 0}</span></button>
<button type="button" class="btn-op btn-op-renew" data-action="renew" data-id="${r.id}">續保</button>
<button type="button" class="btn-op btn-op-edit" data-action="edit" data-id="${r.id}">編輯</button>
<button type="button" class="btn-op btn-op-delete" data-action="delete" data-id="${r.id}">刪除</button>
</div>
</td>
</tr>
`;
}).join('')}
</tbody>
</table>
</div>
</div>
</div>
`;
}
container.innerHTML = html;
}
document.getElementById("importCsvBtn").addEventListener("click", () => document.getElementById("csvFileInput").click());
document.getElementById("csvFileInput").addEventListener("change", function(e) {
const file = e.target.files[0];
if (!file) return;
const reader = new FileReader();
reader.onload = async function(evt) {
const text = evt.target.result;
if (typeof tryPartnerImport === "function" && tryPartnerImport(text)) { e.target.value = ""; return; }
const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
if (lines.length <= 1) return alert("檔案無有效資料");
let updated = 0, inserted = 0;
for (let i = 1; i < lines.length; i++) {
const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ''));
if (cols.length < 2) continue;
let clientName = "", plateNumber = "", vehicleType = "機車 🛵", company = "富邦", dateVal = "", fee = 0, uncompulsory = false, note = "";
if (cols[0].includes("車") && !cols[1].includes("車")) {
vehicleType = cols[0] || "機車 🛵";
clientName = cols[1] || "";
plateNumber = (cols[2] || "").toUpperCase();
company = cleanCompany(cols[3] || "");
dateVal = cleanDate(cols[4] || "");
fee = Number(cols[5]) || 0;
uncompulsory = cols[6] === "未含強" || cols[6] === "強未切齊" || cols[6] === "true" || cols[6] === "1";
note = cols[7] || "";
} else {
clientName = cols[0] || "";
plateNumber = (cols[1] || "").toUpperCase();
vehicleType = cols[2] || "機車 🛵";
company = cleanCompany(cols[3] || "");
dateVal = cleanDate(cols[4] || "");
fee = Number(cols[5]) || 0;
uncompulsory = cols[6] === "未含強" || cols[6] === "強未切齊" || cols[6] === "true" || cols[6] === "1";
note = cols[7] || "";
}
if (!plateNumber && !clientName) continue;
const exist = findMatchedRecord(plateNumber, clientName);
const payload = {
clientName, plateNumber, vehicleType, company,
startDate: dateVal, expiryDate: dateVal,
fee, premium: fee, uncompulsory, note,
hasCompulsory: cols[6] !== "未含強" && cols[6] !== "true" && cols[6] !== "1",
compulsoryAligned: !uncompulsory
};
if (exist) {
await recordsCol.doc(exist.id).update(payload);
updated++;
} else {
payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
await recordsCol.add({ ...payload, team: currentTeam });
inserted++;
}
}
alert(`匯入完成！已覆蓋更新 ${updated} 筆，新增 ${inserted} 筆。`);
};
reader.readAsText(file);
});
document.getElementById("exportCsvBtn").addEventListener("click", () => {
if (!allRecords.length) return alert("尚無資料可匯出");
let csv = "\uFEFF車種,客戶姓名,車牌號碼,承保公司,起保日,保費,強制險,備註\n";
allRecords.forEach(r => {
const feeVal = r.fee !== undefined ? r.fee : (r.premium !== undefined ? r.premium : "");
csv += `"${r.vehicleType||''}","${r.clientName||''}","${r.plateNumber||''}","${r.company||''}","${r.startDate||r.expiryDate||''}","${feeVal}","${(() => { const c = compState(r); return !c.has ? '未含強' : !c.aligned ? '強未切齊' : ''; })()}","${r.note||r.coverageDetails||''}"\n`;
});
const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = `客戶車險名冊_${new Date().toISOString().slice(0,10)}.csv`;
a.click();
});
document.getElementById("clearAllBtn").addEventListener("click", async () => {
if (!confirm(`⚠️ 警告：這將清空「${TEAM_LABELS[currentTeam] || currentTeam}」的所有車險記錄！確定要清除嗎？`)) return;
const snap = await recordsCol.where("team", "==", currentTeam).get();
const batch = db.batch();
snap.forEach(d => batch.delete(d.ref));
await batch.commit();
showToast("已清空所有記錄");
});