/*******************************************
 * CORE/utils.js – helpers compartilhados
 *******************************************/
export function nsLogger(ns = "[CT]") {
  return {
    log: (...a) => console.log(ns, ...a),
    warn: (...a) => console.warn(ns, ...a),
    error: (...a) => console.error(ns, ...a)
  };
}

export function normalizeText(s) {
  return (s || "")
    .replace(/\u00A0/g, " ")   // nbsp → espaço
    .replace(/\s+/g, " ")      // colapsa espaços
    .trim()
    .toLowerCase();
}

/** Lê breadcrumb dentro do frame atual: #TbPathAndNavigation #lbPath */
export function readBreadcrumb(doc = document) {
  const el = doc.querySelector("#TbPathAndNavigation #lbPath");
  const raw = el ? el.textContent : "";
  const norm = normalizeText(raw);
  return { raw, norm, el };
}

/** Timestamp: YYYY-MM-DDTHHMMSS (sem dois-pontos) */
export function timeStampCompact(d = new Date()) {
  return d.toISOString().replace(/\..+/, "").replace(/:/g, "");
}

/** POST para kroki.io -> PNG (Blob) */
export async function krokiPlantUmlToPng(umlText) {
  const res = await fetch("https://kroki.io/plantuml/png", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: umlText
  });
  if (!res.ok) throw new Error(`kroki.io error ${res.status}`);
  return res.blob();
}

/** POST para kroki.io -> SVG (Blob) */
export async function krokiPlantUmlToSvg(umlText) {
  const res = await fetch("https://kroki.io/plantuml/svg", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: umlText
  });
  if (!res.ok) throw new Error(`kroki.io error ${res.status}`);
  return res.blob(); // image/svg+xml
}

/** Cria um MutationObserver simples (childList+subtree) e retorna o handler para disconnect */
export function attachSimpleObserver(cb, doc = document) {
  const mo = new MutationObserver(cb);
  mo.observe(doc.documentElement || doc.body, { childList: true, subtree: true });
  return () => mo.disconnect();
}
