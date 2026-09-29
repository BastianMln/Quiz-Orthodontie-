/* ============================================================
   QUIZ ODF — interface
   ============================================================ */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function inl(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
/* texte simple -> HTML : ligne vide = paragraphe, « - » = liste, **gras** */
function md(s) {
  if (!s) return "";
  return String(s).split(/\n\s*\n/).map(block => {
    let out = "", para = [], list = [];
    const flushP = () => { if (para.length) { out += "<p>" + para.map(inl).join("<br>") + "</p>"; para = []; } };
    const flushL = () => { if (list.length) { out += "<ul>" + list.map(l => "<li>" + inl(l) + "</li>").join("") + "</ul>"; list = []; } };
    block.split("\n").forEach(line => {
      if (/^\s*-\s+/.test(line)) { flushP(); list.push(line.replace(/^\s*-\s+/, "")); }
      else if (line.trim()) { flushL(); para.push(line.trim()); }
    });
    flushP(); flushL(); return out;
  }).join("");
}
function rid(p) { return p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
const plural = (n, w, ws) => n + " " + (n > 1 ? (ws || w + "s") : w);
const LETTERS = "ABCDEFGH";
const KINDS = ["Cours", "Notes perso", "Synthèse / article", "Livre", "Thèse", "Conférence", "Autre"];
const SCHEMA_LABELS = { facemask: "Masque facial", wires: "Courbes charge-flexion des fils", saos: "Arbre décisionnel TROS", implant: "Espace implant latérale", cvm: "Stades CVM", suture: "Stades d'Angelieri", resorp: "Résorption : ingression vs translation", anb: "ANB et AO-BO", elastic: "Décomposition élastique cl. II", moves: "Centre de rotation selon le mouvement", bowing: "Effet bowing", canine: "Traction canine palatine", binding: "Arc-boutement" };

let STAGE = "loading"; /* loading | token | create | unlock | ready */
let VIEW = { tab: "rev", mode: "home", sub: "docs", edit: null, confirm: null, doc: null, theme: null, manage: false, renaming: null,
  filter: { kind: "", q: "", serie: "", theme: "" }, compose: { sel: [], filter: "all", count: "20" }, request: null };
let S = { list: [], i: 0, sel: [], done: false, results: {}, name: "" };

/* ---------- données dérivées ---------- */
function seriesSorted() { return Object.entries(DATA.series).sort((a, b) => (b[1].order || 0) - (a[1].order || 0)); }
function themesSorted() { return Object.entries(DATA.themes).sort((a, b) => (a[1].order || 0) - (b[1].order || 0) || a[1].name.localeCompare(b[1].name, "fr")); }
function themeName(id) { return (DATA.themes[id] || {}).name || ""; }
function qidsOf(sid) { return Object.entries(DATA.qs).filter(([id, q]) => q.serie === sid).sort((a, b) => (a[1].order || 0) - (b[1].order || 0)).map(([id]) => id); }
function qidsOfThemes(ids) { const set = new Set(ids); return Object.entries(DATA.qs).filter(([id, q]) => (q.themes || []).some(t => set.has(t))).map(([id]) => id); }
function docsOfTheme(tid) { return Object.entries(DATA.lib).filter(([id, d]) => (d.themes || []).includes(tid)); }
function docUse(docId) {
  let primary = [], cited = [];
  for (const [id, q] of Object.entries(DATA.qs)) { const d = q.docs || []; if (d[0] === docId) primary.push(id); else if (d.includes(docId)) cited.push(id); }
  return { primary, cited };
}
function lastWrongIds(ids) { return ids.filter(id => { const h = PROG[id]; return h && h.length && !h[h.length - 1].full; }); }
function lastOkIds(ids) { return ids.filter(id => { const h = PROG[id]; return h && h.length && h[h.length - 1].full; }); }
function neverIds(ids) { return ids.filter(id => !(PROG[id] && PROG[id].length)); }
function doneCount(ids) { return ids.filter(id => PROG[id] && PROG[id].length).length; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/* mélange, mais garde les étapes d'un même dossier dans l'ordre */
function mixKeepDossiers(ids) {
  const out = shuffle(ids); const byD = {};
  out.forEach((id, pos) => { const q = DATA.qs[id]; if (q && q.dossier) (byD[q.dossier] = byD[q.dossier] || []).push(pos); });
  for (const pos of Object.values(byD)) { const sorted = pos.map(p => out[p]).sort((a, b) => (DATA.qs[a].step || 0) - (DATA.qs[b].step || 0)); pos.forEach((p, k) => out[p] = sorted[k]); }
  return out;
}

/* ---------- interface commune ---------- */
let toastT = null;
function toast(msg) { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3400); }
function ago(ts) {
  if (!ts) return "jamais"; const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return "à l'instant"; if (s < 3600) return "il y a " + Math.round(s / 60) + " min";
  if (s < 86400) return "il y a " + Math.round(s / 3600) + " h"; return "le " + new Date(ts).toLocaleDateString("fr-FR");
}
function statusInfo() {
  const pending = META.contentDirty || META.progDirty || META.imgUp.length || META.imgDel.length;
  if (SYNC.busy) return { cls: "cache", txt: "Synchronisation…" };
  if (!navigator.onLine || SYNC.error === "offline") return { cls: "cache", txt: "Hors ligne" + (pending ? " · tes changements seront envoyés au retour du réseau" : " · tout est disponible sur cet appareil") };
  if (SYNC.error === "token") return { cls: "bad", txt: "Jeton GitHub refusé · remplace-le dans Réglages" };
  if (SYNC.error === "forbidden") return { cls: "bad", txt: "Le jeton ne permet pas d'écrire dans le dépôt · voir Réglages" };
  if (SYNC.error) return { cls: "cache", txt: "Synchronisation en échec · nouvel essai automatique" };
  if (pending) return { cls: "cache", txt: "Modifications en attente d'envoi" };
  return { cls: "live", txt: "Synchronisé " + ago(META.lastSync) };
}
function setStatus() {
  const el = $("#status"); if (!el) return;
  if (STAGE !== "ready") { el.innerHTML = ""; return; }
  const s = statusInfo();
  el.className = "status " + s.cls;
  el.innerHTML = '<span class="dot"></span><span>' + esc(s.txt) + "</span>";
}
onSyncState = function (changed) {
  setStatus();
  if (changed && STAGE === "ready") softRender();
  if (VIEW.tab === "set" && !VIEW.edit) renderSettings();
};
function setNav() {
  $("#tabbar").hidden = STAGE !== "ready";
  $$("#tabbar button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === VIEW.tab ? "page" : "false"));
}
function render() {
  setStatus(); setNav();
  if (STAGE === "token") return setupToken();
  if (STAGE === "create") return setupCreate();
  if (STAGE === "unlock") return setupUnlock();
  if (STAGE !== "ready") return;
  if (VIEW.tab === "lib") return renderLib();
  if (VIEW.tab === "themes") return renderThemes();
  if (VIEW.tab === "set") return renderSettings();
  if (VIEW.mode === "home") return home();
  if (VIEW.mode === "end") return end();
}
function softRender() {
  if (VIEW.tab === "rev" && VIEW.mode === "home") home();
  else if (VIEW.tab === "lib" && !VIEW.edit) renderLib();
  else if (VIEW.tab === "themes" && !VIEW.renaming) renderThemes();
}
function page(html) { $("#app").innerHTML = html; hydrateImages($("#app")); }

/* ============================================================
   MISE EN PLACE : jeton, mot de passe
   ============================================================ */
function setupToken(err) {
  $("#track").innerHTML = ""; $("#qset").textContent = "";
  page(`<div class="panel">
    <span class="eyebrow">Première ouverture sur cet appareil</span>
    <h1 style="font-size:24px;margin:6px 0 10px">Relier l'app à ton dépôt GitHub</h1>
    <p>L'app garde tes questions et ta progression dans ton dépôt <b class="mono">${GH.owner}/${GH.repo}</b>, chiffrées. Il lui faut une clé d'accès (jeton) pour y écrire.</p>
    <ol class="steps">
      <li>Ouvre <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">la page de création de jeton GitHub</a>.</li>
      <li>Nom : <i>Quiz ODF</i>. Expiration : la plus longue proposée (ou « No expiration »).</li>
      <li>Repository access : <b>Only select repositories</b> → <b>${GH.repo}</b>.</li>
      <li>Permissions → Repository permissions → <b>Contents : Read and write</b>.</li>
      <li>Generate token, copie-le et colle-le ci-dessous.</li>
    </ol>
    <label class="f">Jeton GitHub<input type="password" id="tok" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…"></label>
    ${err ? `<p class="errmsg">${esc(err)}</p>` : ""}
    <div class="actions"><button class="btn" id="tokgo">Relier</button></div>
    <p class="muted">Sur iPhone et Mac, le même jeton se colle d'un appareil à l'autre grâce au presse-papiers partagé. Il reste sur l'appareil et n'est envoyé qu'à GitHub.</p>
  </div>`);
  const go = async () => {
    const v = $("#tok").value.replace(/[\s\u200B-\u200D\uFEFF]/g, ""); if (!v) return;
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]+$/.test(v)) return setupToken("Ce texte ne ressemble pas à un jeton GitHub : il doit commencer par « github_pat_ » (ou « ghp_ ») et ne contenir que des lettres, chiffres et « _ ». Recopie-le en entier depuis GitHub (bouton de copie à droite du jeton).");
    const b = $("#tokgo"); b.disabled = true; b.textContent = "Vérification…";
    TOKEN = v;
    try {
      await ghCheckAccess();
      await saveToken(TOKEN);
      await afterToken();
    } catch (e) {
      TOKEN = "";
      const m = { token: "GitHub refuse ce jeton" + (e.detail ? " (« " + e.detail + " »)" : "") + ". Longueur collée : " + v.length + " caractères (un jeton récent en fait 93). S'il est plus court, il a été coupé : recopie-le avec le bouton de copie. Sinon, crée-en un nouveau : un jeton n'est affiché qu'une fois.", norepo: `Dépôt ${GH.owner}/${GH.repo} introuvable avec ce jeton : vérifie qu'il donne accès à ${GH.repo}.`, readonly: "Ce jeton ne peut que lire. Donne-lui « Contents : Read and write ».", offline: "Pas de connexion : la première mise en place demande internet.", nobranch: "Impossible de préparer le dépôt (il est peut-être vide)." }[e.code] || "Échec de la vérification (" + (e.code || e.message) + ").";
      setupToken(m);
    }
  };
  $("#tokgo").onclick = go; $("#tok").onkeydown = e => { if (e.key === "Enter") go(); };
}
async function afterToken() {
  const k = await ghGet("vault/keys.json");
  if (k) { KEYS_FILE = JSON.parse(k.text); await saveKeysFile(KEYS_FILE); STAGE = "unlock"; }
  else STAGE = "create";
  render();
}
function setupCreate(err) {
  page(`<div class="panel">
    <span class="eyebrow">Une seule fois</span>
    <h1 style="font-size:24px;margin:6px 0 10px">Choisis ton mot de passe</h1>
    <p>Il chiffre tout ton contenu avant l'envoi sur GitHub. Sans lui, personne ne peut lire tes questions ni tes notes, pas même moi.</p>
    <div class="warn-box"><b>Il ne peut pas être récupéré.</b> Enregistre-le dans ton trousseau (app Mots de passe) : c'est lui que tu taperas sur ton deuxième appareil.</div>
    <label class="f">Mot de passe <small>au moins 10 caractères</small><input type="password" id="pw1" autocomplete="new-password"></label>
    <label class="f">Confirme le mot de passe<input type="password" id="pw2" autocomplete="new-password"></label>
    ${err ? `<p class="errmsg">${esc(err)}</p>` : ""}
    <div class="actions"><button class="btn" id="pwgo">Créer mon coffre</button></div>
  </div>`);
  $("#pwgo").onclick = async () => {
    const a = $("#pw1").value, b = $("#pw2").value;
    if (a.length < 10) return setupCreate("Au moins 10 caractères, s'il te plaît.");
    if (a !== b) return setupCreate("Les deux mots de passe ne sont pas identiques.");
    const btn = $("#pwgo"); btn.disabled = true; btn.textContent = "Création…";
    try {
      const ex = await ghGet("vault/keys.json");
      if (ex) { KEYS_FILE = JSON.parse(ex.text); await saveKeysFile(KEYS_FILE); STAGE = "unlock"; toast("Un coffre existe déjà : entre son mot de passe."); return render(); }
      const { file, key, raw } = await createKeys(a);
      await ghPut("vault/keys.json", JSON.stringify(file, null, 1), null, "création du coffre");
      KEYS_FILE = file; KEY = key;
      await saveKeysFile(file); await saveKey(key, raw);
      STAGE = "ready"; VIEW.tab = "rev"; VIEW.mode = "home"; render(); startLoops();
    } catch (e) { setupCreate("Échec (" + (e.code || e.message) + "). Réessaie."); }
  };
}
function setupUnlock(err) {
  page(`<div class="panel">
    <span class="eyebrow">Déverrouiller cet appareil</span>
    <h1 style="font-size:24px;margin:6px 0 10px">Ton mot de passe Quiz ODF</h1>
    <p>Celui que tu as choisi sur ton premier appareil. Il ne sera plus demandé ensuite sur celui-ci.</p>
    <label class="f">Mot de passe<input type="password" id="pw" autocomplete="current-password"></label>
    ${err ? `<p class="errmsg">${esc(err)}</p>` : ""}
    <div class="actions"><button class="btn" id="ungo">Déverrouiller</button></div>
  </div>`);
  const go = async () => {
    const b = $("#ungo"); b.disabled = true; b.textContent = "Vérification…";
    let raw;
    try { const k = await unlockKeys(KEYS_FILE, $("#pw").value, true); raw = b64(await crypto.subtle.exportKey("raw", k)); KEY = await importRawKey(raw); }
    catch (e) { return setupUnlock("Mot de passe incorrect."); }
    await saveKey(KEY, raw);
    STAGE = "ready"; VIEW.tab = "rev"; VIEW.mode = "home"; render(); startLoops();
  };
  $("#ungo").onclick = go; $("#pw").onkeydown = e => { if (e.key === "Enter") go(); };
}

/* ============================================================
   RÉVISER
   ============================================================ */
function renderTrack() {
  const tr = $("#track");
  if (VIEW.tab !== "rev" || VIEW.mode === "home") { tr.innerHTML = ""; return; }
  tr.innerHTML = S.list.map((id, k) => {
    const r = S.results[id]; const n = (DATA.qs[id] && DATA.qs[id].opts.length) || 5;
    const c = r ? (r.full ? "ok" : (r.good >= Math.ceil(n * 0.6) ? "part" : "bad")) : (k === S.i && VIEW.mode === "q" ? "cur" : "");
    return `<i class="${c}" title="Question ${k + 1}"></i>`;
  }).join("");
}
function home() {
  VIEW.mode = "home"; renderTrack(); $("#qset").textContent = "DES 2";
  const ss = seriesSorted();
  const allIds = Object.keys(DATA.qs); const wAll = lastWrongIds(allIds).length;
  const empty = !allIds.length;
  page(`
  <section class="hero">
    <span class="eyebrow">DES d'ODF · 2e année</span>
    <h1>Tes séries de QCM</h1>
    <p>Une à toutes les propositions peuvent être justes. La correction s'affiche dès que tu valides : l'essentiel d'abord, puis le détail et les sources.</p>
  </section>
  ${empty ? `<div class="panel" style="margin-bottom:14px"><h2 style="font-size:17px">En attente de ton contenu</h2><p>Ton coffre est prêt. Dis à Claude « fait » : il y déposera tes documents, tes thèmes et les séries 01 et 02, chiffrés. Ils apparaîtront ici tout seuls.</p><div class="actions"><button class="btn ghost" id="chk">Vérifier maintenant</button></div></div>` : ""}
  ${ss.length ? `<div class="series">${ss.map(([sid, sr], k) => {
    const ids = qidsOf(sid); const w = lastWrongIds(ids).length, d = doneCount(ids);
    return `<div class="serie"><div><span class="eyebrow">${k === 0 ? "La plus récente" : "Série"}</span><h2>${esc(sr.name)}</h2><p>${esc(sr.sub || "")}</p><div class="meta">${plural(ids.length, "question")} · ${d} déjà faite${d > 1 ? "s" : ""}${sr.note ? " · " + esc(sr.note) : ""}</div></div>
    <div class="btns">${ids.length ? `<button class="btn" data-s="${sid}">Commencer</button>` : ""}${w ? `<button class="btn ghost" data-w="${sid}">Revoir ${plural(w, "erreur")}</button>` : ""}</div></div>`;
  }).join("")}</div>` : ""}
  ${allIds.length ? `<div class="actions" style="margin:0 0 14px"><button class="btn ghost" id="bytheme">Réviser par thème</button><button class="btn ghost" id="askhome">Demander une nouvelle série</button>${wAll ? `<button class="btn ghost" id="allw">Revoir toutes mes erreurs (${wAll})</button>` : ""}</div>` : ""}
  <div class="panel">
    <div class="rules">
      <div class="rule"><b>Notation tout ou rien</b>La question compte seulement si toutes les propositions sont bien traitées, comme à l'examen.</div>
      <div class="rule"><b>Notation fine</b>Nombre de propositions correctement cochées ou laissées.</div>
      <div class="rule"><b>Partout, même sans réseau</b>Tout est gardé sur l'appareil et se synchronise dès que tu es en ligne.</div>
    </div>
    <p class="small">Raccourcis clavier : A à E ou 1 à 5 pour cocher, Entrée pour valider puis continuer.</p>
  </div>`);
  $$("[data-s]").forEach(b => b.onclick = () => startRun(qidsOf(b.dataset.s), DATA.series[b.dataset.s].name));
  $$("[data-w]").forEach(b => b.onclick = () => startRun(lastWrongIds(qidsOf(b.dataset.w)), DATA.series[b.dataset.w].name + " · erreurs"));
  const aw = $("#allw"); if (aw) aw.onclick = () => startRun(lastWrongIds(seriesSorted().flatMap(([sid]) => qidsOf(sid))), "Mes erreurs");
  const bt = $("#bytheme"); if (bt) bt.onclick = () => go("themes");
  const ah = $("#askhome"); if (ah) ah.onclick = () => { go("themes"); openRequest([]); };
  const ck = $("#chk"); if (ck) ck.onclick = () => { toast("Vérification…"); sync(); };
}
function startRun(list, name) { if (!list.length) { toast("Aucune question ne correspond."); return; } VIEW.tab = "rev"; setNav(); S = { list: list.slice(), i: 0, sel: [], done: false, results: {}, name }; question(); }
function qChips(q) {
  const th = (q.themes || []).map(themeName).filter(Boolean);
  return `<div class="chips"><span class="chip theme">${esc(q.theme || th[0] || "Question")}</span>${th.filter(t => t !== q.theme).slice(0, 3).map(t => `<span class="chip">${esc(t)}</span>`).join("")}${q.level ? `<span class="chip">${esc(q.level)}</span>` : ""}<span class="chip mono">${S.i + 1} / ${S.list.length}</span></div>`;
}
function question() {
  VIEW.mode = "q"; S.sel = []; S.done = false; renderTrack();
  const id = S.list[S.i], q = DATA.qs[id];
  if (!q) { S.i++; return S.i < S.list.length ? question() : end(); }
  $("#qset").textContent = S.name || "";
  const dz = q.dossier && DATA.dossiers[q.dossier];
  page(`
  <article class="panel" aria-live="polite">
    ${qChips(q)}
    ${dz ? `<div class="dossier">${q.of ? `<span class="eyebrow">Étape ${q.step} / ${q.of}</span>` : ""}<h3>${esc(dz.title)}</h3><p>${esc(dz.intro)}</p>${q.add ? `<p class="new"><b>${q.step > 1 ? "Suite" : "Aujourd'hui"}</b>${esc(q.add)}</p>` : ""}</div>` : ""}
    <h2 class="stem">${esc(q.stem)}</h2>
    ${q.image ? `<img class="photo" data-img="${esc(q.image)}" alt="Illustration clinique de la question">` : ""}
    <div class="hint">Une ou plusieurs réponses exactes.</div>
    <div class="opts" role="group" aria-label="Propositions">
      ${q.opts.map((o, i) => `<button class="opt" role="checkbox" aria-checked="false" data-i="${i}" id="o${i}"><span class="k">${LETTERS[i]}</span><span class="t">${esc(o.t)}<span class="why" hidden></span></span></button>`).join("")}
    </div>
    <div class="actions" id="qact"><button class="btn" id="validate" disabled>Valider</button><span class="small" id="selcount">Aucune proposition cochée</span><button class="btn ghost" id="quit" style="margin-left:auto">Arrêter</button></div>
    <div id="after"></div>
  </article>`);
  $$(".opt").forEach(b => b.onclick = () => toggle(+b.dataset.i));
  $("#validate").onclick = validate;
  $("#quit").onclick = () => { if (Object.keys(S.results).length) end(); else { VIEW.mode = "home"; home(); } };
  window.scrollTo({ top: 0 });
}
function toggle(i) {
  if (S.done) return;
  const k = S.sel.indexOf(i); if (k >= 0) S.sel.splice(k, 1); else S.sel.push(i);
  $$(".opt").forEach(b => b.setAttribute("aria-checked", S.sel.includes(+b.dataset.i)));
  $("#validate").disabled = S.sel.length === 0;
  const n = S.sel.length; $("#selcount").textContent = n ? `${n} proposition${n > 1 ? "s" : ""} cochée${n > 1 ? "s" : ""}` : "Aucune proposition cochée";
}
function grade(q, sel) { let good = 0; q.opts.forEach((o, i) => { if (sel.includes(i) === !!o.ok) good++; }); return { good, full: good === q.opts.length }; }
function validate() {
  if (S.done || !S.sel.length) return;
  S.done = true;
  const id = S.list[S.i], q = DATA.qs[id], g = grade(q, S.sel);
  S.results[id] = g;
  recordAnswer(id, { d: Date.now(), full: g.full, good: g.good });
  renderTrack();
  correction(q, S.sel, g, false);
}
function sourcesHTML(q) {
  const docs = (q.docs || []).map(id => [id, DATA.lib[id]]).filter(x => x[1]);
  if (!docs.length) return "";
  return `<section class="sec"><h3>Sources</h3><ul class="refs">${docs.map(([id, d]) => {
    if (d.kind === "Synthèse / article") return `<li><span class="lvl">${esc(d.level || "Article")}</span>${esc(d.ref || d.title)} ${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.idLabel || "lien")}</a>` : ""}</li>`;
    return `<li><span class="lvl course">${esc(d.kind)}</span>${esc(d.title)}${d.location ? ` <span class="mono" style="font-size:12px">${esc(d.location)}</span>` : ""}${d.url ? ` <a href="${esc(d.url)}" target="_blank" rel="noopener">lien</a>` : ""}</li>`;
  }).join("")}</ul></section>`;
}
function correction(q, sel, g, isReview) {
  const n = q.opts.length;
  $$(".opt").forEach(b => {
    const i = +b.dataset.i, o = q.opts[i], picked = sel.includes(i);
    b.classList.add("locked"); b.setAttribute("aria-disabled", "true");
    let cls, tag;
    if (isReview) { cls = o.ok ? "r-ok" : "r-quiet"; tag = o.ok ? '<span class="tag ok">Juste</span>' : '<span class="tag neutral">Faux</span>'; }
    else if (picked && o.ok) { cls = "r-ok"; tag = '<span class="tag ok">Juste, coché</span>'; }
    else if (picked && !o.ok) { cls = "r-bad"; tag = '<span class="tag bad">Faux, coché</span>'; }
    else if (!picked && o.ok) { cls = "r-miss"; tag = '<span class="tag miss">Juste, oublié</span>'; }
    else { cls = "r-quiet"; tag = '<span class="tag neutral">Faux, bien laissé</span>'; }
    b.classList.add(cls);
    const w = b.querySelector(".why"); w.innerHTML = tag + esc(o.why || ""); w.hidden = false;
  });
  $("#qact").hidden = true;
  const vcls = isReview ? "ok" : (g.full ? "ok" : (g.good >= Math.ceil(n * 0.6) ? "part" : "bad"));
  const vtxt = isReview ? "Correction" : (g.full ? "Tout juste" : (g.good >= Math.ceil(n * 0.6) ? "Partiellement juste" : "À revoir"));
  const last = S.i === S.list.length - 1;
  const fig = (q.schema && typeof SCHEMAS !== "undefined" && SCHEMAS[q.schema]) ? `<figure class="fig" style="margin:0">${SCHEMAS[q.schema]()}${q.caption ? `<figcaption>${esc(q.caption)}</figcaption>` : ""}</figure>` : "";
  const more = [q.cours ? `<section class="sec"><h3>Ce que dit ton cours</h3><div class="body">${md(q.cours)}</div></section>` : "",
    q.lit ? `<section class="sec lit"><h3>Ce que disent les synthèses</h3><div class="body">${md(q.lit)}</div></section>` : "",
    q.piege ? `<section class="sec trap"><h3>Le piège</h3><div class="body">${md(q.piege)}</div></section>` : "",
    sourcesHTML(q)].join("");
  $("#after").innerHTML = `
    <div class="verdict ${vcls}"><span>${vtxt}</span><span class="sc">tout ou rien : ${g.full ? 1 : 0}/1 · fine : ${g.good}/${n} · réponse : ${q.opts.map((o, i) => o.ok ? LETTERS[i] : "").join("")}</span></div>
    <div class="expl">
      ${q.ess ? `<section class="sec ess"><h3>L'essentiel</h3><div class="body">${md(q.ess)}</div></section>` : ""}
      ${fig}
      ${more ? (q.ess ? `<details class="more"><summary>Approfondir : cours, synthèses, sources</summary><div class="inner">${more}</div></details>` : more) : ""}
    </div>
    <div id="chat" class="chat"></div>
    <div class="actions"><button class="btn" id="next">${isReview ? "Retour au bilan" : (last ? "Voir mon bilan" : "Question suivante")}</button></div>`;
  mountChat(S.list[S.i], q, sel);
  const nx = $("#next");
  nx.onclick = () => { if (isReview || last) end(); else { S.i++; question(); } };
  nx.focus({ preventScroll: true });
}
function end() {
  VIEW.mode = "end"; renderTrack();
  const ids = S.list.filter(id => S.results[id] && DATA.qs[id]);
  const full = ids.filter(id => S.results[id].full).length;
  const fine = ids.reduce((a, id) => a + S.results[id].good, 0), max = ids.reduce((a, id) => a + DATA.qs[id].opts.length, 0) || 1;
  page(`
  <div class="panel">
    <span class="eyebrow">Bilan · ${esc(S.name || "")}</span>
    <div class="score"><div><span class="n">${full}/${ids.length}</span><span class="l">tout ou rien</span></div><div><span class="n">${Math.round(100 * fine / max)} %</span><span class="l">propositions justes (${fine}/${max})</span></div></div>
    <div class="rows">${ids.map(id => {
      const r = S.results[id], q = DATA.qs[id], n = q.opts.length; const c = r.full ? "ok" : (r.good >= Math.ceil(n * 0.6) ? "part" : "bad");
      return `<div class="row"><span class="d ${c}"></span><button data-r="${id}">${esc(q.theme || "Question")}</button><span class="m">${r.good}/${n}</span></div>`;
    }).join("")}</div>
    <p class="small">Touche une ligne pour revoir sa correction.</p>
    <div class="actions">${ids.some(id => !S.results[id].full) ? `<button class="btn" id="redo">Refaire mes erreurs</button>` : ""}<button class="btn ghost" id="gohome">Retour à l'accueil</button></div>
  </div>`);
  $$("[data-r]").forEach(b => b.onclick = () => { S.i = S.list.indexOf(b.dataset.r); question(); S.done = true; VIEW.mode = "review"; correction(DATA.qs[b.dataset.r], [], S.results[b.dataset.r], true); });
  const r = $("#redo"); if (r) r.onclick = () => startRun(ids.filter(id => !S.results[id].full), (S.name || "") + " · erreurs");
  $("#gohome").onclick = () => { VIEW.mode = "home"; home(); };
  if (META.progDirty) scheduleSync(0);
}

/* ============================================================
   THÉMATIQUES
   ============================================================ */
function themeStats(tid) {
  const ids = qidsOfThemes([tid]);
  return { ids, n: ids.length, ok: lastOkIds(ids).length, wrong: lastWrongIds(ids).length, never: neverIds(ids).length, docs: docsOfTheme(tid).length };
}
function bar(st) {
  if (!st.n) return `<div class="pbar empty"></div>`;
  const p = x => (100 * x / st.n).toFixed(1) + "%";
  return `<div class="pbar" aria-label="${st.ok} réussies, ${st.wrong} à revoir, ${st.never} jamais faites"><i class="ok" style="width:${p(st.ok)}"></i><i class="bad" style="width:${p(st.wrong)}"></i></div>`;
}
function composePool() {
  const c = VIEW.compose; let ids = qidsOfThemes(c.sel);
  if (c.filter === "new") ids = neverIds(ids); else if (c.filter === "wrong") ids = lastWrongIds(ids);
  return ids;
}
function renderThemes() {
  renderTrack(); $("#qset").textContent = "Thématiques";
  if (VIEW.request) return requestForm();
  if (VIEW.manage) return manageThemes();
  if (VIEW.theme && DATA.themes[VIEW.theme]) return themeDetail(VIEW.theme);
  const ts = themesSorted(); const c = VIEW.compose;
  c.sel = c.sel.filter(t => DATA.themes[t]);
  const pool = composePool(); const count = c.count === "all" ? pool.length : Math.min(pool.length, +c.count);
  page(`
  <section class="panel" style="margin-bottom:14px">
    <h2 style="font-size:18px">Composer un quiz</h2>
    <p class="muted" style="margin:4px 0 12px">Coche un ou plusieurs thèmes : les questions sont mélangées, les étapes d'un dossier restent dans l'ordre.</p>
    <div class="tchips">${ts.map(([tid, t]) => { const n = qidsOfThemes([tid]).length; return `<button class="tchip" aria-pressed="${c.sel.includes(tid)}" data-sel="${tid}" ${n ? "" : "disabled"}>${esc(t.name)} <span class="count">${n}</span></button>`; }).join("")}</div>
    <div class="grid2" style="margin-top:12px">
      <label class="f">Questions<select id="cfilter"><option value="all" ${c.filter === "all" ? "selected" : ""}>Toutes</option><option value="new" ${c.filter === "new" ? "selected" : ""}>Jamais faites</option><option value="wrong" ${c.filter === "wrong" ? "selected" : ""}>Mes erreurs</option></select></label>
      <label class="f">Nombre<select id="ccount">${["10", "20", "40", "all"].map(v => `<option value="${v}" ${c.count === v ? "selected" : ""}>${v === "all" ? "Toutes" : v}</option>`).join("")}</select></label>
    </div>
    <div class="actions"><button class="btn" id="cgo" ${count ? "" : "disabled"}>${c.sel.length ? (count ? `Lancer ${plural(count, "question")}` : "Aucune question") : "Choisis au moins un thème"}</button>${c.sel.length ? `<button class="btn ghost" id="cclear">Tout décocher</button>` : ""}</div>
  </section>
  <section class="panel askpanel" style="margin-bottom:14px"><div><h2 style="font-size:17px">Envie d'une nouvelle série ?</h2><p class="muted" style="margin:4px 0 0">Choisis les thèmes et le format : la demande s'ouvre dans Claude, déjà rédigée.</p></div><button class="btn" id="askserie">Demander une série</button></section>
  <div class="tools"><h2 style="font-size:17px;flex:1">Tous les thèmes</h2><button class="btn ghost" id="tmanage">Ajouter ou supprimer des thèmes</button></div>
  <div class="tgrid">${ts.map(([tid, t]) => { const st = themeStats(tid);
    return `<button class="tcard" data-open="${tid}"><span class="ti">${esc(t.name)}</span><span class="su">${plural(st.n, "question")} · ${plural(st.docs, "document")}</span>${bar(st)}<span class="su">${st.n ? `${st.ok} réussie${st.ok > 1 ? "s" : ""} · ${st.wrong} à revoir · ${st.never} jamais faite${st.never > 1 ? "s" : ""}` : "Pas encore de question"}</span></button>`; }).join("") || `<div class="empty">Aucun thème. Ajoute-en avec le bouton ci-dessus.</div>`}</div>`);
  $$("[data-sel]").forEach(b => b.onclick = () => { const t = b.dataset.sel; c.sel = c.sel.includes(t) ? c.sel.filter(x => x !== t) : c.sel.concat(t); renderThemes(); });
  $("#cfilter").onchange = e => { c.filter = e.target.value; renderThemes(); };
  $("#ccount").onchange = e => { c.count = e.target.value; renderThemes(); };
  const cg = $("#cgo"); if (cg) cg.onclick = () => { const l = mixKeepDossiers(composePool()).slice(0, c.count === "all" ? undefined : +c.count); startRun(l, c.sel.map(themeName).join(" + ")); };
  const cc = $("#cclear"); if (cc) cc.onclick = () => { c.sel = []; renderThemes(); };
  $("#tmanage").onclick = () => { VIEW.manage = true; renderThemes(); };
  $("#askserie").onclick = () => openRequest(c.sel);
  $$("[data-open]").forEach(b => b.onclick = () => { VIEW.theme = b.dataset.open; renderThemes(); window.scrollTo({ top: 0 }); });
}
function themeDetail(tid) {
  const t = DATA.themes[tid], st = themeStats(tid), docs = docsOfTheme(tid).sort((a, b) => KINDS.indexOf(a[1].kind) - KINDS.indexOf(b[1].kind) || a[1].title.localeCompare(b[1].title, "fr"));
  page(`<div class="panel">
    <div class="tools"><button class="sbtn" id="back">← Thèmes</button></div>
    <span class="eyebrow">Thème</span><h1 style="font-size:24px;margin:4px 0 8px">${esc(t.name)}</h1>
    ${bar(st)}
    <p class="muted">${plural(st.n, "question")} · ${st.ok} réussie${st.ok > 1 ? "s" : ""} · ${st.wrong} à revoir · ${st.never} jamais faite${st.never > 1 ? "s" : ""}</p>
    <div class="actions">${st.n ? `<button class="btn" data-run="all">Toutes (${st.n})</button>` : ""}${st.never ? `<button class="btn ghost" data-run="new">Jamais faites (${st.never})</button>` : ""}${st.wrong ? `<button class="btn ghost" data-run="wrong">Mes erreurs (${st.wrong})</button>` : ""}</div>
    <h3 style="font-size:15px;margin:22px 0 8px">Documents du thème</h3>
    <div class="list">${docs.map(([id, d]) => `<button class="item link" data-doc="${id}"><div><div class="ti">${esc(d.title)}</div><div class="su">${esc(d.kind)}${d.level ? " · " + esc(d.level) : ""}</div></div><span class="chev">›</span></button>`).join("") || `<div class="empty">Aucun document rattaché. Tu peux en rattacher depuis la Bibliothèque.</div>`}</div>
  </div>`);
  $("#back").onclick = () => { VIEW.theme = null; renderThemes(); };
  $$("[data-run]").forEach(b => b.onclick = () => { const k = b.dataset.run; let ids = st.ids; if (k === "new") ids = neverIds(ids); if (k === "wrong") ids = lastWrongIds(ids); startRun(mixKeepDossiers(ids), t.name); });
  $$("[data-doc]").forEach(b => b.onclick = () => { VIEW.tab = "lib"; VIEW.sub = "docs"; VIEW.doc = b.dataset.doc; setNav(); renderLib(); window.scrollTo({ top: 0 }); });
}
function manageThemes() {
  const ts = themesSorted();
  page(`<div class="panel">
    <div class="tools"><button class="sbtn" id="back">← Thèmes</button><h2 style="font-size:18px;flex:1">Gérer les thématiques</h2></div>
    <div class="tools"><input type="text" id="newt" placeholder="Nouveau thème, ex. Orthodontie et parodontite" aria-label="Nom du nouveau thème"><button class="btn" id="addt">Ajouter</button></div>
    <div class="list">${ts.map(([tid, t]) => { const nq = qidsOfThemes([tid]).length, nd = docsOfTheme(tid).length;
      return `<div><div class="item"><div>${VIEW.renaming === tid ? `<input type="text" id="ren" value="${esc(t.name)}" aria-label="Nouveau nom">` : `<div class="ti">${esc(t.name)}</div>`}<div class="su">${plural(nq, "question")} · ${plural(nd, "document")}</div></div>
      <div class="acts">${VIEW.renaming === tid ? `<button class="sbtn" data-renok="${tid}">OK</button><button class="sbtn" data-cancel>Annuler</button>` : `<button class="sbtn" data-ren="${tid}">Renommer</button><button class="sbtn del" data-delt="${tid}">Supprimer</button>`}</div></div>
      ${VIEW.confirm && VIEW.confirm.id === tid ? `<div class="confirm"><div>Supprimer le thème « ${esc(t.name)} » ? ${nq || nd ? `Il sera retiré de ${plural(nq, "question")} et ${plural(nd, "document")}, qui eux restent.` : ""}</div><div class="actions" style="margin:0"><button class="btn danger" data-deltok="${tid}">Supprimer</button><button class="btn ghost" data-cancel>Annuler</button></div></div>` : ""}</div>`; }).join("")}</div>
  </div>`);
  $("#back").onclick = () => { VIEW.manage = false; VIEW.confirm = null; VIEW.renaming = null; renderThemes(); };
  const add = () => { const v = $("#newt").value.trim(); if (!v) return; if (ts.some(([, t]) => t.name.toLowerCase() === v.toLowerCase())) return toast("Ce thème existe déjà.");
    const maxo = Math.max(0, ...ts.map(([, t]) => t.order || 0)); putDoc("themes", rid("t"), { name: v, order: maxo + 1 }); toast("Thème ajouté"); manageThemes(); };
  $("#addt").onclick = add; $("#newt").onkeydown = e => { if (e.key === "Enter") add(); };
  $$("[data-ren]").forEach(b => b.onclick = () => { VIEW.renaming = b.dataset.ren; manageThemes(); const r = $("#ren"); r.focus(); r.select(); });
  $$("[data-renok]").forEach(b => b.onclick = () => { const v = $("#ren").value.trim(); if (v) putDoc("themes", b.dataset.renok, Object.assign({}, DATA.themes[b.dataset.renok], { name: v })); VIEW.renaming = null; manageThemes(); });
  const rn = $("#ren"); if (rn) rn.onkeydown = e => { if (e.key === "Enter") $("[data-renok]").click(); };
  $$("[data-cancel]").forEach(b => b.onclick = () => { VIEW.confirm = null; VIEW.renaming = null; manageThemes(); });
  $$("[data-delt]").forEach(b => b.onclick = () => { VIEW.confirm = { id: b.dataset.delt }; manageThemes(); });
  $$("[data-deltok]").forEach(b => b.onclick = () => {
    const tid = b.dataset.deltok;
    for (const [id, q] of Object.entries(DATA.qs)) if ((q.themes || []).includes(tid)) putDoc("questions", id, Object.assign({}, q, { themes: q.themes.filter(x => x !== tid) }));
    for (const [id, d] of Object.entries(DATA.lib)) if ((d.themes || []).includes(tid)) putDoc("library", id, Object.assign({}, d, { themes: d.themes.filter(x => x !== tid) }));
    delDoc("themes", tid); VIEW.confirm = null; VIEW.compose.sel = VIEW.compose.sel.filter(x => x !== tid); toast("Thème supprimé"); manageThemes();
  });
}

/* ============================================================
   DEMANDER UNE SÉRIE À CLAUDE
   ============================================================ */
function openRequest(sel) {
  VIEW.request = { themes: (sel || []).slice(), count: "15", format: "mix", focus: "equilibre", docs: [], notes: "" };
  VIEW.tab = "themes"; setNav(); renderThemes(); window.scrollTo({ top: 0 });
}
function nextSerie() {
  const maxo = Math.max(0, ...Object.values(DATA.series).map(s => s.order || 0));
  const n = maxo + 1; return { n, id: "s" + String(n).padStart(2, "0"), name: "Série " + String(n).padStart(2, "0") };
}
const REQ_FORMATS = { mix: "Mélange : questions isolées + 1 ou 2 dossiers progressifs", isolees: "Questions isolées uniquement", dossiers: "Dossiers progressifs uniquement (cas cliniques en étapes)" };
const REQ_FOCUS = { equilibre: "Équilibré : moitié raisonnement clinique et biomécanique, moitié connaissances", clinique: "Surtout raisonnement clinique et biomécanique", connaissances: "Surtout connaissances (cours et synthèses)" };
function buildPrompt(r) {
  const ns = nextSerie();
  const th = r.themes.map(t => `${themeName(t)} [${t}]`);
  const covered = Object.entries(DATA.qs).filter(([id, q]) => !r.themes.length || (q.themes || []).some(t => r.themes.includes(t)))
    .map(([id, q]) => `${id} (${q.theme || ""})`).slice(0, 80);
  const docIds = r.docs.length ? r.docs : Object.entries(DATA.lib).filter(([id, d]) => !r.themes.length || (d.themes || []).some(t => r.themes.includes(t))).map(([id]) => id);
  const docs = docIds.filter(id => DATA.lib[id]).slice(0, 60).map(id => `${id} : ${DATA.lib[id].title}${DATA.lib[id].location ? " (" + DATA.lib[id].location + ")" : ""}`);
  const allThemes = themesSorted().map(([tid, t]) => `${tid} = ${t.name}`);
  return [
    "/quiz-odf-serie",
    "",
    "Crée une nouvelle série pour mon app Quiz ODF (utilise la compétence quiz-odf-serie) et dépose-la dans mon coffre.",
    "",
    `- Série : ${ns.name} (id ${ns.id}, order ${ns.n})`,
    `- Thèmes : ${th.length ? th.join(", ") : "au choix, en mélangeant plusieurs thèmes"}`,
    `- Nombre de questions : ${r.count}`,
    `- Format : ${REQ_FORMATS[r.format]}`,
    `- Accent : ${REQ_FOCUS[r.focus]}`,
    r.notes ? `- Précisions : ${r.notes}` : "",
    "",
    r.docs.length ? "Documents à exploiter en priorité (id : titre) :" : "Documents de ma bibliothèque sur ces thèmes (id : titre), à citer par leur id s'ils servent de source :",
    ...docs.map(x => "  " + x),
    "",
    "Questions déjà présentes sur ces thèmes (ne pas les refaire) :",
    "  " + (covered.join(" ; ") || "aucune"),
    "",
    "Identifiants des thèmes de l'app :",
    "  " + allThemes.join(" ; "),
  ].filter(x => x !== null).join("\n").replace(/\n{3,}/g, "\n\n");
}
function requestForm() {
  const r = VIEW.request; const ns = nextSerie();
  const lib = Object.entries(DATA.lib).filter(([id, d]) => !r.themes.length || (d.themes || []).some(t => r.themes.includes(t)))
    .sort((a, b) => KINDS.indexOf(a[1].kind) - KINDS.indexOf(b[1].kind) || a[1].title.localeCompare(b[1].title, "fr"));
  const prompt = buildPrompt(r);
  page(`<div class="panel">
    <div class="tools"><button class="sbtn" id="back">← Thèmes</button><h2 style="font-size:18px;flex:1">Demander la ${esc(ns.name)}</h2></div>
    <div class="form">
      <div class="f" style="display:grid;gap:6px"><span style="font-size:13px;font-weight:600;color:var(--ink-2)">Thèmes <small style="font-weight:400;color:var(--ink-3)">aucun coché = mélange libre</small></span>
        <div class="tchips">${themesSorted().map(([tid, t]) => `<button class="tchip" aria-pressed="${r.themes.includes(tid)}" data-rt="${tid}">${esc(t.name)}</button>`).join("")}</div></div>
      <div class="grid2">
        <label class="f">Nombre de questions<select id="r_count">${["10", "15", "20", "30"].map(v => `<option ${r.count === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="f">Format<select id="r_format">${Object.entries(REQ_FORMATS).map(([k, v]) => `<option value="${k}" ${r.format === k ? "selected" : ""}>${esc(v.split(" :")[0].split(" (")[0])}</option>`).join("")}</select></label>
        <label class="f">Accent<select id="r_focus">${Object.entries(REQ_FOCUS).map(([k, v]) => `<option value="${k}" ${r.focus === k ? "selected" : ""}>${esc(v.split(" :")[0])}</option>`).join("")}</select></label>
      </div>
      <div class="f" style="display:grid;gap:6px"><span style="font-size:13px;font-weight:600;color:var(--ink-2)">Documents à exploiter en priorité <small style="font-weight:400;color:var(--ink-3)">facultatif</small></span>
        <div class="checks">${lib.map(([id, d]) => `<label><input type="checkbox" class="rdoc" value="${id}" ${r.docs.includes(id) ? "checked" : ""}><span>${esc(d.title)} <span class="k">${esc(d.kind)}</span></span></label>`).join("") || `<span class="muted">Aucun document sur ces thèmes.</span>`}</div></div>
      <label class="f">Précisions <small>ex. « sur mon cours de disjonction », « niveau examen », « plus de photos cliniques »</small><textarea id="r_notes">${esc(r.notes)}</textarea></label>
      <details class="more"><summary>Voir la demande qui sera envoyée</summary><div class="inner"><pre class="prompt">${esc(prompt)}</pre></div></details>
    </div>
    <div class="actions">
      <a class="btn" id="r_app" href="claude://claude.ai/new?q=${encodeURIComponent(prompt)}">Ouvrir dans l'app Claude</a>
      <a class="btn ghost" id="r_web" href="https://claude.ai/new?q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener">Ouvrir sur claude.ai</a>
      <button class="btn ghost" id="r_copy">Copier la demande</button>
    </div>
    <p class="muted">La demande ne contient que des titres et des identifiants, pas le contenu de tes questions. Une fois la série déposée, elle apparaît ici toute seule (ou avec « Synchroniser maintenant »).</p>
  </div>`);
  const keep = () => { r.count = val("r_count"); r.format = val("r_format"); r.focus = val("r_focus"); r.notes = $("#r_notes").value; r.docs = $$(".rdoc:checked").map(x => x.value); };
  $("#back").onclick = () => { VIEW.request = null; renderThemes(); };
  $$("[data-rt]").forEach(b => b.onclick = () => { keep(); const t = b.dataset.rt; r.themes = r.themes.includes(t) ? r.themes.filter(x => x !== t) : r.themes.concat(t); r.docs = r.docs.filter(id => { const d = DATA.lib[id]; return d && (!r.themes.length || (d.themes || []).some(x => r.themes.includes(x))); }); requestForm(); });
  ["r_count", "r_format", "r_focus"].forEach(id => $("#" + id).onchange = () => { keep(); requestForm(); });
  $$(".rdoc").forEach(x => x.onchange = () => { keep(); requestForm(); });
  $("#r_notes").onchange = () => { keep(); requestForm(); };
  const refresh = () => { keep(); const p = buildPrompt(r); $("#r_app").href = "claude://claude.ai/new?q=" + encodeURIComponent(p); $("#r_web").href = "https://claude.ai/new?q=" + encodeURIComponent(p); $(".prompt").textContent = p; };
  $("#r_notes").oninput = refresh;
  $("#r_copy").onclick = async () => { refresh(); try { await navigator.clipboard.writeText(buildPrompt(r)); toast("Demande copiée : colle-la dans une conversation Claude."); } catch (e) { toast("Copie impossible : ouvre « Voir la demande » et copie le texte."); } };
}

/* ============================================================
   BIBLIOTHÈQUE
   ============================================================ */
function renderLib() {
  renderTrack(); $("#qset").textContent = "Bibliothèque";
  if (VIEW.edit) return VIEW.edit.type === "doc" ? docForm() : VIEW.edit.type === "q" ? qForm() : VIEW.edit.type === "serie" ? serieForm() : dossierForm();
  if (VIEW.gen && DATA.lib[VIEW.gen.doc]) return genForm(VIEW.gen.doc);
  if (VIEW.doc && DATA.lib[VIEW.doc]) return docDetail(VIEW.doc);
  const sub = VIEW.sub;
  const head = `<div class="subnav" role="tablist">
      <button data-sub="docs" aria-current="${sub === "docs"}">Documents <span class="count">${Object.keys(DATA.lib).length}</span></button>
      <button data-sub="qs" aria-current="${sub === "qs"}">Questions <span class="count">${Object.keys(DATA.qs).length}</span></button>
      <button data-sub="series" aria-current="${sub === "series"}">Séries et dossiers</button>
    </div>`;
  let body = "";
  if (sub === "docs") body = docsList(); else if (sub === "qs") body = qsList(); else body = seriesList();
  page(`<div class="panel">${head}${body}</div>`);
  $$("[data-sub]").forEach(b => b.onclick = () => { VIEW.sub = b.dataset.sub; VIEW.confirm = null; renderLib(); });
  bindLib();
}
function themeSelect(id, cur) { return `<select id="${id}" aria-label="Thème"><option value="">Tous les thèmes</option>${themesSorted().map(([tid, t]) => `<option value="${tid}" ${cur === tid ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>`; }
function docsList() {
  const f = VIEW.filter; const qn = (f.q || "").toLowerCase();
  const rows = Object.entries(DATA.lib).filter(([id, d]) => (!f.kind || d.kind === f.kind) && (!f.theme || (d.themes || []).includes(f.theme)) && (!qn || (d.title + " " + (d.ref || "") + " " + (d.location || "") + " " + (d.note || "")).toLowerCase().includes(qn)))
    .sort((a, b) => KINDS.indexOf(a[1].kind) - KINDS.indexOf(b[1].kind) || a[1].title.localeCompare(b[1].title, "fr"));
  return `<div class="tools">
      <input type="search" id="fq" placeholder="Rechercher un document" value="${esc(f.q || "")}" aria-label="Rechercher un document">
      ${themeSelect("ftheme", f.theme)}
      <select id="fkind" aria-label="Type de document"><option value="">Tous les types</option>${KINDS.map(k => `<option ${f.kind === k ? "selected" : ""}>${k}</option>`).join("")}</select>
      <button class="btn" id="adddoc">Ajouter un document</button>
    </div>
    <p class="muted" style="margin:0 0 8px">${plural(rows.length, "document")}</p>
    <div class="list">${rows.length ? rows.map(([id, d]) => { const u = docUse(id); const th = (d.themes || []).map(themeName).filter(Boolean);
      return `<div><div class="item"><button class="linkbtn" data-open="${id}"><div class="ti">${esc(d.title)}</div><div class="su">${esc(d.kind)}${th.length ? " · " + esc(th.join(", ")) : ""} · ${u.primary.length + u.cited.length} question${u.primary.length + u.cited.length > 1 ? "s" : ""}</div></button>
      <div class="acts"><button class="sbtn" data-editdoc="${id}">Modifier</button><button class="sbtn del" data-deldoc="${id}">Supprimer</button></div></div>
      ${VIEW.confirm && VIEW.confirm.id === id ? delDocConfirm(id, d, u) : ""}</div>`; }).join("") : `<div class="empty">Aucun document ne correspond.</div>`}</div>`;
}
function delDocConfirm(id, d, u) {
  return `<div class="confirm"><div>Supprimer « ${esc(d.title)} » ? ${u.primary.length ? `Ce document est la source principale de ${plural(u.primary.length, "question")}.` : "Aucune question ne repose principalement sur lui."} ${u.cited.length ? `Il est aussi cité dans ${u.cited.length} autre${u.cited.length > 1 ? "s" : ""} (il en sera simplement retiré).` : ""}</div>
    <div class="actions" style="margin:0">${u.primary.length ? `<button class="btn danger" data-delall="${id}">Supprimer le document et ses ${plural(u.primary.length, "question")}</button>` : ""}<button class="btn ${u.primary.length ? "ghost" : "danger"}" data-delonly="${id}">Supprimer le document seul</button><button class="btn ghost" data-cancel>Annuler</button></div></div>`;
}
function docDetail(id) {
  const d = DATA.lib[id], u = docUse(id), qids = u.primary.concat(u.cited);
  page(`<div class="panel">
    <div class="tools"><button class="sbtn" id="back">← Bibliothèque</button></div>
    <span class="eyebrow">${esc(d.kind)}${d.level ? " · " + esc(d.level) : ""}</span>
    <h1 style="font-size:22px;margin:4px 0 10px">${esc(d.title)}</h1>
    <div class="chips">${(d.themes || []).map(t => DATA.themes[t] ? `<button class="chip theme" data-theme="${t}">${esc(themeName(t))}</button>` : "").join("") || `<span class="muted">Aucun thème</span>`}</div>
    ${d.ref ? `<p class="refline">${esc(d.ref)}</p>` : ""}
    ${d.url ? `<p><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.idLabel || "Ouvrir le lien")}</a></p>` : ""}
    ${d.location ? `<p class="muted">Où le retrouver : ${esc(d.location)}</p>` : ""}
    ${d.file ? `<div class="filebox"><span class="fic" aria-hidden="true">${d.file.type === "application/pdf" ? "PDF" : /^image/.test(d.file.type) ? "IMG" : "TXT"}</span><div><div class="ti">${esc(d.file.name)}</div><div class="su">${(d.file.size / 1048576).toFixed(1)} Mo · chiffré</div></div><button class="sbtn" id="openfile">Ouvrir</button></div>` : ""}
    ${d.note ? `<div class="body docnote">${md(d.note)}</div>` : ""}
    <div class="actions"><button class="btn" id="gen">Créer des QCM avec ce document</button></div>
    <h3 style="font-size:15px;margin:20px 0 8px">Questions liées</h3>
    <p class="muted" style="margin:0 0 8px">${qids.length ? `${plural(qids.length, "question")} (${u.primary.length} en source principale)` : "Aucune question ne cite ce document."}</p>
    <div class="actions">${qids.length ? `<button class="btn ghost" id="runq">Faire ces questions</button>` : ""}<button class="btn ghost" id="edit">Modifier</button><button class="btn ghost" id="del">Supprimer</button></div>
    ${VIEW.confirm && VIEW.confirm.id === id ? delDocConfirm(id, d, u) : ""}
  </div>`);
  $("#back").onclick = () => { VIEW.doc = null; VIEW.confirm = null; renderLib(); };
  const rq = $("#runq"); if (rq) rq.onclick = () => startRun(mixKeepDossiers(qids), d.title);
  $("#edit").onclick = () => { VIEW.edit = { type: "doc", id }; renderLib(); };
  const of = $("#openfile"); if (of) of.onclick = () => openDocFile(d, false);
  $("#gen").onclick = () => { VIEW.gen = null; genForm(id); window.scrollTo({ top: 0 }); };
  $("#del").onclick = () => { VIEW.confirm = { id }; docDetail(id); };
  $$("[data-theme]").forEach(b => b.onclick = () => { VIEW.tab = "themes"; VIEW.theme = b.dataset.theme; setNav(); renderThemes(); });
  bindLib();
}
function qsList() {
  const f = VIEW.filter; const qn = (f.q || "").toLowerCase();
  const ss = seriesSorted();
  const rows = Object.entries(DATA.qs).filter(([id, q]) => (!f.serie || q.serie === f.serie) && (!f.theme || (q.themes || []).includes(f.theme)) && (!qn || (q.stem + " " + (q.theme || "")).toLowerCase().includes(qn)))
    .sort((a, b) => ((DATA.series[b[1].serie] || {}).order || 0) - ((DATA.series[a[1].serie] || {}).order || 0) || (a[1].order || 0) - (b[1].order || 0));
  return `<div class="tools">
      <input type="search" id="fq" placeholder="Rechercher une question" value="${esc(f.q || "")}" aria-label="Rechercher une question">
      ${themeSelect("ftheme", f.theme)}
      <select id="fserie" aria-label="Série"><option value="">Toutes les séries</option>${ss.map(([sid, s]) => `<option value="${sid}" ${f.serie === sid ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
      <button class="btn" id="addq">Ajouter une question</button>
    </div>
    <p class="muted" style="margin:0 0 8px">${plural(rows.length, "question")}${rows.length ? ` · <button class="linkish" id="runlist">les faire</button>` : ""}</p>
    <div class="list">${rows.length ? rows.map(([id, q]) => `<div><div class="item"><div><div class="ti">${esc(q.stem.length > 150 ? q.stem.slice(0, 150) + "…" : q.stem)}</div><div class="su">${esc((DATA.series[q.serie] || {}).name || "Sans série")} · ${esc((q.themes || []).map(themeName).filter(Boolean).join(", ") || "sans thème")} · ${q.opts.length} propositions${q.image ? " · photo" : ""}</div></div>
      <div class="acts"><button class="sbtn" data-editq="${id}">Modifier</button><button class="sbtn del" data-delq="${id}">Supprimer</button></div></div>
      ${VIEW.confirm && VIEW.confirm.id === id ? `<div class="confirm"><div>Supprimer définitivement cette question${q.image ? " et sa photo" : ""} ?</div><div class="actions" style="margin:0"><button class="btn danger" data-delqok="${id}">Supprimer</button><button class="btn ghost" data-cancel>Annuler</button></div></div>` : ""}</div>`).join("") : `<div class="empty">Aucune question ne correspond.</div>`}</div>`;
}
function seriesList() {
  const ss = seriesSorted(); const ds = Object.entries(DATA.dossiers);
  return `<div class="tools"><h3 style="font-size:15px;flex:1">Séries</h3><button class="btn" id="addserie">Ajouter une série</button></div>
    <div class="list">${ss.map(([sid, s]) => { const n = qidsOf(sid).length; return `<div><div class="item"><div><div class="ti">${esc(s.name)}</div><div class="su">${plural(n, "question")} · ordre ${s.order || 0}${s.sub ? " · " + esc(s.sub) : ""}</div></div>
      <div class="acts"><button class="sbtn" data-editserie="${sid}">Modifier</button><button class="sbtn del" data-delserie="${sid}">Supprimer</button></div></div>
      ${VIEW.confirm && VIEW.confirm.id === sid ? `<div class="confirm"><div>Supprimer « ${esc(s.name)} »${n ? ` et ses ${plural(n, "question")}` : ""} ?</div><div class="actions" style="margin:0"><button class="btn danger" data-delserieok="${sid}">Supprimer</button><button class="btn ghost" data-cancel>Annuler</button></div></div>` : ""}</div>`; }).join("") || `<div class="empty">Aucune série.</div>`}</div>
    <div class="tools" style="margin-top:22px"><h3 style="font-size:15px;flex:1">Dossiers progressifs</h3><button class="btn ghost" id="adddossier">Ajouter un dossier</button></div>
    <div class="list">${ds.map(([did, d]) => { const n = Object.values(DATA.qs).filter(q => q.dossier === did).length; return `<div><div class="item"><div><div class="ti">${esc(d.title)}</div><div class="su">${plural(n, "étape")}</div></div>
      <div class="acts"><button class="sbtn" data-editdossier="${did}">Modifier</button><button class="sbtn del" data-deldossier="${did}">Supprimer</button></div></div>
      ${VIEW.confirm && VIEW.confirm.id === did ? `<div class="confirm"><div>Supprimer ce dossier ? Ses ${plural(n, "question")} restent, sans contexte de dossier.</div><div class="actions" style="margin:0"><button class="btn danger" data-deldossierok="${did}">Supprimer</button><button class="btn ghost" data-cancel>Annuler</button></div></div>` : ""}</div>`; }).join("") || `<div class="empty">Aucun dossier.</div>`}</div>`;
}
let searchT = null;
function bindLib() {
  const fq = $("#fq"); if (fq) fq.oninput = () => { clearTimeout(searchT); searchT = setTimeout(() => { VIEW.filter.q = fq.value; renderLib(); const n = $("#fq"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  const fk = $("#fkind"); if (fk) fk.onchange = () => { VIEW.filter.kind = fk.value; renderLib(); };
  const fs = $("#fserie"); if (fs) fs.onchange = () => { VIEW.filter.serie = fs.value; renderLib(); };
  const ft = $("#ftheme"); if (ft) ft.onchange = () => { VIEW.filter.theme = ft.value; renderLib(); };
  const on = (sel, fn) => $$(sel).forEach(b => b.onclick = () => fn(b));
  on("#runlist", () => { const f = VIEW.filter, qn = (f.q || "").toLowerCase(); const ids = Object.entries(DATA.qs).filter(([id, q]) => (!f.serie || q.serie === f.serie) && (!f.theme || (q.themes || []).includes(f.theme)) && (!qn || (q.stem + " " + (q.theme || "")).toLowerCase().includes(qn))).map(([id]) => id); startRun(mixKeepDossiers(ids), "Sélection"); });
  on("[data-open]", b => { VIEW.doc = b.dataset.open; VIEW.confirm = null; renderLib(); window.scrollTo({ top: 0 }); });
  on("#adddoc", () => { VIEW.edit = { type: "doc", id: null }; renderLib(); });
  on("#addq", () => { VIEW.edit = { type: "q", id: null }; renderLib(); });
  on("#addserie", () => { VIEW.edit = { type: "serie", id: null }; renderLib(); });
  on("#adddossier", () => { VIEW.edit = { type: "dossier", id: null }; renderLib(); });
  on("[data-editdoc]", b => { VIEW.edit = { type: "doc", id: b.dataset.editdoc }; renderLib(); });
  on("[data-editq]", b => { VIEW.edit = { type: "q", id: b.dataset.editq }; renderLib(); });
  on("[data-editserie]", b => { VIEW.edit = { type: "serie", id: b.dataset.editserie }; renderLib(); });
  on("[data-editdossier]", b => { VIEW.edit = { type: "dossier", id: b.dataset.editdossier }; renderLib(); });
  on("[data-deldoc]", b => { VIEW.confirm = { id: b.dataset.deldoc }; renderLib(); });
  on("[data-delq]", b => { VIEW.confirm = { id: b.dataset.delq }; renderLib(); });
  on("[data-delserie]", b => { VIEW.confirm = { id: b.dataset.delserie }; renderLib(); });
  on("[data-deldossier]", b => { VIEW.confirm = { id: b.dataset.deldossier }; renderLib(); });
  on("[data-cancel]", () => { VIEW.confirm = null; renderLib(); });
  on("[data-delall]", b => deleteDoc(b.dataset.delall, true));
  on("[data-delonly]", b => deleteDoc(b.dataset.delonly, false));
  on("[data-delqok]", b => deleteQuestion(b.dataset.delqok));
  on("[data-delserieok]", b => deleteSerie(b.dataset.delserieok));
  on("[data-deldossierok]", b => deleteDossier(b.dataset.deldossierok));
}

/* ---------- suppressions ---------- */
function deleteQuestion(id) {
  const q = DATA.qs[id]; delDoc("questions", id); if (q && q.image) removeImage(q.image);
  VIEW.confirm = null; toast("Question supprimée"); renderLib();
}
function deleteDoc(id, withQuestions) {
  const u = docUse(id);
  if (withQuestions) for (const qid of u.primary) { const q = DATA.qs[qid]; delDoc("questions", qid); if (q && q.image) removeImage(q.image); }
  const touch = withQuestions ? u.cited : u.primary.concat(u.cited);
  for (const qid of touch) { const q = DATA.qs[qid]; if (q) putDoc("questions", qid, Object.assign({}, q, { docs: (q.docs || []).filter(d => d !== id) })); }
  const df = DATA.lib[id] && DATA.lib[id].file; if (df && df.id) removeImage(df.id);
  delDoc("library", id);
  toast(withQuestions && u.primary.length ? `Document et ${plural(u.primary.length, "question")} supprimés` : "Document supprimé");
  VIEW.confirm = null; VIEW.doc = null; renderLib();
}
function deleteSerie(sid) {
  for (const id of qidsOf(sid)) { const q = DATA.qs[id]; delDoc("questions", id); if (q && q.image) removeImage(q.image); }
  delDoc("series", sid); toast("Série supprimée"); VIEW.confirm = null; renderLib();
}
function deleteDossier(did) {
  for (const [id, q] of Object.entries(DATA.qs)) if (q.dossier === did) putDoc("questions", id, Object.assign({}, q, { dossier: "", step: 0, of: 0, add: "" }));
  delDoc("dossiers", did); toast("Dossier supprimé"); VIEW.confirm = null; renderLib();
}

/* ---------- formulaires ---------- */
function backToList() { VIEW.edit = null; VIEW.confirm = null; renderLib(); window.scrollTo({ top: 0 }); }
function formShell(title, inner) {
  page(`<div class="panel"><div class="tools"><button class="sbtn" id="back">← Retour</button><h2 style="font-size:18px;flex:1">${esc(title)}</h2></div><div class="form">${inner}</div>
  <div class="actions"><button class="btn" id="save">Enregistrer</button><button class="btn ghost" id="cancel">Annuler</button></div></div>`);
  $("#back").onclick = backToList; $("#cancel").onclick = backToList; window.scrollTo({ top: 0 });
}
function val(id) { const e = document.getElementById(id); return e ? e.value.trim() : ""; }
function themePicker(sel) {
  const s = new Set(sel || []);
  return `<div class="f" style="display:grid;gap:6px"><span style="font-size:13px;font-weight:600;color:var(--ink-2)">Thématiques</span>
    <div class="tchips">${themesSorted().map(([tid, t]) => `<label class="tchip pick"><input type="checkbox" class="tpick" value="${tid}" ${s.has(tid) ? "checked" : ""}> ${esc(t.name)}</label>`).join("") || `<span class="muted">Aucun thème : ajoute-en dans l'onglet Thèmes.</span>`}</div></div>`;
}
const pickedThemes = () => $$(".tpick:checked").map(x => x.value);
function docForm() {
  const id = VIEW.edit.id, d = id ? DATA.lib[id] : { title: "", kind: "Cours", location: "", ref: "", url: "", level: "", note: "", idLabel: "", themes: VIEW.filter.theme ? [VIEW.filter.theme] : [] };
  formShell(id ? "Modifier le document" : "Nouveau document", `
    <label class="f">Titre<input type="text" id="d_title" value="${esc(d.title)}" placeholder="Ex. Les inclusions (cours d'Agnès)"></label>
    <div class="grid2">
      <label class="f">Type<select id="d_kind">${KINDS.map(k => `<option ${d.kind === k ? "selected" : ""}>${k}</option>`).join("")}</select></label>
      <label class="f">Niveau de preuve <small>pour un article : revue Cochrane, méta-analyse, essai randomisé…</small><input type="text" id="d_level" value="${esc(d.level || "")}"></label>
    </div>
    ${themePicker(d.themes)}
    <label class="f">Emplacement <small>où retrouver le fichier (Drive, Apple Notes…)</small><input type="text" id="d_loc" value="${esc(d.location || "")}"></label>
    <label class="f">Référence complète <small>auteurs, titre, revue, année</small><textarea id="d_ref">${esc(d.ref || "")}</textarea></label>
    <div class="grid2">
      <label class="f">Lien<input type="url" id="d_url" value="${esc(d.url || "")}" placeholder="https://"></label>
      <label class="f">Texte du lien <small>ex. PMID 12345678</small><input type="text" id="d_idl" value="${esc(d.idLabel || "")}"></label>
    </div>
    <div class="f" style="display:grid;gap:6px"><span style="font-size:13px;font-weight:600;color:var(--ink-2)">Fichier <small style="font-weight:400;color:var(--ink-3)">PDF, image ou texte, 12 Mo max · chiffré avant l'envoi</small></span><div id="filezone"></div></div>
    <label class="f">Notes <small>résumé, points clés… (servent aussi à créer des QCM)</small><textarea id="d_note" class="tall">${esc(d.note || "")}</textarea></label>`);
  let fileMeta = d.file || null; const addedFiles = [];
  const drawFile = () => {
    $("#filezone").innerHTML = (fileMeta ? `<div class="filebox"><span class="fic">${fileMeta.type === "application/pdf" ? "PDF" : /^image/.test(fileMeta.type) ? "IMG" : "TXT"}</span><div><div class="ti">${esc(fileMeta.name)}</div><div class="su">${(fileMeta.size / 1048576).toFixed(1)} Mo</div></div><button class="sbtn del" id="filedel">Retirer</button></div>` : "") +
      `<label class="sbtn" style="justify-self:start;cursor:pointer">${fileMeta ? "Remplacer le fichier" : "Joindre un fichier"}<input type="file" id="fileinp" accept="application/pdf,image/*,text/plain,text/markdown,.md,.txt,.pdf" hidden></label>`;
    const fd = $("#filedel"); if (fd) fd.onclick = () => { fileMeta = null; drawFile(); };
    $("#fileinp").onchange = async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      if (/\.(docx?|pages|pptx?|key)$/i.test(f.name)) return toast("Exporte-le d'abord en PDF (Fichier › Exporter en PDF).");
      try { toast("Chiffrement du fichier…"); fileMeta = await addFile(f); addedFiles.push(fileMeta.id); if (!val("d_title")) $("#d_title").value = f.name.replace(/\.[^.]+$/, ""); drawFile(); toast("Fichier ajouté"); }
      catch (err) { toast(err.code === "too_large" ? "Fichier trop lourd (12 Mo maximum)." : "Ce fichier n'a pas pu être lu."); }
    };
  };
  drawFile();
  $("#cancel").onclick = $("#back").onclick = () => { addedFiles.forEach(removeImage); backToList(); };
  $("#save").onclick = () => {
    const obj = { title: val("d_title"), kind: val("d_kind"), level: val("d_level"), location: val("d_loc"), ref: val("d_ref"), url: val("d_url"), idLabel: val("d_idl"), note: val("d_note"), themes: pickedThemes(), file: fileMeta };
    if (!obj.title) { toast("Donne un titre au document."); return; }
    const oldF = d.file && d.file.id; if (oldF && (!fileMeta || fileMeta.id !== oldF)) removeImage(oldF);
    addedFiles.filter(x => !fileMeta || x !== fileMeta.id).forEach(removeImage);
    if (fileMeta) scheduleSync(500);
    const nid = id || rid("doc"); putDoc("library", nid, obj); toast("Document enregistré");
    VIEW.edit = null; VIEW.doc = nid; renderLib(); window.scrollTo({ top: 0 });
  };
}
function serieForm() {
  const id = VIEW.edit.id, maxo = Math.max(0, ...Object.values(DATA.series).map(s => s.order || 0));
  const s = id ? DATA.series[id] : { name: "Série " + String(maxo + 1).padStart(2, "0"), sub: "", note: "", order: maxo + 1 };
  formShell(id ? "Modifier la série" : "Nouvelle série", `
    <div class="grid2"><label class="f">Nom<input type="text" id="s_name" value="${esc(s.name)}"></label>
    <label class="f">Ordre <small>la plus grande valeur s'affiche en premier</small><input type="number" id="s_order" value="${s.order || 0}"></label></div>
    <label class="f">Thèmes couverts<input type="text" id="s_sub" value="${esc(s.sub || "")}"></label>
    <label class="f">Note<input type="text" id="s_note" value="${esc(s.note || "")}"></label>`);
  $("#save").onclick = () => {
    const obj = { name: val("s_name"), sub: val("s_sub"), note: val("s_note"), order: Number(val("s_order")) || 0 };
    if (!obj.name) { toast("Donne un nom à la série."); return; }
    putDoc("series", id || rid("serie"), obj); toast("Série enregistrée"); backToList();
  };
}
function dossierForm() {
  const id = VIEW.edit.id, d = id ? DATA.dossiers[id] : { title: "", intro: "" };
  formShell(id ? "Modifier le dossier" : "Nouveau dossier", `
    <label class="f">Titre <small>ex. Dossier C · Emma, 14 ans, classe III</small><input type="text" id="x_title" value="${esc(d.title)}"></label>
    <label class="f">Présentation du patient <small>affichée au-dessus de chaque étape</small><textarea id="x_intro" class="tall">${esc(d.intro)}</textarea></label>`);
  $("#save").onclick = () => {
    const obj = { title: val("x_title"), intro: val("x_intro") };
    if (!obj.title) { toast("Donne un titre au dossier."); return; }
    putDoc("dossiers", id || rid("dossier"), obj); toast("Dossier enregistré"); backToList();
  };
}
function qForm() {
  const id = VIEW.edit.id;
  const ss = seriesSorted();
  const q = id ? JSON.parse(JSON.stringify(DATA.qs[id])) : { serie: VIEW.filter.serie || (ss[0] && ss[0][0]) || "", order: 0, theme: "", themes: VIEW.filter.theme ? [VIEW.filter.theme] : [], level: "", dossier: "", step: 0, of: 0, add: "", stem: "", opts: [], ess: "", cours: "", lit: "", piege: "", schema: "", caption: "", image: "", docs: [] };
  if (!id) { q.order = qidsOf(q.serie).length + 1; }
  while (q.opts.length < 5) q.opts.push({ t: "", ok: false, why: "" });
  let image = q.image || "";
  const libSorted = Object.entries(DATA.lib).sort((a, b) => KINDS.indexOf(a[1].kind) - KINDS.indexOf(b[1].kind) || a[1].title.localeCompare(b[1].title, "fr"));
  const primary = (q.docs || [])[0] || "", others = new Set((q.docs || []).slice(1));
  formShell(id ? "Modifier la question" : "Nouvelle question", `
    <div class="grid2">
      <label class="f">Série<select id="q_serie"><option value="">Aucune (seulement par thème)</option>${ss.map(([sid, s]) => `<option value="${sid}" ${q.serie === sid ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
      <label class="f">Ordre dans la série<input type="number" id="q_order" value="${q.order || 0}"></label>
      <label class="f">Intitulé court <small>affiché en haut de la question</small><input type="text" id="q_theme" value="${esc(q.theme || "")}" placeholder="Ex. Classe II · élastiques"></label>
      <label class="f">Type<input type="text" id="q_level" value="${esc(q.level || "")}" placeholder="Biomécanique, Raisonnement clinique…"></label>
    </div>
    ${themePicker(q.themes)}
    <div class="grid2">
      <label class="f">Dossier progressif<select id="q_dossier"><option value="">Aucun</option>${Object.entries(DATA.dossiers).map(([did, d]) => `<option value="${did}" ${q.dossier === did ? "selected" : ""}>${esc(d.title)}</option>`).join("")}</select></label>
      <label class="f">Étape<input type="number" id="q_step" value="${q.step || 0}" min="0"></label>
      <label class="f">Sur<input type="number" id="q_of" value="${q.of || 0}" min="0"></label>
    </div>
    <label class="f">Suite du dossier <small>ce qui a changé pour le patient à cette étape</small><textarea id="q_add">${esc(q.add || "")}</textarea></label>
    <label class="f">Énoncé<textarea id="q_stem">${esc(q.stem)}</textarea></label>
    ${q.opts.map((o, i) => `<div class="optedit"><div class="hd"><span>Proposition ${LETTERS[i]}</span><label><input type="checkbox" id="q_ok${i}" ${o.ok ? "checked" : ""}> Juste</label></div>
      <textarea id="q_t${i}" placeholder="Texte de la proposition (laisse vide pour ne pas l'utiliser)">${esc(o.t)}</textarea>
      <textarea id="q_w${i}" placeholder="Pourquoi c'est juste ou faux">${esc(o.why || "")}</textarea></div>`).join("")}
    <p class="muted" style="margin:0">Mise en forme des textes longs : une ligne vide pour un nouveau paragraphe, « - » en début de ligne pour une liste, **mot** pour le gras.</p>
    <label class="f">L'essentiel<textarea id="q_ess" class="tall">${esc(q.ess || "")}</textarea></label>
    <label class="f">Ce que dit ton cours<textarea id="q_cours" class="tall">${esc(q.cours || "")}</textarea></label>
    <label class="f">Ce que disent les synthèses<textarea id="q_lit" class="tall">${esc(q.lit || "")}</textarea></label>
    <label class="f">Le piège<textarea id="q_piege">${esc(q.piege || "")}</textarea></label>
    <div class="grid2">
      <label class="f">Schéma<select id="q_schema"><option value="">Aucun</option>${Object.keys(typeof SCHEMAS !== "undefined" ? SCHEMAS : {}).map(k => `<option value="${k}" ${q.schema === k ? "selected" : ""}>${esc(SCHEMA_LABELS[k] || k)}</option>`).join("")}</select></label>
      <label class="f">Légende du schéma<input type="text" id="q_caption" value="${esc(q.caption || "")}"></label>
    </div>
    <div class="f" style="display:grid;gap:6px"><span style="font-size:13px;font-weight:600;color:var(--ink-2)">Photo ou radio <small style="font-weight:400;color:var(--ink-3)">anonymisée, affichée sous l'énoncé</small></span>
      <div id="imgzone"></div></div>
    <label class="f">Document principal<select id="q_primary"><option value="">Aucun</option>${libSorted.map(([did, d]) => `<option value="${did}" ${primary === did ? "selected" : ""}>${esc(d.kind)} · ${esc(d.title)}</option>`).join("")}</select></label>
    <div class="f" style="display:grid;gap:6px"><span style="font-size:13px;font-weight:600;color:var(--ink-2)">Autres sources</span>
      <input type="search" id="q_dfilter" placeholder="Filtrer les documents" aria-label="Filtrer les documents">
      <div class="checks" id="q_docs">${libSorted.map(([did, d]) => `<label data-t="${esc((d.title + " " + d.kind).toLowerCase())}"><input type="checkbox" value="${did}" ${others.has(did) ? "checked" : ""}><span>${esc(d.title)} <span class="k">${esc(d.kind)}</span></span></label>`).join("")}</div></div>`);
  const added = [];
  function drawImg() {
    const z = $("#imgzone");
    z.innerHTML = (image ? `<img class="imgprev" data-img="${esc(image)}" alt="Aperçu"><div><button class="sbtn del" id="imgdel">Retirer la photo</button></div>` : "") +
      `<label class="sbtn" style="justify-self:start;cursor:pointer">${image ? "Remplacer" : "Ajouter"} une photo<input type="file" id="imgfile" accept="image/*" hidden></label>`;
    hydrateImages(z);
    const del = $("#imgdel"); if (del) del.onclick = () => { image = ""; drawImg(); };
    const fi = $("#imgfile"); if (fi) fi.onchange = async () => {
      const f = fi.files && fi.files[0]; if (!f) return;
      try { toast("Préparation de la photo…"); image = await addImage(f); added.push(image); drawImg(); toast("Photo ajoutée (chiffrée)"); }
      catch (e) { toast("Cette image n'a pas pu être lue. Essaie une photo JPEG ou PNG."); }
    };
  }
  drawImg();
  $("#q_dfilter").oninput = e => { const v = e.target.value.toLowerCase(); $$("#q_docs label").forEach(l => l.hidden = v && !l.dataset.t.includes(v)); };
  $("#cancel").onclick = $("#back").onclick = () => { added.forEach(removeImage); backToList(); };
  $("#save").onclick = () => {
    const opts = []; for (let i = 0; i < 5; i++) { const t = val("q_t" + i); if (t) opts.push({ t, ok: document.getElementById("q_ok" + i).checked, why: val("q_w" + i) }); }
    const stem = val("q_stem");
    if (!stem) { toast("Écris l'énoncé."); return; }
    if (opts.length < 2) { toast("Il faut au moins deux propositions."); return; }
    if (!opts.some(o => o.ok)) { toast("Coche au moins une proposition juste."); return; }
    const th = pickedThemes();
    if (!th.length && !val("q_serie")) { toast("Choisis une série ou au moins un thème, sinon la question serait introuvable."); return; }
    const prim = val("q_primary");
    const oth = $$("#q_docs input:checked").map(x => x.value).filter(x => x !== prim);
    const obj = { serie: val("q_serie"), order: Number(val("q_order")) || 0, theme: val("q_theme"), themes: th, level: val("q_level"),
      dossier: val("q_dossier"), step: Number(val("q_step")) || 0, of: Number(val("q_of")) || 0, add: val("q_add"),
      stem, opts, ess: val("q_ess"), cours: val("q_cours"), lit: val("q_lit"), piege: val("q_piege"),
      schema: val("q_schema"), caption: val("q_caption"), image, docs: (prim ? [prim] : []).concat(oth) };
    const oldImg = id && DATA.qs[id] ? DATA.qs[id].image : "";
    added.filter(x => x !== image).forEach(removeImage);
    if (oldImg && oldImg !== image) removeImage(oldImg);
    if (image && META.imgUp.includes(image)) scheduleSync(500);
    putDoc("questions", id || rid("q"), obj); toast("Question enregistrée");
    VIEW.filter.serie = obj.serie; backToList();
  };
}

/* ============================================================
   RÉGLAGES
   ============================================================ */
function isStandalone() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }
function renderSettings(err) {
  renderTrack(); $("#qset").textContent = "Réglages";
  const s = statusInfo();
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent), mac = /Macintosh/.test(navigator.userAgent) && !("ontouchend" in document);
  const pending = [META.contentDirty ? "modifications" : "", META.progDirty ? "progression" : "", META.imgUp.length ? plural(META.imgUp.length, "photo") : ""].filter(Boolean);
  page(`
  <section class="panel" style="margin-bottom:14px">
    <h2 style="font-size:17px">Synchronisation</h2>
    <p class="status ${s.cls}" style="margin:8px 0"><span class="dot"></span><span>${esc(s.txt)}</span></p>
    <p class="muted">Dernière synchro réussie : ${ago(META.lastSync)}${pending.length ? ` · en attente : ${pending.join(", ")}` : ""}. Tout reste utilisable hors ligne ; l'envoi se fait dès que le réseau revient.</p>
    <div class="actions"><button class="btn" id="syncnow" ${SYNC.busy ? "disabled" : ""}>Synchroniser maintenant</button></div>
  </section>
  ${aiSettingsHTML()}
  <section class="panel" style="margin-bottom:14px">
    <h2 style="font-size:17px">Installer l'app</h2>
    ${isStandalone() ? `<p>Tu utilises l'app installée. 👍</p>` : `
    <p>${ios ? "Sur cet iPhone" : mac ? "Sur ce Mac" : "Sur cet appareil"}, installe-la pour l'ouvrir comme une vraie app, en plein écran, depuis son icône :</p>
    <ul class="steps">${ios ? `<li>Dans Safari, touche le bouton <b>Partager</b> (carré avec flèche).</li><li>Choisis <b>Sur l'écran d'accueil</b>, puis <b>Ajouter</b>.</li><li>Ouvre ensuite l'app depuis l'icône « Quiz ODF » : il faudra y coller le jeton et taper le mot de passe une fois (l'app installée a son propre stockage).</li>`
      : `<li>Dans Safari : menu <b>Fichier → Ajouter au Dock…</b> (ou bouton Partager → Ajouter au Dock).</li><li>Ouvre ensuite « Quiz ODF » depuis le Dock ou le Launchpad : il faudra y coller le jeton et taper le mot de passe une fois.</li><li>Avec Chrome : icône d'installation dans la barre d'adresse.</li>`}</ul>`}
  </section>
  <section class="panel" style="margin-bottom:14px">
    <h2 style="font-size:17px">Mot de passe</h2>
    <p class="muted">Change le mot de passe du coffre. Tes autres appareils déjà déverrouillés continuent de fonctionner ; un nouvel appareil demandera le nouveau.</p>
    <div class="grid2"><label class="f">Mot de passe actuel<input type="password" id="opw" autocomplete="current-password"></label><label class="f">Nouveau (10 caractères min.)<input type="password" id="npw" autocomplete="new-password"></label></div>
    ${err ? `<p class="errmsg">${esc(err)}</p>` : ""}
    <div class="actions"><button class="btn ghost" id="chpw">Changer le mot de passe</button></div>
  </section>
  <section class="panel" style="margin-bottom:14px">
    <h2 style="font-size:17px">Jeton GitHub</h2>
    <p class="muted">À remplacer s'il expire. Dépôt : <span class="mono">${GH.owner}/${GH.repo}</span>.</p>
    <div class="tools"><input type="password" id="ntok" placeholder="Nouveau jeton github_pat_…" autocomplete="off" aria-label="Nouveau jeton"><button class="btn ghost" id="settok">Remplacer</button></div>
  </section>
  <section class="panel" style="margin-bottom:14px">
    <h2 style="font-size:17px">Sauvegarde</h2>
    <p class="muted">Un fichier avec tout ton contenu et ta progression, <b>non chiffré</b> : garde-le dans un endroit sûr.</p>
    <div class="actions"><button class="btn ghost" id="bk">Exporter une sauvegarde</button><label class="btn ghost" style="cursor:pointer">Importer une sauvegarde<input type="file" id="bkin" accept=".json,application/json" hidden></label></div>
  </section>
  <section class="panel">
    <h2 style="font-size:17px">Cet appareil</h2>
    <p class="muted">Oublier efface le jeton, la clé et les données de cet appareil seulement (rien n'est supprimé sur GitHub ni sur tes autres appareils).</p>
    <div class="actions"><button class="btn ghost" id="forget">Oublier cet appareil</button></div>
    ${VIEW.confirm && VIEW.confirm.id === "forget" ? `<div class="confirm"><div>${pending.length ? "Attention : des changements ne sont pas encore envoyés et seront perdus. " : ""}Oublier cet appareil ?</div><div class="actions" style="margin:0"><button class="btn danger" id="forgetok">Oublier</button><button class="btn ghost" id="forgetno">Annuler</button></div></div>` : ""}
    <p class="small" style="margin-top:14px">Version ${APP_VERSION}</p>
  </section>`);
  $("#syncnow").onclick = () => sync();
  bindAISettings();
  $("#chpw").onclick = async () => {
    const o = $("#opw").value, n = $("#npw").value;
    if (n.length < 10) return renderSettings("Le nouveau mot de passe doit faire au moins 10 caractères.");
    try {
      const cur = await ghGet("vault/keys.json"); const file = cur ? JSON.parse(cur.text) : KEYS_FILE;
      let nf; try { nf = await rewrapKeys(file, o, n); } catch (e) { return renderSettings("Mot de passe actuel incorrect."); }
      await ghPut("vault/keys.json", JSON.stringify(nf, null, 1), cur && cur.sha, "changement du mot de passe");
      KEYS_FILE = nf; await saveKeysFile(nf); toast("Mot de passe changé"); renderSettings();
    } catch (e) { renderSettings(e.code === "offline" ? "Il faut être en ligne pour changer le mot de passe." : "Échec (" + (e.code || e.message) + ")."); }
  };
  $("#settok").onclick = async () => {
    const v = $("#ntok").value.replace(/[\s\u200B-\u200D\uFEFF]/g, ""); if (!v) return; const old = TOKEN; TOKEN = v;
    try { await ghCheckAccess(); await saveToken(TOKEN); SYNC.error = ""; toast("Jeton remplacé"); sync(); renderSettings(); }
    catch (e) { TOKEN = old; toast(e.code === "token" ? "Jeton refusé." : e.code === "readonly" ? "Ce jeton ne peut que lire." : "Vérification impossible (" + e.code + ")."); }
  };
  $("#bk").onclick = () => {
    const blob = new Blob([JSON.stringify({ app: "quiz-odf", exported: new Date().toISOString(), content: Object.assign({}, CONTENT, { docs: Object.fromEntries(Object.entries(CONTENT.docs).filter(([k]) => !k.startsWith("settings/"))) }), h: PROG })], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "quiz-odf-sauvegarde-" + new Date().toISOString().slice(0, 10) + ".json"; document.body.appendChild(a); a.click(); a.remove();
  };
  $("#bkin").onchange = e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => { try {
      const j = JSON.parse(fr.result);
      if (j.content && j.content.docs) { CONTENT = mergeContent(CONTENT, j.content); META.contentDirty = true; rebuild(); }
      if (j.h) { PROG = mergeHist(PROG, j.h); META.progDirty = true; }
      if (!j.content && !j.h) throw 0;
      persistLocal(); scheduleSync(300); toast("Sauvegarde importée et fusionnée");
    } catch (err) { toast("Ce fichier n'est pas une sauvegarde du quiz."); } };
    fr.readAsText(f);
  };
  $("#forget").onclick = () => { VIEW.confirm = { id: "forget" }; renderSettings(); };
  const fo = $("#forgetok"); if (fo) fo.onclick = async () => { LS.clear(); try { await idb.clear("kv"); await idb.clear("img"); } catch (e) {} location.reload(); };
  const fn = $("#forgetno"); if (fn) fn.onclick = () => { VIEW.confirm = null; renderSettings(); };
}

/* ============================================================
   DÉMARRAGE
   ============================================================ */
function go(tab) {
  VIEW.tab = tab; VIEW.edit = null; VIEW.confirm = null; VIEW.doc = null; VIEW.theme = null; VIEW.manage = false; VIEW.renaming = null; VIEW.request = null; VIEW.gen = null;
  if (tab === "rev") VIEW.mode = "home";
  render(); window.scrollTo({ top: 0 });
}
async function boot() {
  $$("#tabbar button").forEach(b => b.onclick = () => go(b.dataset.tab));
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
    let reloaded = false; const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded || !hadController) return; /* première installation : rien à recharger */
      if (STAGE !== "ready") return;
      if (VIEW.mode === "q" || VIEW.edit) { toast("Nouvelle version de l'app prête : elle s'appliquera à la prochaine ouverture."); return; }
      reloaded = true; location.reload();
    });
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const get = async k => { try { return await idb.get("kv", k); } catch (e) { return undefined; } };
  TOKEN = (await get("token")) || LS.get("token") || "";
  KEYS_FILE = (await get("keysFile")) || LS.get("keysFile") || null;
  KEY = await loadKey();
  if (TOKEN && !LS.get("token")) LS.set("token", TOKEN);           /* anciens appareils : on complète le secours */
  if (KEYS_FILE && !LS.get("keysFile")) LS.set("keysFile", KEYS_FILE);
  CONTENT = (await get("content")) || LS.get("content") || emptyContent();
  PROG = (await get("prog")) || LS.get("prog") || {};
  META = Object.assign(META, (await get("meta")) || LS.get("meta") || {});
  rebuild();
  if (!TOKEN) { STAGE = "token"; return render(); }
  if (!KEY) {
    if (KEYS_FILE) { STAGE = "unlock"; return render(); }
    try { await afterToken(); } catch (e) { STAGE = "token"; render(); toast("Connexion à GitHub impossible pour l'instant."); }
    return;
  }
  STAGE = "ready"; render(); startLoops();
}
let loopsOn = false;
function startLoops() {
  sync();
  if (loopsOn) return; loopsOn = true;
  setInterval(() => { if (document.visibilityState === "visible") sync(); }, 4 * 60 * 1000);
  setInterval(setStatus, 30 * 1000);
  window.addEventListener("online", () => sync());
  window.addEventListener("offline", () => { SYNC.error = "offline"; setStatus(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && (META.progDirty || META.contentDirty)) sync();
    if (document.visibilityState === "visible" && Date.now() - META.lastSync > 60 * 1000) sync();
  });
}
document.addEventListener("keydown", e => {
  if (VIEW.tab !== "rev" || VIEW.mode !== "q" || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target && e.target.tagName) || ""; if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
  const map = { a: 0, b: 1, c: 2, d: 3, e: 4, "1": 0, "2": 1, "3": 2, "4": 3, "5": 4 }; const k = e.key.toLowerCase();
  const q = DATA.qs[S.list[S.i]];
  if (k in map && !S.done && q && map[k] < q.opts.length) { toggle(map[k]); e.preventDefault(); }
  else if (e.key === "Enter") { if (!S.done && S.sel.length) { validate(); e.preventDefault(); } else if (S.done) { const n = $("#next"); if (n && document.activeElement !== n) { n.click(); e.preventDefault(); } } }
});
boot();
