/* ============================================================
   QUIZ ODF — IA : bulle de chat dans les corrections,
   QCM à partir d'un document, réglage de la clé API
   ------------------------------------------------------------
   Avec une clé API Anthropic (Réglages) : réponses dans l'app.
   Sans clé : on ouvre Claude avec la demande déjà rédigée.
   ============================================================ */
const AI_MODELS = {
  "claude-sonnet-5": "Claude Sonnet 5 · recommandé",
  "claude-opus-5-5": "Claude Opus 5.5 · le plus fin, plus cher",
  "claude-haiku-4-5-20251001": "Claude Haiku 4.5 · rapide et économique",
};
function aiConf() { return (DATA.settings && DATA.settings.ai) || {}; }
function hasAI() { return !!aiConf().key; }
function claudeLink(prompt, web) { return (web ? "https://claude.ai/new?q=" : "claude://claude.ai/new?q=") + encodeURIComponent(prompt.slice(0, 13000)); }

async function callClaude(opt) {
  const conf = aiConf();
  if (!conf.key) throw Object.assign(new Error("Pas de clé API"), { code: "nokey" });
  const messages = opt.messages.slice();
  let web = opt.web || 0, out = [], cites = [];
  for (let round = 0; round < 4; round++) {
    const body = { model: conf.model || "claude-sonnet-5", max_tokens: opt.maxTokens || 1500, system: opt.system, messages };
    if (web) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: web }];
    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": conf.key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify(body), signal: opt.signal,
      });
    } catch (e) { throw Object.assign(new Error("Pas de connexion"), { code: "offline" }); }
    if (!r.ok) {
      let j = {}; try { j = await r.json(); } catch (e) {}
      const msg = (j.error && j.error.message) || ("HTTP " + r.status);
      if (web && r.status === 400 && /tool|web_search|search/i.test(msg)) { web = 0; round--; continue; } /* recherche web non activée sur le compte */
      throw Object.assign(new Error(msg), { code: r.status === 401 ? "badkey" : r.status === 429 ? "rate" : r.status === 529 ? "busy" : "http", status: r.status });
    }
    const j = await r.json();
    for (const b of j.content || []) {
      if (b.type === "text") { out.push(b.text); (b.citations || []).forEach(c => { if (c.url && !cites.some(x => x.url === c.url)) cites.push({ url: c.url, title: c.title || c.url }); }); }
    }
    if (j.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: j.content }); continue; }
    return { text: out.join(""), cites, stop: j.stop_reason };
  }
  return { text: out.join(""), cites, stop: "rounds" };
}
function aiErrMsg(e) {
  return ({ nokey: "Ajoute d'abord une clé API dans Réglages.", badkey: "Clé API refusée : vérifie-la dans Réglages.", rate: "Trop de demandes d'un coup : réessaie dans une minute.", busy: "Claude est surchargé : réessaie dans un instant.", offline: "Pas de connexion." })[e.code] || ("Erreur : " + e.message);
}

/* ---------- contexte d'une question ---------- */
function qContext(q, sel) {
  const docs = (q.docs || []).map(id => DATA.lib[id]).filter(Boolean).map(d => "- " + (d.ref || d.title));
  return [
    "Question de mon quiz d'orthodontie (DES ODF) :",
    q.dossier && DATA.dossiers[q.dossier] ? "Dossier : " + DATA.dossiers[q.dossier].title + " — " + DATA.dossiers[q.dossier].intro + (q.add ? "\nÉtape : " + q.add : "") : "",
    "Énoncé : " + q.stem,
    "Propositions :",
    ...q.opts.map((o, i) => `${LETTERS[i]}. ${o.t} → ${o.ok ? "JUSTE" : "FAUX"}${o.why ? " (" + o.why + ")" : ""}`),
    sel && sel.length ? "J'avais coché : " + sel.map(i => LETTERS[i]).sort().join(", ") : "",
    q.ess ? "Correction, l'essentiel : " + q.ess : "",
    q.cours ? "Ce que dit mon cours : " + q.cours : "",
    q.lit ? "Synthèses : " + q.lit : "",
    q.piege ? "Piège : " + q.piege : "",
    docs.length ? "Sources :\n" + docs.join("\n") : "",
  ].filter(Boolean).join("\n");
}
const TUTOR = "Tu es un enseignant d'orthodontie dento-faciale qui accompagne un interne de DES d'ODF (2e année, France). Réponds en français, clairement et brièvement (moins de 250 mots sauf demande contraire), en privilégiant le raisonnement clinique et la biomécanique (forces, moments, centre de résistance, ancrage). Appuie-toi d'abord sur la correction fournie, puis sur les données de plus haut niveau de preuve (revues Cochrane, méta-analyses, revues systématiques, consensus). N'invente jamais de référence, d'étude ni de chiffre : si tu n'es pas sûr, dis-le. Si tu cites une étude, donne premier auteur, année et revue. Si la correction te paraît discutable, dis-le franchement et explique pourquoi. Mise en forme simple : paragraphes courts, listes avec « - », **gras** pour l'essentiel.";

/* ---------- bulle de chat sous la correction ---------- */
const CHATS = {};
function mountChat(qid, q, sel) {
  const host = $("#chat"); if (!host) return;
  const hist = CHATS[qid] = CHATS[qid] || [];
  host.innerHTML = `<button class="chatfab" id="chatopen" aria-expanded="${hist.length ? "true" : "false"}"><span class="bubble" aria-hidden="true">?</span>Une question sur cette correction ?</button>
    <div class="chatbox" id="chatbox" ${hist.length ? "" : "hidden"}>
      <div class="chatlog" id="chatlog" aria-live="polite"></div>
      <textarea id="chatin" rows="2" placeholder="Ex. Pourquoi la proposition C est fausse ? Et si le patient était hyperdivergent ?"></textarea>
      <div class="actions" style="margin-top:8px">
        ${hasAI() ? `<button class="btn" id="chatsend">Envoyer</button>` : ""}
        <a class="btn ${hasAI() ? "ghost" : ""}" id="chatext" href="#">Demander dans l'app Claude</a>
        ${hasAI() ? "" : `<span class="small">Pour une réponse ici même, ajoute une clé API dans Réglages.</span>`}
      </div>
    </div>`;
  const log = $("#chatlog");
  const draw = () => {
    log.innerHTML = hist.map(m => m.role === "user" ? `<div class="msg me">${esc(m.shown || m.content)}</div>` :
      `<div class="msg ai">${md(m.content)}${m.cites && m.cites.length ? `<div class="cites">${m.cites.slice(0, 6).map(c => `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a>`).join("")}</div>` : ""}</div>`).join("");
    log.hidden = !hist.length;
  };
  draw();
  $("#chatopen").onclick = () => { const b = $("#chatbox"); b.hidden = !b.hidden; $("#chatopen").setAttribute("aria-expanded", !b.hidden); if (!b.hidden) $("#chatin").focus(); };
  $("#chatext").onclick = e => {
    const txt = $("#chatin").value.trim();
    const p = qContext(q, sel) + "\n\nMa question : " + (txt || "(je la pose ensuite)") + "\n\nRéponds comme un enseignant d'ODF, en t'appuyant sur les données de plus haut niveau de preuve, sans rien inventer.";
    e.currentTarget.href = claudeLink(p);
  };
  const send = async () => {
    const txt = $("#chatin").value.trim(); if (!txt) return;
    const first = !hist.length;
    hist.push({ role: "user", content: first ? qContext(q, sel) + "\n\nMa question : " + txt : txt, shown: txt });
    $("#chatin").value = ""; draw();
    const wait = document.createElement("div"); wait.className = "msg ai wait"; wait.textContent = "Claude réfléchit…"; log.appendChild(wait);
    const btn = $("#chatsend"); btn.disabled = true;
    try {
      const r = await callClaude({ system: TUTOR, messages: hist.map(m => ({ role: m.role, content: m.content })), maxTokens: 1500, web: 3 });
      hist.push({ role: "assistant", content: r.text || "(pas de réponse)", cites: r.cites });
    } catch (e) { hist.pop(); toast(aiErrMsg(e)); $("#chatin").value = txt; }
    btn.disabled = false; draw(); log.lastElementChild && log.lastElementChild.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const sb = $("#chatsend"); if (sb) sb.onclick = send;
  $("#chatin").onkeydown = e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && hasAI()) { e.preventDefault(); send(); } };
}

/* ---------- QCM à partir d'un document ---------- */
const GEN_RULES = `Tu crées des QCM d'orthodontie (ODF) pour un interne de DES 2e année en France.
Règles :
- QCM type Wooclap : 5 propositions, de 1 à 5 justes. Énoncé court, clinique.
- Raisonnement clinique et biomécanique d'abord (forces, moments, centre de résistance, ancrage, choix de mécanique), connaissances ensuite.
- Pas de « selon [auteur] » dans les énoncés ni de pourcentages propres à une étude : conclusions générales des synthèses.
- Orthodontie moderne : technique du glissement (TGO), ancrages osseux, aligneurs, lingual. Systèmes anciens au minimum.
- Base-toi d'abord sur le document fourni ; complète avec les synthèses de plus haut niveau de preuve (Cochrane, méta-analyses, revues systématiques, consensus). N'invente RIEN : aucune référence, étude ou chiffre non vérifié. Si tu utilises la recherche web, ne cite que des références dont tu as ouvert la page.
- Chaque proposition a un « why » (1-2 phrases). « ess » = l'essentiel à retenir (3-6 lignes). « cours » = ce que dit le document. « lit » = ce que disent les synthèses (peut être vide). « piege » = le piège.
- Mise en forme : ligne vide = paragraphe, « - » = liste, **gras**.
Réponds UNIQUEMENT par un JSON entre <json> et </json> :
{"questions":[{"stem":"…","theme":"intitulé court","level":"Biomécanique|Raisonnement clinique|Connaissances","themes":["t-…"],"opts":[{"t":"…","ok":true,"why":"…"}],"ess":"…","cours":"…","lit":"…","piege":"…","refs":["R1"]}],
 "newRefs":[{"key":"R1","title":"Auteur Année · titre","ref":"référence complète","url":"lien vérifié","idLabel":"PMID/DOI","level":"Revue Cochrane|Méta-analyse|…"}]}`;
function parseGen(text) {
  const m = text.match(/<json>([\s\S]*?)<\/json>/) || text.match(/(\{[\s\S]*"questions"[\s\S]*\})/);
  if (!m) throw new Error("réponse illisible");
  const j = JSON.parse(m[1].trim());
  const qs = (j.questions || []).filter(q => q && q.stem && Array.isArray(q.opts) && q.opts.length >= 2 && q.opts.some(o => o.ok)).map(q => Object.assign(q, { opts: q.opts.slice(0, 5).map(o => ({ t: String(o.t || ""), ok: !!o.ok, why: String(o.why || "") })) }));
  if (!qs.length) throw new Error("aucune question valable");
  return { questions: qs, newRefs: (j.newRefs || []).filter(r => r && r.key && r.title && r.url) };
}
async function docBlocks(d) {
  const blocks = [];
  if (d.file && d.file.id) {
    const bytes = await fileBytes(d.file.id);
    if (bytes) {
      const t = d.file.type || "";
      if (t === "application/pdf") blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64(bytes) }, title: d.title });
      else if (/^image\/(png|jpeg|gif|webp)$/.test(t)) blocks.push({ type: "image", source: { type: "base64", media_type: t, data: b64(bytes) } });
      else if (/^text\//.test(t)) blocks.push({ type: "text", text: "Contenu du document « " + d.title + " » :\n" + TD.decode(bytes).slice(0, 180000) });
    }
  }
  return blocks;
}
function genPromptForClaude(d, g) {
  const ns = nextSerie();
  return ["/quiz-odf-serie", "",
    `Crée ${g.count} QCM à partir de mon document « ${d.title} » (id ${VIEW.doc}) et dépose-les dans mon coffre (utilise la compétence quiz-odf-serie).`,
    g.serie === "new" ? `- Nouvelle série : ${ns.name} (id ${ns.id}, order ${ns.n}), sous-titre « ${d.title} »` : g.serie === "none" ? "- Sans série (accessibles par thème)" : `- Série existante : ${(DATA.series[g.serie] || {}).name} (id ${g.serie})`,
    `- Thèmes : ${g.themes.map(t => themeName(t) + " [" + t + "]").join(", ") || "à choisir"}`,
    `- Accent : ${REQ_FOCUS[g.focus]}`,
    d.location ? `- Où trouver le document : ${d.location}` : "",
    d.ref ? `- Référence : ${d.ref}` : "",
    d.file ? `- Je joins le fichier « ${d.file.name} » à ce message.` : "",
    "- Complète avec les revues de plus haut niveau de preuve sur le sujet.",
    "", "Identifiants des thèmes : " + themesSorted().map(([t, x]) => t + " = " + x.name).join(" ; "),
  ].filter(Boolean).join("\n");
}
function genForm(docId) {
  const d = DATA.lib[docId];
  const g = VIEW.gen = VIEW.gen && VIEW.gen.doc === docId ? VIEW.gen : { doc: docId, count: "10", themes: (d.themes || []).slice(), serie: "new", focus: "equilibre", result: null, busy: false };
  const ss = seriesSorted();
  if (g.result) return genPreview(d, g);
  page(`<div class="panel">
    <div class="tools"><button class="sbtn" id="back">← Document</button><h2 style="font-size:18px;flex:1">Créer des QCM</h2></div>
    <p class="muted" style="margin-top:0">À partir de « ${esc(d.title)} »${d.file ? ` (fichier ${esc(d.file.name)})` : d.note ? " (tes notes sur ce document)" : ""}, complété par les synthèses de plus haut niveau de preuve.</p>
    <div class="form">
      <div class="grid2">
        <label class="f">Nombre de questions<select id="g_count">${["5", "10", "15", "20"].map(v => `<option ${g.count === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="f">Où les ranger<select id="g_serie"><option value="new" ${g.serie === "new" ? "selected" : ""}>Nouvelle série (${esc(nextSerie().name)})</option>${ss.map(([sid, s]) => `<option value="${sid}" ${g.serie === sid ? "selected" : ""}>${esc(s.name)}</option>`).join("")}<option value="none" ${g.serie === "none" ? "selected" : ""}>Sans série (par thème)</option></select></label>
        <label class="f">Accent<select id="g_focus">${Object.entries(REQ_FOCUS).map(([k, v]) => `<option value="${k}" ${g.focus === k ? "selected" : ""}>${esc(v.split(" :")[0])}</option>`).join("")}</select></label>
      </div>
      ${themePicker(g.themes)}
    </div>
    <div class="actions">
      ${hasAI() ? `<button class="btn" id="g_go" ${g.busy ? "disabled" : ""}>${g.busy ? "Création en cours… (1 à 3 min)" : "Créer les questions ici"}</button>` : ""}
      <a class="btn ${hasAI() ? "ghost" : ""}" id="g_ext" href="#">Demander dans l'app Claude</a>
      ${d.file ? `<button class="btn ghost" id="g_file">Télécharger le fichier à joindre</button>` : ""}
    </div>
    <p class="muted">${hasAI() ? "Tu verras les questions avant de les ajouter." : "Sans clé API, la demande s'ouvre dans Claude" + (d.file ? " : joins-y le fichier (bouton ci-dessus)." : ".") + " Avec une clé API (Réglages), les questions sont créées ici même."}</p>
  </div>`);
  const keep = () => { g.count = val("g_count"); g.serie = val("g_serie"); g.focus = val("g_focus"); g.themes = pickedThemes(); };
  $("#back").onclick = () => { keep(); VIEW.gen = null; renderLib(); };
  $("#g_ext").onclick = e => { keep(); e.currentTarget.href = claudeLink(genPromptForClaude(d, g)); };
  const gf = $("#g_file"); if (gf) gf.onclick = () => openDocFile(d, true);
  const go = $("#g_go"); if (go) go.onclick = async () => {
    keep(); g.busy = true; genForm(docId);
    try {
      const blocks = await docBlocks(d);
      const info = [`Document : « ${d.title} » (${d.kind})`, d.ref ? "Référence : " + d.ref : "", d.note ? "Notes / contenu :\n" + d.note : "",
        `Crée ${g.count} questions. Accent : ${REQ_FOCUS[g.focus]}.`,
        `Thèmes à utiliser (ids) : ${g.themes.map(t => t + " = " + themeName(t)).join(" ; ") || "choisis parmi : " + themesSorted().map(([t, x]) => t + " = " + x.name).join(" ; ")}`,
        "Questions déjà présentes sur ces thèmes (ne pas refaire) : " + Object.values(DATA.qs).filter(q => (q.themes || []).some(t => g.themes.includes(t))).map(q => q.theme).slice(0, 60).join(" ; ")].filter(Boolean).join("\n");
      if (!blocks.length && !d.note && !d.ref) throw new Error("ce document n'a ni fichier ni notes : ajoute l'un des deux");
      const r = await callClaude({ system: GEN_RULES, messages: [{ role: "user", content: blocks.concat([{ type: "text", text: info }]) }], maxTokens: 16000, web: 5 });
      g.result = parseGen(r.text); g.result.sel = g.result.questions.map(() => true);
    } catch (e) { toast(e.code ? aiErrMsg(e) : "Création impossible : " + e.message); }
    g.busy = false; if (VIEW.gen === g) genForm(docId);
  };
}
function genPreview(d, g) {
  const R = g.result;
  page(`<div class="panel">
    <div class="tools"><button class="sbtn" id="back">← Réglages de création</button><h2 style="font-size:18px;flex:1">${R.questions.length} questions proposées</h2></div>
    <p class="muted" style="margin-top:0">Décoche celles que tu ne veux pas. Tu pourras les modifier ensuite dans la Bibliothèque.</p>
    <div class="list">${R.questions.map((q, i) => `<label class="item genq"><div><div class="ti">${esc(q.stem)}</div><ol class="genopts">${q.opts.map(o => `<li class="${o.ok ? "ok" : ""}">${esc(o.t)}</li>`).join("")}</ol><div class="su">${esc(q.theme || "")}${q.level ? " · " + esc(q.level) : ""}</div></div><input type="checkbox" data-gi="${i}" ${R.sel[i] ? "checked" : ""} aria-label="Garder cette question"></label>`).join("")}</div>
    ${R.newRefs.length ? `<h3 style="font-size:15px;margin:18px 0 6px">Nouvelles références ajoutées à ta Bibliothèque</h3><ul class="refs">${R.newRefs.map(r => `<li><span class="lvl">${esc(r.level || "Article")}</span>${esc(r.ref || r.title)} <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.idLabel || "lien")}</a></li>`).join("")}</ul><p class="small">Vérifie-les d'un coup d'œil : elles viennent de la recherche web de Claude.</p>` : ""}
    <div class="actions"><button class="btn" id="g_add">Ajouter ${R.sel.filter(Boolean).length} question${R.sel.filter(Boolean).length > 1 ? "s" : ""}</button><button class="btn ghost" id="g_drop">Tout jeter</button></div>
  </div>`);
  $$("[data-gi]").forEach(x => x.onchange = () => { R.sel[+x.dataset.gi] = x.checked; genPreview(d, g); });
  $("#back").onclick = () => { g.result = null; genForm(g.doc); };
  $("#g_drop").onclick = () => { VIEW.gen = null; renderLib(); };
  $("#g_add").onclick = () => {
    let sid = g.serie;
    if (sid === "new") { const ns = nextSerie(); sid = ns.id; if (DATA.series[sid]) sid = rid("serie"); putDoc("series", sid, { name: ns.name, sub: d.title, note: "Créée depuis un document", order: ns.n }); }
    if (sid === "none") sid = "";
    const refIds = {};
    for (const r of R.newRefs) { const id = rid("ref"); refIds[r.key] = id; putDoc("library", id, { title: r.title, kind: "Synthèse / article", level: r.level || "", ref: r.ref || "", url: r.url, idLabel: r.idLabel || "", location: "", note: "Ajoutée par Claude lors de la création de QCM depuis « " + d.title + " ».", themes: g.themes.slice() }); }
    let order = sid ? qidsOf(sid).length : 0, n = 0;
    R.questions.forEach((q, i) => {
      if (!R.sel[i]) return; n++;
      const th = (q.themes || []).filter(t => DATA.themes[t]); const themes = th.length ? th : g.themes.slice();
      putDoc("questions", rid("q"), { serie: sid, order: ++order, theme: q.theme || d.title, themes, level: q.level || "", dossier: "", step: 0, of: 0, add: "", stem: q.stem, opts: q.opts, ess: q.ess || "", cours: q.cours || "", lit: q.lit || "", piege: q.piege || "", schema: "", caption: "", image: "", docs: [VIEW.doc].concat((q.refs || []).map(k => refIds[k]).filter(Boolean)) });
    });
    toast(n + " question" + (n > 1 ? "s" : "") + " ajoutée" + (n > 1 ? "s" : "")); VIEW.gen = null; renderLib();
  };
}

/* ---------- fichier d'un document ---------- */
async function openDocFile(d, download) {
  try {
    toast("Ouverture du fichier…");
    const bytes = await fileBytes(d.file.id); if (!bytes) return toast("Fichier pas encore disponible sur cet appareil : synchronise d'abord.");
    const url = URL.createObjectURL(new Blob([bytes], { type: d.file.type || "application/octet-stream" }));
    const a = document.createElement("a"); a.href = url; if (download) a.download = d.file.name; else a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { toast("Fichier illisible."); }
}

/* ---------- réglage de la clé API ---------- */
function aiSettingsHTML() {
  const c = aiConf();
  return `<section class="panel" style="margin-bottom:14px">
    <h2 style="font-size:17px">Claude dans l'app</h2>
    <p class="muted">Sans clé, la bulle de chat et la création de QCM ouvrent l'app Claude (compris dans ton abonnement). Avec une <b>clé API Anthropic</b>, les réponses arrivent directement ici. La clé se crée sur <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> ; elle est <b>facturée à l'usage</b>, en dehors de ton abonnement (de l'ordre de quelques centimes par échange, davantage pour créer une série). Elle est gardée chiffrée dans ton coffre et partagée entre tes appareils.</p>
    ${c.key ? `<p class="status live" style="margin:8px 0"><span class="dot"></span><span>Clé enregistrée (…${esc(c.key.slice(-4))}) · ${esc(AI_MODELS[c.model || "claude-sonnet-5"] || c.model)}</span></p>` : ""}
    <div class="grid2">
      <label class="f">Clé API<input type="password" id="ai_key" placeholder="${c.key ? "Nouvelle clé (laisser vide pour garder)" : "sk-ant-…"}" autocomplete="off"></label>
      <label class="f">Modèle<select id="ai_model">${Object.entries(AI_MODELS).map(([k, v]) => `<option value="${k}" ${(c.model || "claude-sonnet-5") === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
    </div>
    <div class="actions"><button class="btn ghost" id="ai_save">Enregistrer et tester</button>${c.key ? `<button class="btn ghost" id="ai_del">Retirer la clé</button>` : ""}</div>
  </section>`;
}
function bindAISettings() {
  $("#ai_save").onclick = async () => {
    const k = $("#ai_key").value.replace(/\s/g, ""), c = aiConf();
    const conf = { key: k || c.key || "", model: val("ai_model") };
    if (!conf.key) return toast("Colle d'abord ta clé API.");
    const old = DATA.settings.ai; DATA.settings.ai = conf;
    try { await callClaude({ system: "Réponds seulement : OK", messages: [{ role: "user", content: "Test" }], maxTokens: 5 }); }
    catch (e) { DATA.settings.ai = old; return toast(aiErrMsg(e)); }
    putDoc("settings", "ai", conf); toast("Clé enregistrée et vérifiée"); renderSettings();
  };
  const d = $("#ai_del"); if (d) d.onclick = () => { delDoc("settings", "ai"); toast("Clé retirée"); renderSettings(); };
}
