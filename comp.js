// ===== 強制險：「含強制險」「切齊強制險」兩個開關 + 自動判斷 =====
// 資料欄位：hasCompulsory、compulsoryAligned、compulsoryStartDate（未切齊時的強制險起保日）
// 相容舊欄位 uncompulsory（= 未含強 或 未切齊）
const COMP_START_INPUT = { m: "mStartDate", ai: "aiStartDate", edit: "editStartDate" };

function compState(r) {
const has = r.hasCompulsory !== undefined ? !!r.hasCompulsory : !r.uncompulsory;
const aligned = has ? (r.compulsoryAligned !== undefined ? !!r.compulsoryAligned : true) : false;
return { has, aligned, compStart: r.compulsoryStartDate || "" };
}

function fmtRocMD(d) {
if (!d || !d.includes("-")) return d || "";
const [y, m, dd] = d.split("-");
return `${parseInt(y, 10) - 1911}/${parseInt(m, 10)}/${parseInt(dd, 10)}`;
}

function compRender(p) {
const has = document.getElementById(p + "HasComp").checked;
const alignedEl = document.getElementById(p + "CompAligned");
const aligned = alignedEl.checked;
document.getElementById(p + "CompAlignedWrap").classList.toggle("disabled", !has);
alignedEl.disabled = !has;
document.getElementById(p + "CompStartWrap").style.display = has && !aligned ? "" : "none";
const hint = document.getElementById(p + "CompHint");
const vs = (document.getElementById(COMP_START_INPUT[p]) || {}).value || "";
const cs = document.getElementById(p + "CompStart").value;
if (!has) { hint.className = "comp-hint warn"; hint.innerText = "此件沒有強制險"; }
else if (aligned) { hint.className = "comp-hint ok"; hint.innerText = "強制險與任意險同一天到期"; }
else if (cs) { hint.className = "comp-hint warn"; hint.innerText = `強制險 ${fmtRocMD(cs)} 起保，任意險 ${fmtRocMD(vs) || "—"} 起保 → 未切齊`; }
else { hint.className = "comp-hint warn"; hint.innerText = "未切齊：可填強制險起保日，方便之後一起提醒"; }
}

// 依日期自動判斷是否切齊（強制險與任意險起保日相同＝到期日相同）
function compAutoJudge(p) {
const has = document.getElementById(p + "HasComp").checked;
const cs = document.getElementById(p + "CompStart").value;
const vs = (document.getElementById(COMP_START_INPUT[p]) || {}).value || "";
if (has && cs && vs) document.getElementById(p + "CompAligned").checked = cs === vs;
compRender(p);
}

function writeComp(p, st) {
document.getElementById(p + "HasComp").checked = !!st.has;
document.getElementById(p + "CompAligned").checked = !!st.has && !!st.aligned;
document.getElementById(p + "CompStart").value = st.has && !st.aligned ? (st.compStart || "") : "";
compRender(p);
}

function readComp(p) {
const has = document.getElementById(p + "HasComp").checked;
const aligned = has && document.getElementById(p + "CompAligned").checked;
const compStart = has && !aligned ? document.getElementById(p + "CompStart").value : "";
return { hasCompulsory: has, compulsoryAligned: aligned, compulsoryStartDate: compStart, uncompulsory: !(has && aligned) };
}

// AI 回傳 → 狀態。規則：強制險到期日＝任意險到期日 → 切齊
function compFromAi(parsed) {
const has = parsed.hasCompulsory !== undefined ? !!parsed.hasCompulsory : !parsed.uncompulsory;
if (!has) return { has: false, aligned: false, compStart: "" };
const cs = cleanDate(parsed.compulsoryStartDate || ""), ce = cleanDate(parsed.compulsoryEndDate || "");
const vs = cleanDate(parsed.startDate || ""), ve = cleanDate(parsed.endDate || "");
let aligned = true;
if (ce && ve) aligned = ce === ve;
else if (cs && vs) aligned = cs === vs;
return { has: true, aligned, compStart: aligned ? "" : cs };
}

["m", "ai", "edit"].forEach(p => {
const hasEl = document.getElementById(p + "HasComp");
if (!hasEl) return;
hasEl.addEventListener("change", () => compRender(p));
document.getElementById(p + "CompAligned").addEventListener("change", () => {
if (document.getElementById(p + "CompAligned").checked) document.getElementById(p + "CompStart").value = "";
compRender(p);
});
document.getElementById(p + "CompStart").addEventListener("change", () => compAutoJudge(p));
const vs = document.getElementById(COMP_START_INPUT[p]);
if (vs) vs.addEventListener("change", () => compAutoJudge(p));
compRender(p);
});
