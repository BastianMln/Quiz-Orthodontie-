/* ============================================================
   QUIZ ODF — cœur : chiffrement, stockage local, synchro GitHub
   ------------------------------------------------------------
   Dépôt  : BastianMln/quiz-odf, branche « data » (hors site publié)
   vault/keys.json      clé maître K enveloppée par le mot de passe
                        + clé publique RSA (dépôt de contenu par Claude)
   vault/content.enc    documents, questions, séries, dossiers, thèmes (chiffré K)
   vault/progress.enc   progression (chiffré K)
   vault/img/<id>.enc   photos (chiffré K ou clé publique)
   vault/inbox/*.enc    contenus déposés (clé publique), fusionnés puis effacés
   ============================================================ */
const APP_VERSION = "2026.09.28-3";
const GH = { owner: "BastianMln", repo: "Quiz-Orthodontie-", branch: "data" };
const COLS = ["library", "questions", "series", "dossiers", "themes"];
const COL2KEY = { library: "lib", questions: "qs", series: "series", dossiers: "dossiers", themes: "themes" };

/* ---------- encodage ---------- */
const TE = new TextEncoder(), TD = new TextDecoder();
function b64(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s) { const bin = atob(String(s).replace(/\s/g, "")); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
const rnd = n => crypto.getRandomValues(new Uint8Array(n));

/* ---------- chiffrement ---------- */
const PBKDF2_ITER = 310000;
async function pwKey(pw, salt, iter) {
  const base = await crypto.subtle.importKey("raw", TE.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["wrapKey", "unwrapKey"]);
}
async function aesEnc(key, bytes) { const iv = rnd(12); const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes); return { iv: b64(iv), ct: b64(ct) }; }
async function aesDec(key, o) { return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(o.iv) }, key, unb64(o.ct))); }

/* Chiffre un objet JSON (ou des octets) avec la clé maître K */
async function sealK(bytesOrObj) {
  const bytes = bytesOrObj instanceof Uint8Array ? bytesOrObj : TE.encode(JSON.stringify(bytesOrObj));
  const o = await aesEnc(KEY, bytes); return JSON.stringify({ a: "k1", iv: o.iv, ct: o.ct });
}
/* Déchiffre un fichier : clé maître (k1) ou dépôt par clé publique (pk1) */
async function openBytes(text) {
  const o = JSON.parse(text);
  if (o.a === "k1") return aesDec(KEY, o);
  if (o.a === "pk1") {
    const priv = await privateKey();
    const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, unb64(o.ek));
    const k = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    return aesDec(k, o);
  }
  throw new Error("format inconnu");
}
async function openJSON(text) { return JSON.parse(TD.decode(await openBytes(text))); }

let KEY = null, KEYS_FILE = null, PRIV = null;
async function privateKey() {
  if (PRIV) return PRIV;
  const kf = KEYS_FILE || (await idb.get("kv", "keysFile"));
  const pk = await aesDec(KEY, kf.priv);
  PRIV = await crypto.subtle.importKey("pkcs8", pk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  return PRIV;
}
/* Première mise en place : génère K et la paire RSA, protège K par le mot de passe */
async function createKeys(pw) {
  const k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const pair = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
  const salt = rnd(16), wrapIv = rnd(12);
  const wk = await pwKey(pw, salt, PBKDF2_ITER);
  const wrapped = await crypto.subtle.wrapKey("raw", k, wk, { name: "AES-GCM", iv: wrapIv });
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const priv = await aesEnc(k, new Uint8Array(pkcs8));
  const pub = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const file = { v: 1, iter: PBKDF2_ITER, salt: b64(salt), wrapIv: b64(wrapIv), wrapped: b64(wrapped), pub, priv, created: new Date().toISOString() };
  return { file, key: await crypto.subtle.importKey("raw", await crypto.subtle.exportKey("raw", k), "AES-GCM", false, ["encrypt", "decrypt"]) };
}
async function unlockKeys(file, pw, extractable) {
  const wk = await pwKey(pw, unb64(file.salt), file.iter);
  return crypto.subtle.unwrapKey("raw", unb64(file.wrapped), wk, { name: "AES-GCM", iv: unb64(file.wrapIv) }, "AES-GCM", !!extractable, ["encrypt", "decrypt"]);
}
async function rewrapKeys(file, oldPw, newPw) {
  const k = await unlockKeys(file, oldPw, true);
  const salt = rnd(16), wrapIv = rnd(12);
  const wk = await pwKey(newPw, salt, PBKDF2_ITER);
  const wrapped = await crypto.subtle.wrapKey("raw", k, wk, { name: "AES-GCM", iv: wrapIv });
  return Object.assign({}, file, { iter: PBKDF2_ITER, salt: b64(salt), wrapIv: b64(wrapIv), wrapped: b64(wrapped), changed: new Date().toISOString() });
}

/* ---------- IndexedDB (stockage de l'appareil) ---------- */
const idb = (() => {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open("quiz-odf", 1);
      r.onupgradeneeded = () => { const d = r.result; ["kv", "img"].forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const tx = (store, mode, fn) => open().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, mode); const s = t.objectStore(store); const out = fn(s);
    t.oncomplete = () => res(out && "result" in out ? out.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
  return {
    get: (s, k) => tx(s, "readonly", st => st.get(k)),
    set: (s, k, v) => tx(s, "readwrite", st => st.put(v, k)),
    del: (s, k) => tx(s, "readwrite", st => st.delete(k)),
    clear: s => tx(s, "readwrite", st => st.clear()),
  };
})();

/* ---------- GitHub ---------- */
let TOKEN = "";
function ghErr(code, status) { const e = new Error(code); e.code = code; e.status = status; return e; }
async function gh(path, opt) {
  opt = opt || {};
  let r;
  try {
    r = await fetch("https://api.github.com/repos/" + GH.owner + "/" + GH.repo + path, {
      method: opt.method || "GET", cache: "no-store",
      headers: Object.assign({ Authorization: "Bearer " + TOKEN, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, opt.headers || {}),
      body: opt.body ? JSON.stringify(opt.body) : undefined,
    });
  } catch (e) { throw ghErr("offline"); }
  if (r.status === 401) { let m = ""; try { m = (await r.json()).message || ""; } catch (e) {} const er = ghErr("token", 401); er.detail = m; throw er; }
  if (r.status === 403 && r.headers.get("x-ratelimit-remaining") === "0") throw ghErr("ratelimit", 403);
  return r;
}
const enc64 = s => b64(TE.encode(s));
async function ghGet(path) {
  const r = await gh("/contents/" + path + "?ref=" + GH.branch);
  if (r.status === 404) return null;
  if (!r.ok) throw ghErr(r.status === 403 ? "forbidden" : "http", r.status);
  const j = await r.json();
  if (Array.isArray(j)) throw ghErr("isdir");
  let text;
  if (j.encoding === "base64" && j.content) text = TD.decode(unb64(j.content));
  else {
    const raw = await gh("/contents/" + path + "?ref=" + GH.branch, { headers: { Accept: "application/vnd.github.raw" } });
    if (!raw.ok) throw ghErr("http", raw.status);
    text = await raw.text();
  }
  return { sha: j.sha, text };
}
async function ghPut(path, text, sha, message) {
  const body = { message: message || "maj " + path, content: enc64(text), branch: GH.branch };
  if (sha) body.sha = sha;
  const r = await gh("/contents/" + path, { method: "PUT", body });
  if (r.status === 409 || r.status === 422) throw ghErr("conflict", r.status);
  if (r.status === 403 || r.status === 404) throw ghErr("forbidden", r.status);
  if (!r.ok) throw ghErr("http", r.status);
  return (await r.json()).content.sha;
}
async function ghDel(path, sha, message) {
  const r = await gh("/contents/" + path, { method: "DELETE", body: { message: message || "suppr " + path, sha, branch: GH.branch } });
  if (r.status === 404) return;
  if (r.status === 409 || r.status === 422) throw ghErr("conflict", r.status);
  if (!r.ok) throw ghErr("http", r.status);
}
async function ghList(dir) {
  const r = await gh("/contents/" + dir + "?ref=" + GH.branch);
  if (r.status === 404) return [];
  if (!r.ok) throw ghErr("http", r.status);
  const j = await r.json(); return Array.isArray(j) ? j.filter(x => x.type === "file") : [];
}
async function ghCheckAccess() {
  const r = await gh("");
  if (r.status === 404) throw ghErr("norepo", 404);
  if (!r.ok) throw ghErr("http", r.status);
  const j = await r.json();
  if (j.permissions && !j.permissions.push) throw ghErr("readonly");
  const b = await gh("/branches/" + GH.branch);
  if (b.status === 404) {
    const def = await gh("/git/ref/heads/" + (j.default_branch || "main"));
    if (!def.ok) throw ghErr("nobranch");
    const sha = (await def.json()).object.sha;
    const c = await gh("/git/refs", { method: "POST", body: { ref: "refs/heads/" + GH.branch, sha } });
    if (!c.ok && c.status !== 422) throw ghErr("nobranch", c.status);
  }
  return j;
}

/* ---------- contenu : fusion document par document ---------- */
/* CONTENT = { docs: { "questions/s01q01": {..., _u: horodatage} }, del: { "questions/x": horodatage } } */
function emptyContent() { return { v: 1, docs: {}, del: {} }; }
function mergeContent(a, b) {
  a = a || emptyContent(); b = b || emptyContent();
  const out = emptyContent();
  const keys = new Set([...Object.keys(a.docs || {}), ...Object.keys(b.docs || {}), ...Object.keys(a.del || {}), ...Object.keys(b.del || {})]);
  for (const k of keys) {
    const da = (a.docs || {})[k], db_ = (b.docs || {})[k];
    const doc = !da ? db_ : !db_ ? da : ((db_._u || 0) > (da._u || 0) ? db_ : da);
    const t = Math.max((a.del || {})[k] || 0, (b.del || {})[k] || 0);
    if (doc && (doc._u || 0) > t) out.docs[k] = doc;
    else if (t) out.del[k] = t;
  }
  return out;
}
function contentSig(c) {
  return JSON.stringify([Object.keys(c.docs).sort().map(k => k + ":" + (c.docs[k]._u || 0)), Object.keys(c.del).sort().map(k => k + ":" + c.del[k])]);
}
function mergeHist(a, b) {
  const out = {};
  for (const src of [a || {}, b || {}]) for (const [q, arr] of Object.entries(src)) {
    const m = new Map((out[q] || []).map(x => [x.d, x]));
    (arr || []).forEach(x => { if (x && x.d) m.set(x.d, x); });
    out[q] = Array.from(m.values()).sort((x, y) => x.d - y.d).slice(-30);
  }
  return out;
}
function histSig(h) { return JSON.stringify(Object.keys(h).sort().map(k => [k, (h[k] || []).map(x => x.d)])); }

/* ---------- état ---------- */
let CONTENT = emptyContent();
let DATA = { lib: {}, qs: {}, series: {}, dossiers: {}, themes: {} };
let PROG = {};
let META = { contentDirty: false, progDirty: false, lastSync: 0, imgUp: [], imgDel: [] };
let SYNC = { busy: false, again: false, error: "", timer: null };

function rebuild() {
  const d = { lib: {}, qs: {}, series: {}, dossiers: {}, themes: {} };
  for (const [k, v] of Object.entries(CONTENT.docs)) {
    const i = k.indexOf("/"); const col = k.slice(0, i), id = k.slice(i + 1);
    const key = COL2KEY[col]; if (!key) continue;
    const o = Object.assign({}, v); delete o._u; d[key][id] = o;
  }
  DATA = d;
}
let saveT = null;
function flushLocal() { clearTimeout(saveT); saveT = null; return Promise.all([idb.set("kv", "content", CONTENT), idb.set("kv", "prog", PROG), idb.set("kv", "meta", META)]).catch(() => {}); }
function persistLocal(now) {
  if (now) return flushLocal();
  clearTimeout(saveT); saveT = setTimeout(flushLocal, 120);
}
addEventListener("pagehide", () => { if (saveT) flushLocal(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && saveT) flushLocal(); });
function stamp() { return Date.now(); }
function putDoc(col, id, obj) {
  const k = col + "/" + id;
  CONTENT.docs[k] = Object.assign({}, obj, { _u: Math.max(stamp(), ((CONTENT.docs[k] || {})._u || 0) + 1) });
  delete CONTENT.del[k];
  DATA[COL2KEY[col]][id] = Object.assign({}, obj);
  META.contentDirty = true; persistLocal(); scheduleSync(1500);
}
function delDoc(col, id) {
  const k = col + "/" + id;
  CONTENT.del[k] = Math.max(stamp(), ((CONTENT.docs[k] || {})._u || 0) + 1);
  delete CONTENT.docs[k];
  delete DATA[COL2KEY[col]][id];
  META.contentDirty = true; persistLocal(); scheduleSync(1500);
}
function recordAnswer(qid, rec) {
  (PROG[qid] = PROG[qid] || []).push(rec);
  PROG[qid] = PROG[qid].slice(-30);
  META.progDirty = true; persistLocal(); scheduleSync(20000);
}

/* ---------- photos ---------- */
const IMG_URL = {};
async function resizeImage(file) {
  const bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const max = 1600, sc = Math.min(1, max / Math.max(bmp.naturalWidth, bmp.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.naturalWidth * sc); c.height = Math.round(bmp.naturalHeight * sc);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  URL.revokeObjectURL(bmp.src);
  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
  return new Uint8Array(await blob.arrayBuffer());
}
async function addImage(file) {
  const bytes = await resizeImage(file);
  const id = "img-" + Date.now().toString(36) + b64(rnd(6)).replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase();
  await idb.set("img", id, await sealK(bytes));
  IMG_URL[id] = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
  META.imgUp.push(id); persistLocal();
  return id;
}
function removeImage(id) {
  if (!id) return;
  META.imgUp = META.imgUp.filter(x => x !== id);
  if (!META.imgDel.includes(id)) META.imgDel.push(id);
  idb.del("img", id); persistLocal(); scheduleSync(3000);
}
async function imageURL(id) {
  if (IMG_URL[id]) return IMG_URL[id];
  let text = await idb.get("img", id);
  if (!text && TOKEN && navigator.onLine) {
    const g = await ghGet("vault/img/" + id + ".enc").catch(() => null);
    if (g) { text = g.text; idb.set("img", id, text); }
  }
  if (!text) return "";
  const bytes = await openBytes(text);
  const type = bytes[0] === 0x89 ? "image/png" : bytes[0] === 0x52 ? "image/webp" : "image/jpeg";
  return (IMG_URL[id] = URL.createObjectURL(new Blob([bytes], { type })));
}
/* Remplit toutes les <img data-img="id"> de la page */
function hydrateImages(root) {
  (root || document).querySelectorAll("img[data-img]").forEach(async el => {
    const id = el.dataset.img; if (!id || el.dataset.done) return; el.dataset.done = "1";
    try { const u = await imageURL(id); if (u) el.src = u; else el.alt = "Photo pas encore disponible sur cet appareil"; }
    catch (e) { el.alt = "Photo illisible"; }
  });
}

/* ---------- synchronisation ---------- */
function scheduleSync(ms) { clearTimeout(SYNC.timer); SYNC.timer = setTimeout(sync, ms == null ? 0 : ms); }
async function sync() {
  clearTimeout(SYNC.timer);
  if (!TOKEN || !KEY) return;
  if (!navigator.onLine) { SYNC.error = "offline"; onSyncState(); return; }
  if (SYNC.busy) { SYNC.again = true; return; }
  SYNC.busy = true; SYNC.error = ""; onSyncState();
  let changed = false;
  try {
    await syncImages();
    changed = (await syncContent()) || changed;
    changed = (await syncProg()) || changed;
    META.lastSync = Date.now(); persistLocal();
  } catch (e) {
    SYNC.error = (e && e.code) || "http";
    console.warn("sync", e);
  }
  SYNC.busy = false; onSyncState(changed);
  if (SYNC.again) { SYNC.again = false; scheduleSync(500); }
}
async function syncImages() {
  for (const id of META.imgUp.slice()) {
    const text = await idb.get("img", id);
    if (text) { const ex = await ghGet("vault/img/" + id + ".enc"); if (!ex) await ghPut("vault/img/" + id + ".enc", text, null, "photo " + id); }
    META.imgUp = META.imgUp.filter(x => x !== id); persistLocal();
  }
  for (const id of META.imgDel.slice()) {
    const r = await gh("/contents/vault/img/" + id + ".enc?ref=" + GH.branch);
    if (r.ok) { const j = await r.json(); await ghDel("vault/img/" + id + ".enc", j.sha, "suppr photo " + id); }
    META.imgDel = META.imgDel.filter(x => x !== id); persistLocal();
  }
}
function normalizeInbox(x, fileTs) {
  const c = emptyContent();
  const ts = x.ts || fileTs || Date.now();
  for (const [k, v] of Object.entries(x.docs || {})) c.docs[k] = Object.assign({}, v, { _u: v._u || ts });
  for (const [k, v] of Object.entries(x.del || {})) c.del[k] = typeof v === "number" ? v : ts;
  return c;
}
async function syncContent() {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await ghGet("vault/content.enc");
    const remote = r ? await openJSON(r.text) : emptyContent();
    let incoming = remote;
    const used = [];
    for (const f of await ghList("vault/inbox")) {
      try { const g = await ghGet(f.path); if (!g) continue; const x = await openJSON(g.text); incoming = mergeContent(incoming, normalizeInbox(x)); used.push({ path: f.path, sha: g.sha }); }
      catch (e) { console.warn("inbox illisible", f.path, e); }
    }
    const merged = mergeContent(incoming, CONTENT);
    const needPut = !r || used.length || contentSig(merged) !== contentSig(remote);
    if (needPut) {
      try { await ghPut("vault/content.enc", await sealK(merged), r && r.sha, "contenu"); }
      catch (e) { if (e.code === "conflict") continue; throw e; }
    }
    for (const u of used) { try { await ghDel(u.path, u.sha, "boîte de dépôt intégrée"); } catch (e) {} }
    const before = contentSig(CONTENT);
    const now = mergeContent(merged, CONTENT); /* garde une modification faite pendant la synchro */
    META.contentDirty = contentSig(now) !== contentSig(merged);
    const changed = contentSig(now) !== before;
    CONTENT = now; rebuild(); await persistLocal(true);
    if (META.contentDirty) SYNC.again = true;
    return changed;
  }
  throw ghErr("conflict");
}
async function syncProg() {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await ghGet("vault/progress.enc");
    const remote = r ? ((await openJSON(r.text)).h || {}) : {};
    const merged = mergeHist(remote, PROG);
    if (!r || histSig(merged) !== histSig(remote)) {
      try { await ghPut("vault/progress.enc", await sealK({ h: merged, updated: Date.now() }), r && r.sha, "progression"); }
      catch (e) { if (e.code === "conflict") continue; throw e; }
    }
    const now = mergeHist(merged, PROG);
    const changed = histSig(now) !== histSig(PROG);
    META.progDirty = histSig(now) !== histSig(merged);
    PROG = now; await persistLocal(true);
    if (META.progDirty) SYNC.again = true;
    return changed;
  }
  throw ghErr("conflict");
}
/* L'interface remplace cette fonction */
let onSyncState = function () {};
