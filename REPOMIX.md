This file is a merged representation of the entire codebase, combined into a single document by Repomix.

<file_summary>
This section contains a summary of this file.

<purpose>
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.
</purpose>

<file_format>
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  - File path as an attribute
  - Full contents of the file
</file_format>

<usage_guidelines>
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.
</usage_guidelines>

<notes>
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)
</notes>

</file_summary>

<directory_structure>
.github/
  ISSUE_TEMPLATE/
    feature_request.md
  workflows/
    release.yml
    repomix.yml
  PULL_REQUEST_TEMPLATE.md
core/
  content.js
  global-rules.js
  utils.js
domains/
  icnet/
    administrador/
      configuracao-ic/
        organograma.js
    pessoa-fisica/
      voluntario/
        organograma-voluntarios.js
    shared/
      export-grid.js
    icnet-utils.js
    main.js
    styles.css
scripts/
  build-zip.sh
templates/
  module-template.js
.gitattributes
.gitignore
.repomixignore
.repomixrc.json
AI_GUIDE.md
ARCHITECTURE.md
CODE_OF_CONDUCT.md
CONTRIBUTING.md
DEVELOPMENT.md
manifest.json
package.json
README.md
SECURITY.md
SUBDOMAINS.md
</directory_structure>

<files>
This section contains the contents of the repository's files.

<file path=".github/ISSUE_TEMPLATE/feature_request.md">
---
name: Feature request
about: Sugira uma nova funcionalidade
---
</file>

<file path=".github/PULL_REQUEST_TEMPLATE.md">
## Descrição
Explique o que foi feito e por quê.
</file>

<file path="core/content.js">
/*******************************************
 * CORE/content.js – Router por domínio
 * Carrega "domains/<subdominio>/main.js"
 * Logs: [CT-CORE]
 *******************************************/
(() => {
  const NS = "[CT-CORE]";
  const log = (...a) => console.log(NS, ...a);
  const warn = (...a) => console.warn(NS, ...a);

  if (window.__ct_core_loaded) return;
  window.__ct_core_loaded = true;

  const host = location.host; // ex.: icnet.conscienciologia.org.br
  const subdomain = host.split(".")[0] || "default";

  async function loadUtils() {
    const url = chrome.runtime.getURL("core/utils.js");
    return import(url);
  }

  async function boot() {
    const utils = await loadUtils();

    log("content loaded", {
      host,
      subdomain,
      href: location.href,
      topFrame: window.top === window
    });

    // mapeia subdomínio → main do domínio
    const domainMainPath = `domains/${subdomain}/main.js`;
    const mainUrl = chrome.runtime.getURL(domainMainPath);

    try {
      const mod = await import(mainUrl);
      if (typeof mod?.init !== "function") {
        warn(`domains/${subdomain}/main.js não exporta init()`);
        return;
      }
      await mod.init({
        host,
        href: location.href,
        doc: document,
        utils
      });
      log(`Domínio "${subdomain}" inicializado.`);
    } catch (e) {
      console.error(NS, `Falha ao importar ${domainMainPath}`, e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
</file>

<file path="core/global-rules.js">
/*****************************************************
 * core/global-rules.js
 * Regras globais independentes de domínio.
 * Foco: normalização e composição de nomes de arquivo.
 *****************************************************/

/**
 * Regra de normalização de tokens.
 * - minúsculo
 * - sem acentos/diacríticos
 * - troca qualquer caractere não [a-z0-9] por "_"
 * - remove "_" duplicados e bordas
 */
export function rule_sanitize_token(s) {
    return (s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

/**
 * Junta vários tokens aplicando a regra de normalização em cada parte,
 * removendo vazias e usando separador (default "-").
 */
export function rule_join_tokens(parts, sep = "-") {
    const safe = (Array.isArray(parts) ? parts : [parts])
        .map(rule_sanitize_token)
        .filter(Boolean);
    return safe.join(sep);
}

/**
 * Timestamp em formato de token estável para nomes de arquivo: yyyymmdd-hhmmss
 */
export function rule_timestamp_token(d = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return (
        d.getFullYear().toString() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        "-" +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds())
    );
}

/**
 * Monta um nome de arquivo padronizado:
 * rule_join_tokens(parts) + "-" + rule_timestamp_token() + "." + ext
 * Ex.: rule_make_filename(["icnet", ic, breadcrumb], "csv")
 */
export function rule_make_filename(parts, ext = "txt", d = new Date()) {
    const stem = rule_join_tokens(parts);
    const ts = rule_timestamp_token(d);
    const safeExt = rule_sanitize_token(ext) || "txt";
    return `${stem}-${ts}.${safeExt}`;
}
</file>

<file path="domains/icnet/administrador/configuracao-ic/organograma.js">
/*****************************************************
 * ICNET/Organograma – módulo de tela
 * Ativa SOMENTE em:
 *   Administrador » Configuração IC » Organograma
 * Funções:
 *  - lê #Grid1
 *  - monta PlantUML (WBS)
 *  - POST kroki -> PNG
 *  - injeta Toolbar (Atualizar / Baixar PNG)
 *  - nome arquivo: <IC>-YYYY-MM-DDTHHMMSS.png
 * Logs: [ICNET/ORG]
 *****************************************************/
export async function init(ctx) {
  const { utils, doc } = ctx;
  const {
    nsLogger, normalizeText, readBreadcrumb,
    krokiPlantUmlToPng, timeStampCompact, attachSimpleObserver
  } = utils;

  const { log, warn, error } = nsLogger("[ICNET/ORG]");

  if (window.__ct_icnet_org_loaded) {
    log("já inicializado neste frame.");
    return;
  }
  window.__ct_icnet_org_loaded = true;
  window.__ct_icnet_org_done = window.__ct_icnet_org_done || false;

  function isOrganogramaPage() {
    const { norm } = readBreadcrumb(doc);
    const alvo = normalizeText("Administrador » Configuração IC » Organograma");
    const ok = norm.includes(alvo);
    if (!ok) log("breadcrumb não bate com Organograma:", norm);
    return ok;
  }

  // -------- Grid Parser (#Grid1) --------
  function parseGridOrganograma() {
    const grid = doc.querySelector("#Grid1");
    if (!grid) {
      log("parse: #Grid1 não encontrado.");
      return [];
    }
    const rows = grid.querySelectorAll("tr");
    const out = [];
    for (const r of rows) {
      const tds = r.querySelectorAll(":scope > td");
      if (tds.length < 4) continue;

      const id = (tds[0].innerText || "").trim();
      const pai = (tds[1].innerText || "").trim();

      // descrição pode estar embutida em TreeGridComponent
      let descricao = "";
      const spansDesc = tds[2].querySelectorAll("span");
      for (const s of spansDesc) {
        const t = (s.textContent || "").trim();
        if (t) descricao = t;
      }
      if (!descricao) descricao = (tds[2].innerText || "").trim().replace(/\s+/g, " ");

      const sigla = (tds[3].innerText || "").trim();

      if (id && descricao) out.push({ id, pai, descricao, sigla });
    }

    log("parse: nós =", out.length);
    if (out.length) {
      console.groupCollapsed("[ICNET/ORG] Amostra (5)");
      console.table(out.slice(0, 5));
      console.groupEnd();
    }
    return out;
  }

  // -------- Montagem do PlantUML (WBS) --------
  function buildWbsByParentText(nodes) {
    const childrenByParentDesc = new Map();
    nodes.forEach(n => {
      const key = (n.pai || "").trim();
      if (!childrenByParentDesc.has(key)) childrenByParentDesc.set(key, []);
      childrenByParentDesc.get(key).push(n);
    });

    const roots = childrenByParentDesc.get("") || [];
    const sortFn = (a, b) => (a.descricao || "").localeCompare(b.descricao || "", "pt-BR");

    function renderNode(node, level, lines) {
      const prefix = "*".repeat(level);
      const label = node.sigla ? `${node.descricao} (${node.sigla})` : node.descricao;
      lines.push(`${prefix} ${label}`);
      const filhos = (childrenByParentDesc.get(node.descricao) || []).slice().sort(sortFn);
      for (const f of filhos) renderNode(f, level + 1, lines);
    }

    const lines = ["@startwbs"];
    const orderedRoots = roots.slice().sort(sortFn);
    for (const r of orderedRoots) renderNode(r, 1, lines);
    lines.push("@endwbs");

    const uml = lines.join("\n");
    log("uml chars =", uml.length);
    return uml;
  }

  // -------- Nome da IC (entre frames) --------
  function resolveICFromDocument(d, where) {
    if (!d) return null;
    // 1) seletor oficial
    const sel = d.querySelector("#ddList_ICs");
    if (sel) {
      const opt = sel.options[sel.selectedIndex];
      const txt = (opt && opt.textContent ? opt.textContent : sel.value || "").trim();
      if (txt) {
        log(`IC em ${where} via #ddList_ICs:`, txt);
        return txt.replace(/\s+/g, "_");
      }
    }
    // 2) fallback: #navbarIC select
    const nav = d.querySelector("#navbarIC");
    if (nav) {
      const optSel = nav.querySelector("select");
      const opt = optSel?.options?.[optSel.selectedIndex];
      const txt = (opt && opt.textContent ? opt.textContent : "").trim();
      if (txt) {
        log(`IC em ${where} via #navbarIC:`, txt);
        return txt.replace(/\s+/g, "_");
      }
    }
    return null;
  }

  function getICName() {
    // frame atual
    let name = resolveICFromDocument(doc, "this-frame");
    if (name) return name;

    // top.document
    try {
      if (window.top && window.top.document) {
        name = resolveICFromDocument(window.top.document, "top-document");
        if (name) return name;
      }
    } catch {}

    // varrer iframes
    try {
      if (window.top && window.top.frames) {
        const frames = Array.from(window.top.frames);
        for (let i = 0; i < frames.length; i++) {
          try {
            const d = frames[i].document || frames[i].contentDocument;
            name = resolveICFromDocument(d, `top-frame[${i}]`);
            if (name) return name;
          } catch {}
          try {
            const el = window.top.document.querySelectorAll("iframe")[i];
            const d2 = el?.contentWindow?.document;
            name = resolveICFromDocument(d2, `iframe-el[${i}]`);
            if (name) return name;
          } catch {}
        }
      }
    } catch {}

    warn("IC não encontrada; usando 'IC'.");
    return "IC";
  }

  // -------- UI --------
  function ensureToolbar(containerBefore) {
    let bar = doc.querySelector("#ct-org-toolbar");
    if (bar) return bar;

    bar = doc.createElement("div");
    bar.id = "ct-org-toolbar";
    bar.style.display = "flex";
    bar.style.alignItems = "center";
    bar.style.gap = "8px";
    bar.style.margin = "12px 0";

    const title = doc.createElement("strong");
    title.textContent = "Organograma (PlantUML)";
    bar.appendChild(title);

    const btn = doc.createElement("button");
    btn.textContent = "Atualizar";
    btn.style.padding = "4px 10px";
    btn.style.fontSize = "12px";
    btn.style.cursor = "pointer";
    btn.style.borderRadius = "6px";
    btn.style.border = "1px solid #888";
    btn.style.background = "#f5f5f5";
    btn.addEventListener("click", () => {
      log("Atualizar clicado");
      window.__ct_icnet_org_done = false;
      renderOrganogramaImage();
    });
    bar.appendChild(btn);

    const link = doc.createElement("a");
    link.id = "ct-org-download";
    link.textContent = "Baixar PNG";
    link.style.fontSize = "12px";
    link.style.border = "1px solid #888";
    link.style.borderRadius = "6px";
    link.style.padding = "4px 10px";
    link.style.color = "#0645AD";
    link.style.textDecoration = "none";
    link.download = "organograma.png";
    bar.appendChild(link);

    containerBefore.parentElement.insertBefore(bar, containerBefore);
    log("Toolbar criada.");
    return bar;
  }

  function upsertImage(containerBefore, blobUrl, filename) {
    let img = doc.querySelector("#ct-org-img");
    if (!img) {
      img = doc.createElement("img");
      img.id = "ct-org-img";
      img.style.maxWidth = "100%";
      img.style.display = "block";
      img.style.margin = "8px 0 16px 0";
      containerBefore.parentElement.insertBefore(img, containerBefore);
      log("IMG criado.");
    }
    img.src = blobUrl;

    const a = doc.querySelector("#ct-org-download");
    if (a) {
      a.href = blobUrl;
      a.download = filename;
      log("Filename:", filename);
    }
  }

  // -------- Workflow principal --------
  async function renderOrganogramaImage() {
    try {
      if (!isOrganogramaPage()) {
        log("abort: não é Organograma.");
        return;
      }

      const grid = doc.querySelector("#Grid1");
      if (!grid) {
        warn("#Grid1 não encontrado.");
        return;
      }

      ensureToolbar(grid);

      const nodes = parseGridOrganograma();
      if (!nodes.length) {
        warn("0 nós.");
        return;
      }

      const uml = buildWbsByParentText(nodes);
      const blob = await krokiPlantUmlToPng(uml);
      const urlBlob = URL.createObjectURL(blob);

      const ic = getICName();
      const filename = `${ic}-${timeStampCompact()}.png`;

      upsertImage(grid, urlBlob, filename);

      window.__ct_icnet_org_done = true;
      detach && detach();
      log("Organograma renderizado. Nós:", nodes.length);
    } catch (e) {
      error("Erro ao gerar:", e);
    }
  }

  function maybeEnhance() {
    if (window.__ct_icnet_org_done) return true;
    const isOrg = isOrganogramaPage();
    const grid = doc.querySelector("#Grid1");
    if (isOrg && grid) {
      renderOrganogramaImage();
      return true;
    }
    return false;
  }

  // Observer local
  const detach = attachSimpleObserver(maybeEnhance, doc);

  // Primeira rodada
  maybeEnhance();

  // Atalho debug
  window.addEventListener("keydown", (ev) => {
    if (ev.ctrlKey && ev.shiftKey && ev.code === "KeyO") {
      renderOrganogramaImage();
    }
  });
}
</file>

<file path="domains/icnet/shared/export-grid.js">
// domains/icnet/shared/export-grid.js
// Toolbar global por FormEntry + botão "Exportar" para CSV (FA 5.0.7)
// - NÃO injeta CSS externo (compatível com Chrome Web Store)
// - Reutiliza a barra do organograma (#ct-org-toolbar) quando existir
// - Exporta a PRIMEIRA table.GridStyle do MESMO FormEntry (sem colspan)
// - CSV com UTF-8 BOM e CRLF; cabeçalhos de th; links -> texto; checkbox -> true/false
// - Nome do arquivo via util de domínio: icnet_make_filename()

import {
  icnet_findFormEntriesWithGrid,
  icnet_make_filename
} from "../icnet-utils.js";

export async function init(ctx) {
  const { utils, doc, href, host } = ctx;
  const { nsLogger, attachSimpleObserver } = utils || {};
  const { log, warn, error } = (nsLogger ? nsLogger("[ICNET/EXPORT]") : console);

  try {
    // Boot-guard por frame
    if (window.__cosmoware_icnet_export_booted) {
      log && log("Já inicializado neste frame, ignorando.");
      return;
    }
    window.__cosmoware_icnet_export_booted = true;

    log && log("Boot inicial", { host, href });

    // -------- Utilitários locais (apenas UI/CSV) --------

    function hasFA(doc) {
      try {
        const test = doc.createElement("i");
        test.className = "fas fa-check";
        test.style.position = "absolute";
        test.style.left = "-9999px";
        (doc.body || doc.documentElement).appendChild(test);
        const fam = getComputedStyle(test).fontFamily || "";
        test.remove();
        return /Font Awesome/i.test(fam);
      } catch {
        return false;
      }
    }

    function iconOrFallback(faName, text = "") {
      if (hasFA(doc)) {
        return `<i class="fas ${faName}" aria-hidden="true"></i>${text}`;
      }
      const fallback = faName.includes("fa-wrench") ? "🔧"
        : faName.includes("fa-download") ? "⬇️"
          : "•";
      return `${fallback}${text}`;
    }

    function escapeCsvField(value) {
      let s = value == null ? "" : String(value);
      s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const mustQuote = /[",\n]/.test(s);
      if (mustQuote) {
        s = '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    function extractGridToCsv(entryEl) {
      const table = entryEl.querySelector("table.GridStyle");
      if (!table) return { csv: "", rows: 0, cols: 0 };

      const ths = Array.from(table.querySelectorAll("tr.GridHeaderStyle th"));
      const headers = ths.map((th, i) => {
        const t = (th.textContent || "").trim();
        return t || `col_${i + 1}`;
      });

      const rowsEls = Array.from(table.querySelectorAll("tr"))
        .filter(tr => !tr.classList.contains("GridHeaderStyle") && !tr.classList.contains("GridPagerStyle"));

      const lines = [];
      lines.push(headers.map(escapeCsvField).join(","));

      let dataRowCount = 0;
      for (const tr of rowsEls) {
        const tds = Array.from(tr.querySelectorAll("td"));
        if (tds.length === 0) continue;

        const row = tds.map(td => {
          const chk = td.querySelector('input[type="checkbox"]');
          if (chk) return escapeCsvField(chk.checked ? "true" : "false");
          const txt = (td.innerText || "").trim();
          return escapeCsvField(txt);
        });

        lines.push(row.join(","));
        dataRowCount++;
      }

      const bom = "\uFEFF";
      const csv = bom + lines.join("\r\n") + "\r\n";
      return { csv, rows: dataRowCount, cols: headers.length };
    }

    function downloadCsv(csvText, filename) {
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = doc.createElement("a");
      a.href = url;
      a.download = filename;
      doc.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 0);
    }

    function onExportClick(toolbarEl, entryEl) {
      try {
        const status = toolbarEl.querySelector(".cosmoware-status");
        if (status) status.textContent = "exportando…";

        const { csv, rows, cols } = extractGridToCsv(entryEl);
        const filename = icnet_make_filename("csv", doc, new Date());

        downloadCsv(csv, filename);

        log && log("CSV gerado.", { filename, rows, cols });
        if (status) status.textContent = `exportado: ${rows} linha(s), ${cols} coluna(s).`;
      } catch (e) {
        (error || console.error)("Falha ao exportar CSV:", e);
        const status = toolbarEl.querySelector(".cosmoware-status");
        if (status) status.textContent = "falha ao exportar. ver console.";
      }
    }

    // -------- UI: toolbar / botão --------

    function ensureToolbar(entryEl) {
      // 1) Se a tela tiver a barra do organograma, reutilize-a
      const orgToolbar = doc.querySelector("#ct-org-toolbar");
      if (orgToolbar) {
        if (!orgToolbar.querySelector(".cosmoware-btn-export")) {
          const btn = doc.createElement("button");
          btn.type = "button";
          btn.className = "cosmoware-btn-export btn btn-outline-primary btn-sm d-inline-flex align-items-center";
          btn.innerHTML = iconOrFallback("fa-download", " Exportar");

          btn.addEventListener("click", () => {
            let status = orgToolbar.querySelector(".cosmoware-status");
            if (!status) {
              status = doc.createElement("span");
              status.className = "cosmoware-status text-muted small ml-2";
              orgToolbar.appendChild(status);
            }
            onExportClick(orgToolbar, entryEl);
          });

          orgToolbar.appendChild(btn);
          (log || console.log)("Botão Exportar adicionado na barra do organograma.");
        }
        entryEl.dataset.cosmowareToolbar = "1";
        return orgToolbar;
      }

      // 2) Caso não exista organograma toolbar, criamos a nossa por FormEntry
      if (entryEl.dataset.cosmowareToolbar === "1") {
        return entryEl.querySelector(":scope > .cosmoware-toolbar") || null;
      }

      const toolbar = doc.createElement("div");
      toolbar.className = "cosmoware-toolbar d-flex align-items-center gap-2 mb-2 p-2 border rounded";

      const title = doc.createElement("strong");
      title.className = "mr-2 d-flex align-items-center";
      title.innerHTML = iconOrFallback("fa-wrench", " Extensão");

      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "cosmoware-btn-export btn btn-outline-primary btn-sm d-inline-flex align-items-center";
      btn.innerHTML = iconOrFallback("fa-download", " Exportar");

      const status = doc.createElement("span");
      status.className = "cosmoware-status text-muted small ml-2";
      status.textContent = "pronto";

      toolbar.appendChild(title);
      toolbar.appendChild(btn);
      toolbar.appendChild(status);

      entryEl.insertBefore(toolbar, entryEl.firstChild);
      entryEl.dataset.cosmowareToolbar = "1";

      log && log("Toolbar criada para FormEntry.", { entry: entryEl });

      btn.addEventListener("click", () => onExportClick(toolbar, entryEl));

      return toolbar;
    }

    function run() {
      const targets = icnet_findFormEntriesWithGrid(doc);
      if (targets.length === 0) {
        log && log("Nenhum FormEntry com GridStyle detectado neste frame.");
        return;
      }
      log && log(`FormEntry com GridStyle detectados: ${targets.length}`);
      targets.forEach(ensureToolbar);
    }

    const detach = attachSimpleObserver ? attachSimpleObserver(run, doc) : null;
    run();

    log && log("Exportação CSV ativa.");
  } catch (e) {
    (error || console.error)("Falha no init do export-grid:", e);
  }
}
</file>

<file path="domains/icnet/icnet-utils.js">
/*****************************************************
 * domains/icnet/icnet-utils.js
 * Utilitários específicos do domínio ICNET.
 * - Breadcrumb "lbPath" (último da página)
 * - Nome da IC a partir dos selects conhecidos
 * - Seleção de blocos/tabelas no padrão ICNET
 * - Geração de nomes de arquivo usando regras globais
 *****************************************************/

import {
    rule_sanitize_token,
    rule_join_tokens,
    rule_timestamp_token,
    rule_make_filename
} from "../../core/global-rules.js";

/**
 * Retorna o ÚLTIMO breadcrumb (#lbPath) presente no documento
 * (ICNET às vezes renderiza mais de um, ex.: iframes aninhados).
 */
export function icnet_readBreadcrumbLast(doc = document) {
    const nodes = Array.from(doc.querySelectorAll("#TbPathAndNavigation #lbPath"));
    const el = nodes.length ? nodes[nodes.length - 1] : null;
    const raw = el ? (el.textContent || "").trim() : "";
    return { raw, el };
}

/** Converte o breadcrumb do ICNET para um token seguro (minúsculo/sem acento/espaço). */
export function icnet_breadcrumb_token(doc = document) {
    const { raw } = icnet_readBreadcrumbLast(doc);
    return rule_sanitize_token(raw) || "grid";
}

/**
 * Obtém o nome da IC (JURISCONS, etc.) a partir dos selects conhecidos no ICNET
 * e devolve já tokenizado. Fallback: "ic".
 */
export function icnet_ic_token(doc = document) {
    const sel =
        doc.querySelector("#navbarIC select") ||
        doc.querySelector("#ddList_ICs") ||
        doc.querySelector('select[name="ddList_ICs"]');

    if (sel && sel.options && sel.selectedIndex >= 0) {
        const txt = sel.options[sel.selectedIndex].text || sel.value || "";
        const v = (txt || "").trim();
        if (v) return rule_sanitize_token(v);
    }
    return "ic";
}

/**
 * Encontra os containers FormEntry que possuam GridStyle (padrão ICNET).
 * Observação: esse seletor é específico do ICNET.
 */
export function icnet_findFormEntriesWithGrid(doc = document) {
    const entries = Array.from(doc.querySelectorAll("div.FormEntry"));
    return entries.filter((entry) => entry.querySelector("table.GridStyle"));
}

/**
 * Gera um nome de arquivo padronizado para ICNET:
 * icnet-<ic>-<breadcrumb>-<timestamp>.<ext>
 */
export function icnet_make_filename(ext = "csv", doc = document, now = new Date()) {
    const ic = icnet_ic_token(doc);
    const bc = icnet_breadcrumb_token(doc);
    return rule_make_filename(["icnet", ic, bc], ext, now);
}

// (re-export) Conveniência para módulos do icnet:
export {
    rule_sanitize_token,
    rule_join_tokens,
    rule_timestamp_token,
    rule_make_filename
} from "../../core/global-rules.js";
</file>

<file path="domains/icnet/styles.css">
/* domains/icnet/styles.css */
/* CSS mínimo para complementar Bootstrap (mantendo visual clean) */
.cosmoware-toolbar {
  background: #fff;
}
.cosmoware-toolbar .cosmoware-btn i {
  margin-right: 6px;
}
/* Opcional: ajuste de espaçamento entre elementos quando Bootstrap não resolver */
.cosmoware-toolbar .gap-2 > * + * {
  margin-left: .5rem;
}
</file>

<file path="scripts/build-zip.sh">
#!/usr/bin/env bash
set -euo pipefail

# Requisitos: jq, zip
command -v jq >/dev/null || { echo "jq não encontrado. Instale e rode novamente."; exit 1; }
command -v zip >/dev/null || { echo "zip não encontrado. Instale e rode novamente."; exit 1; }

# Lê versão do manifest.json
VERSION="$(jq -r '.version' manifest.json)"
if [[ -z "${VERSION}" || "${VERSION}" == "null" ]]; then
  echo "Não foi possível ler .version do manifest.json"
  exit 1
fi

NAME="cosmoware-extension-v${VERSION}"
OUT_DIR="dist"
OUT_ZIP="${OUT_DIR}/${NAME}.zip"
OUT_SHA="${OUT_ZIP}.sha256"

# Limpa e recria dist/
rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}/pkg"

# Lista de inclusões (ajuste se necessário)
INCLUDE=(
  "manifest.json"
  "core"
  "domains"
  "templates"
  "icons"
  # "README.md"   # descomente se quiser incluir
  # "LICENSE"     # descomente se quiser incluir
)

# Verificações mínimas
[[ -f manifest.json ]] || { echo "manifest.json ausente"; exit 1; }
[[ -d core ]] || { echo "core/ ausente"; exit 1; }
[[ -d domains ]] || { echo "domains/ ausente"; exit 1; }

# Copia
for p in "${INCLUDE[@]}"; do
  if [ -e "$p" ]; then
    cp -R "$p" "${OUT_DIR}/pkg/"
  fi
done

# Remoções defensivas (dentro do pacote)
find "${OUT_DIR}/pkg" -name "*.map" -delete || true
find "${OUT_DIR}/pkg" -name ".DS_Store" -delete || true
find "${OUT_DIR}/pkg" -name "node_modules" -type d -prune -exec rm -rf {} + || true
find "${OUT_DIR}/pkg" -name ".git" -type d -prune -exec rm -rf {} + || true
find "${OUT_DIR}/pkg" -name "tests" -type d -prune -exec rm -rf {} + || true

# Compacta
( cd "${OUT_DIR}/pkg" && zip -r "../${NAME}.zip" . )

# Checksum
( cd "${OUT_DIR}" && sha256sum "${NAME}.zip" | awk '{print $1}' > "${NAME}.zip.sha256" )

echo "OK: ${OUT_ZIP}"
echo "SHA256: $(cat "${OUT_SHA}")"
</file>

<file path="templates/module-template.js">
export async function init(ctx) { console.log('Template de módulo CosmoWare'); }
</file>

<file path=".repomixignore">
# diretórios
.git/
node_modules/
dist/
build/

# binários/artefatos
*.png
*.jpg
*.jpeg
*.gif
*.webp
*.zip
*.pdf
*.min.*

# SO / logs
.DS_Store
*.log
</file>

<file path="CODE_OF_CONDUCT.md">
# Código de Conduta — CosmoWare

Diretrizes de convivência.
</file>

<file path="CONTRIBUTING.md">
# Contributing to CosmoWare

Fluxo de contribuição e boas práticas.
</file>

<file path="SECURITY.md">
# SECURITY

Políticas de segurança e privacidade.
</file>

<file path="SUBDOMAINS.md">
# Domains

# ICnet

URL: http://icnet.conscienciologia.org.br



# Docs

URL: https://docs.conscienciologia.org.br/
</file>

<file path=".github/workflows/repomix.yml">
name: RepoMix

on:
  push:
    branches: [ "main" ]
  workflow_dispatch:

jobs:
  build-repomix:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Generate RepoMix
        run: |
          npx --yes repomix --output REPOMIX.md

      - name: Commit & Push RepoMix output
        run: |
          if [[ -n "$(git status --porcelain)" ]]; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add REPOMIX.md
            git commit -m "chore(repomix): update REPOMIX.md"
            git push
          else
            echo "No changes to commit."
          fi
</file>

<file path="core/utils.js">
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
</file>

<file path="domains/icnet/pessoa-fisica/voluntario/organograma-voluntarios.js">
// domains/icnet/pessoa-fisica/voluntario/organograma-voluntarios.js
// CosmoWare — ICNET | WBS de Voluntários (PlantUML via Kroki)
// Requisitos: usar apenas ctx.utils (nsLogger, normalizeText, readBreadcrumb, krokiPlantUmlToPng, krokiPlantUmlToSvg, timeStampCompact)
// Breadcrumb alvo: "Pessoa Física » Voluntário"
// Idempotência de UI, logs [ICNET/PF-VOL], compatível com iframes, classes/IDs prefixo cosmoware-.

export async function init(ctx) {
  const {
    nsLogger,
    normalizeText,
    readBreadcrumb,
    krokiPlantUmlToPng,
    krokiPlantUmlToSvg,
    timeStampCompact,
  } = ctx.utils || {};

  // Logger no padrão do main.js
  const { log, warn } = nsLogger?.("[ICNET/PF-VOL]") || {
    log: (...a) => console.log("[ICNET/PF-VOL]", ...a),
    warn: (...a) => console.warn("[ICNET/PF-VOL]", ...a),
  };
  const ns = log;
  const err = (...a) => console.error("[ICNET/PF-VOL]", ...a);

  // =========================
  // Persistência do formato
  // =========================
  const LS_KEY = "cosmoware_pfvol_prefs_v1";
  function loadPrefs() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const base = { fmt: "png" }; // fmt = png|svg
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      return { ...base, ...parsed };
    } catch {
      return { fmt: "png" };
    }
  }
  function savePrefs(prefs) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    } catch (e) {
      warn("falha ao salvar prefs:", e);
    }
  }
  let PREFS = loadPrefs();

  try {
    ns("init: módulo carregado");

    // 1) Validação de breadcrumb (somente atua nesta tela)
    const bcObj = readBreadcrumb?.(document) || { raw: "", norm: "" };
    const alvo = normalizeText?.("Pessoa Física » Voluntário");
    const bcOk = bcObj.norm === alvo;
    ns("breadcrumb:", bcObj.raw, "=> ok?", bcOk);
    if (!bcOk) {
      warn("breadcrumb não confere — abortando.");
      return;
    }

    // 2) Seleciona a tabela alvo
    const grid = document.querySelector("#Grid1");
    if (!grid) {
      warn("tabela #Grid1 não encontrada — abortando.");
      return;
    }

    // 3) Toolbar idempotente (antes da tabela), botões todos à ESQUERDA
    const TOOLBAR_ID = "cosmoware-pf-vol-toolbar";
    let toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = TOOLBAR_ID;
      toolbar.className = "cosmoware-toolbar cosmoware-pf-vol-toolbar";
      Object.assign(toolbar.style, {
        display: "flex",
        gap: "10px",
        alignItems: "center",
        margin: "8px 0",
        padding: "6px 8px",
        border: "1px solid #ddd",
        borderRadius: "6px",
        background: "#fafafa",
        fontSize: "12px",
        justifyContent: "flex-start", // tudo alinhado à esquerda
        flexWrap: "wrap",
      });

      // Botão GERAR (único gatilho de geração)
      const btnGenerate = document.createElement("button");
      btnGenerate.type = "button";
      btnGenerate.className = "cosmoware-btn cosmoware-btn-generate";
      btnGenerate.textContent = "🖼️  Gerar Imagem";
      Object.assign(btnGenerate.style, {
        cursor: "pointer",
        fontWeight: 600,
      });

      // Label "Formato" + select PNG/SVG (persistente)
      const labelFmt = document.createElement("label");
      labelFmt.className = "cosmoware-select-label";
      Object.assign(labelFmt.style, {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
      });

      const spanFmt = document.createElement("span");
      spanFmt.textContent = "Formato:";

      const selectFmt = document.createElement("select");
      selectFmt.id = "cosmoware-select-fmt";
      ["png", "svg"].forEach((fmt) => {
        const opt = document.createElement("option");
        opt.value = fmt;
        opt.textContent = fmt.toUpperCase();
        if (fmt === PREFS.fmt) opt.selected = true;
        selectFmt.appendChild(opt);
      });
      selectFmt.addEventListener("change", () => {
        PREFS.fmt = selectFmt.value;
        savePrefs(PREFS);
      });

      labelFmt.appendChild(spanFmt);
      labelFmt.appendChild(selectFmt);

      // Link de download (inicialmente desabilitado)
      const btnDownload = document.createElement("a");
      btnDownload.className = "cosmoware-btn cosmoware-btn-download";
      btnDownload.textContent = "Baixar imagem";
      btnDownload.href = "javascript:void(0)";
      btnDownload.setAttribute("aria-disabled", "true");
      btnDownload.style.pointerEvents = "none";
      btnDownload.style.opacity = "0.5";

      // Status discreto
      const status = document.createElement("span");
      status.className = "cosmoware-status";
      status.textContent = "— pronto";
      status.style.opacity = "0.7";

      // Ordem: Gerar, Formato, Baixar, Status (todos à esquerda)
      toolbar.appendChild(btnGenerate);
      toolbar.appendChild(labelFmt);
      toolbar.appendChild(btnDownload);
      toolbar.appendChild(status);

      grid.parentElement?.insertBefore(toolbar, grid);

      // Área de preview (idempotente)
      const PREVIEW_ID = "cosmoware-pf-vol-preview";
      if (!document.getElementById(PREVIEW_ID)) {
        const preview = document.createElement("div");
        preview.id = PREVIEW_ID;
        preview.className = "cosmoware-preview cosmoware-pf-vol-preview";
        Object.assign(preview.style, { margin: "6px 0 10px" });

        const img = document.createElement("img");
        img.className = "cosmoware-preview-img";
        img.alt = "Organograma (WBS)";
        Object.assign(img.style, {
          maxWidth: "100%",
          border: "1px solid #eee",
          borderRadius: "4px",
          background: "#fff",
        });

        preview.appendChild(img);
        toolbar.parentElement?.insertBefore(preview, toolbar.nextSibling);
      }

      // Ação de gerar (único ponto que chama Kroki)
      btnGenerate.addEventListener("click", () => {
        generateOnce().catch((e) => err("geração via botão falhou:", e));
      });

      ns("toolbar inserida com sucesso (idempotente).");
    } else {
      ns("toolbar já presente — mantendo idempotência.");
    }

    // ======== Funções internas ========

    function extractVolunteers() {
      const rows = Array.from(grid.querySelectorAll("tr")).filter(
        (tr) =>
          !tr.classList.contains("GridHeaderStyle") &&
          !tr.classList.contains("GridPagerStyle")
      );

      const textPreservandoCase = (td) =>
        String(td?.innerText ?? "").replace(/\s+/g, " ").trim();

      const items = [];
      for (const tr of rows) {
        const tds = Array.from(tr.querySelectorAll("td"));
        if (tds.length < 8) continue;

        // Colunas conforme amostra: Nome, PF, Ativo (checkbox), Unidade, OrgDepto, Função, DataInicio, DataSaida
        const nome = textPreservandoCase(tds[0]);
        const pf = textPreservandoCase(tds[1]);
        const ativoEl = tr.querySelector('input[type="checkbox"]');
        const ativoMarcado = Boolean(ativoEl?.checked);
        const unidade = textPreservandoCase(tds[3]);   // reservado para futuros filtros
        const orgDepto = textPreservandoCase(tds[4]);
        const funcao = textPreservandoCase(tds[5]);
        const dataInicio = textPreservandoCase(tds[6]);
        const dataSaida = textPreservandoCase(tds[7]);

        // Regra de ativo: checkbox marcado E sem DataSaida
        const inativoPorSaida = dataSaida && dataSaida.trim().length > 0;
        const ativo = ativoMarcado && !inativoPorSaida;

        items.push({ nome, pf, ativo, unidade, orgDepto, funcao, dataInicio, dataSaida });
      }
      return items;
    }

    // Monta WBS com árvore por OrgDepto (split "\") + estilos de estereótipo
    function buildPlantUml(vols) {
      const esc = (s) => (s || "").trim();

      // Constrói árvore
      const root = { name: "Voluntários", children: [], volunteers: [] };
      for (const v of vols) {
        const path = (v.orgDepto || "—").split("\\").map((p) => esc(p));
        let node = root;
        for (const part of path) {
          let child = node.children.find((c) => c.name === part);
          if (!child) {
            child = { name: part, children: [], volunteers: [] };
            node.children.push(child);
          }
          node = child;
        }
        node.volunteers.push(v);
      }

      // Raiz condicional: só usa "Voluntários" se houver múltiplos topos
      const onlyOneRoot = root.volunteers.length === 0 && root.children.length === 1;

      const lines = [];
      lines.push("@startwbs");

      // Bloco de estilos (.ativo / .inativo)
      lines.push("<style>");
      lines.push("wbsDiagram {");
      lines.push("  .ativo {");
      lines.push("    BackgroundColor PaleGreen");
      lines.push("  }");
      lines.push("  .inativo {");
      lines.push("    BackgroundColor LightGray");
      lines.push("  }");
      lines.push("}");
      lines.push("</style>");

      // Render recursivo
      function renderNode(node, prefix) {
        lines.push(`${prefix} ${node.name}`);

        // Subnós ordenados
        for (const child of node.children.sort((a, b) => a.name.localeCompare(b.name))) {
          renderNode(child, prefix + "*");
        }

        // Voluntários ordenados
        for (const v of node.volunteers.sort((a, b) => a.nome.localeCompare(b.nome))) {
          const stereo = v.ativo ? "ativo" : "inativo";
          const label = `${esc(v.nome)} (${esc(v.funcao) || "—"})`;
          lines.push(`${prefix}* ${label} <<${stereo}>>`);
        }
      }

      if (onlyOneRoot) {
        renderNode(root.children[0], "*");
      } else {
        renderNode(root, "*");
      }

      lines.push("@endwbs");
      return lines.join("\n");
    }

    // Geração sob demanda (único ponto que chama Kroki)
    async function generateOnce() {
      const statusEl = document.querySelector("#" + TOOLBAR_ID + " .cosmoware-status");
      const previewImg = document.querySelector("#cosmoware-pf-vol-preview .cosmoware-preview-img");
      const downloadA = document.querySelector("#" + TOOLBAR_ID + " .cosmoware-btn-download");

      try {
        PREFS = loadPrefs(); // ressincroniza formato

        statusEl && (statusEl.textContent = "— coletando dados…");
        const items = extractVolunteers();
        ns(`extraídos ${items.length} voluntários (página atual da grade).`);

        statusEl && (statusEl.textContent = `— gerando PlantUML… (formato ${PREFS.fmt.toUpperCase()})`);
        const uml = buildPlantUml(items);

        // Inspeção no console
        ns("=== PlantUML WBS gerado ===\n" + uml + "\n=== fim PlantUML ===");

        statusEl && (statusEl.textContent = `— solicitando ${PREFS.fmt.toUpperCase()} ao Kroki…`);

        let blob, url;
        if (PREFS.fmt === "svg" && typeof krokiPlantUmlToSvg === "function") {
          const svgData = await krokiPlantUmlToSvg(uml);
          ns("SVG recebido do Kroki.");
          if (svgData instanceof Blob) {
            blob = svgData;
          } else if (svgData instanceof ArrayBuffer || ArrayBuffer.isView?.(svgData)) {
            const ab = svgData instanceof ArrayBuffer ? svgData : svgData.buffer;
            blob = new Blob([ab], { type: "image/svg+xml" });
          } else if (typeof svgData === "string") {
            url = svgData;
          }
        } else {
          if (PREFS.fmt === "svg") warn("krokiPlantUmlToSvg indisponível — usando PNG como fallback.");
          const pngData = await krokiPlantUmlToPng?.(uml);
          ns("PNG recebido do Kroki.");
          if (pngData instanceof Blob) {
            blob = pngData;
          } else if (pngData instanceof ArrayBuffer || ArrayBuffer.isView?.(pngData)) {
            const ab = pngData instanceof ArrayBuffer ? pngData : pngData.buffer;
            blob = new Blob([ab], { type: "image/png" });
          } else if (typeof pngData === "string") {
            url = pngData;
          }
        }

        if (!url && blob) {
          url = URL.createObjectURL(blob);
        }

        if (previewImg && url) {
          previewImg.src = url;
        }

        const ext = PREFS.fmt === "svg" && typeof krokiPlantUmlToSvg === "function" ? "svg" : "png";
        const fname = `ICNET-voluntarios-${timeStampCompact?.() || Date.now()}.${ext}`;

        if (downloadA) {
          if (url) {
            downloadA.href = url;
            downloadA.removeAttribute("aria-disabled");
            downloadA.style.pointerEvents = "";
            downloadA.style.opacity = "";
          }
          downloadA.setAttribute("download", fname);
        }

        statusEl && (statusEl.textContent = "— pronto ✓");
        ns("organograma renderizado com sucesso.");
      } catch (e) {
        statusEl && (statusEl.textContent = "— erro");
        err("falha ao gerar organograma:", e);
      }
    }
  } catch (e) {
    err("erro inesperado no init:", e);
  }
}
</file>

<file path=".gitignore">
# CosmoWare — sensible defaults for a Chrome Extension repo
# ----------------------------------------------------------------------------
# OS / Filesystem
.DS_Store
Thumbs.db

# Editors / IDE
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
!.vscode/tasks.json
.idea/
*.swp
*.swo

# Node & package managers
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
.pnpm-debug.log*
.eslintcache
.stylelintcache

# Lockfiles:
# 👉 Recommended: commit exactly one lockfile (npm, yarn or pnpm).
#    If you intentionally don't use a lockfile, uncomment the line below.
# package-lock.json
# yarn.lock
# pnpm-lock.yaml

# Builds / Artifacts
dist/
build/
coverage/
*.coverage
*.lcov

# Bundlers / Caches
.parcel-cache/
.rollup.cache/
.esbuild/
.turbo/
.cache/
webpack-stats.json
.next/
.nuxt/
.svelte-kit/

# Chrome Extension packaging
*.crx
*.pem            # private key generated when packing locally
*.zip            # release zips are attached in GitHub Releases, not committed

# Environment / secrets
.env
.env.*
!.env.example

# Temporary files
tmp/
*.tmp
*.bak
*.orig
*.rej

# Logs
*.log
logs/
npm-debug.*
yarn-debug.*
yarn-error.*

# RepoMix (keep REPOMIX.md tracked; ignore only the output file)
repomix-output.xml

# OS-specific trash
*.Trash
ehthumbs.db
Icon?
</file>

<file path=".repomixrc.json">
{
  "$schema": "https://repomix.com/schema.json",
  "output": {
    "file": "REPOMIX.md",
    "includeTimestamps": true,
    "title": "CosmoWare — Repository Context"
  },
  "include": [
    "manifest.json",
    "core/**/*",
    "domains/**/*",
    "templates/**/*",
    "README.md",
    "ARCHITECTURE.md",
    "DEVELOPMENT.md",
    "CONTRIBUTING.md",
    "AI_GUIDE.md",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    ".github/ISSUE_TEMPLATE/**/*",
    ".github/PULL_REQUEST_TEMPLATE.md"
  ],
  "exclude": [
    "node_modules/**/*",
    ".git/**/*",
    "**/*.png",
    "**/*.jpg",
    "**/*.jpeg",
    "**/*.gif",
    "**/*.webp",
    "**/*.zip",
    "**/*.min.*",
    "**/dist/**/*",
    "**/build/**/*",
    "**/.DS_Store",
    "**/*.log"
  ],
  "truncate": {
    "maxFileSizeKB": 256,
    "strategy": "tail"
  },
  "decorators": {
    "showFileHeader": true,
    "showTOC": true,
    "codeFence": true
  }
}
</file>

<file path="ARCHITECTURE.md">
# ARCHITECTURE

## Visão Geral

CosmoWare é uma extensão **modular** para Chrome (Manifest V3) que atua em páginas específicas dos sistemas da Conscienciologia (`*.conscienciologia.org.br`).  

Fluxo principal:
1. **`core/content.js`**: carregado em todos os frames.  
   - Detecta o domínio (ex.: `icnet.conscienciologia.org.br`).  
   - Encaminha para o **roteador de domínio**.

2. **`domains/<domínio>/main.js`**: router por domínio.  
   - Lê breadcrumb/URL da página (cada domínio tem regra própria).  
   - Identifica a rota correspondente.  
   - Carrega dinamicamente o módulo da feature.

3. **`domains/<domínio>/<rota>/<feature>.js`**: módulo da funcionalidade.  
   - Exporta apenas `init(ctx)`.  
   - Deve ser idempotente (não duplicar UI).  
   - Contém toda a lógica daquela tela.

---

## Filosofia de Modularização

- **Primeiro nível:** domínio (ex.: `icnet/`).  
- **Segundo nível:** caminho da rota (ex.: `administrador/configuracao-ic/`).  
- **Arquivo final:** a feature da tela (ex.: `organograma.js`).  

Cada feature é **independente** e pode ser criada ou evoluída isoladamente, inclusive com ajuda de IA.

---

## Contrato do Módulo

Todo módulo deve exportar uma função assíncrona `init(ctx)`:

```js
export async function init(ctx) {
  const { utils, doc, href, host } = ctx;
  const { nsLogger } = utils;
  const { log } = nsLogger("[ICNET/FEATURE]");

  if (window.__my_feature_loaded) return;
  window.__my_feature_loaded = true;

  // verificação de breadcrumb ou URL aqui...
  log("Feature iniciada!");
}
```

### `ctx` contém:
- `doc`: documento do frame atual.  
- `href`, `host`: informações do frame.  
- `utils`: conjunto de utilidades globais (`nsLogger`, `attachSimpleObserver`, `krokiPlantUmlToPng`, etc.).

---

## Utilitários Globais (`core/`)

- **`utils.js`**: logger, normalização de texto, `readBreadcrumb`, timestamps, Kroki (PlantUML), observer de DOM.  
- **`global-rules.js`**: regras de padronização independentes de domínio:
  - `rule_sanitize_token(s)` → minúsculo, sem acentos, `_` como separador.  
  - `rule_join_tokens(parts)` → une tokens normalizados.  
  - `rule_timestamp_token(d)` → `yyyymmdd-hhmmss`.  
  - `rule_make_filename(parts, ext, d)` → `tokens-timestamp.ext`.

Essas funções garantem que nomes de arquivos gerados sejam **consistentes** em todos os módulos.

---

## Utilitários por Domínio (`domains/<domínio>/*-utils.js`)

Exemplo ICNET (`domains/icnet/icnet-utils.js`):
- `icnet_readBreadcrumbLast(doc)` → último breadcrumb `#TbPathAndNavigation #lbPath`.  
- `icnet_breadcrumb_token(doc)` → breadcrumb normalizado (via regras globais).  
- `icnet_ic_token(doc)` → IC atual (ex.: `JURISCONS`).  
- `icnet_findFormEntriesWithGrid(doc)` → `div.FormEntry` com `table.GridStyle`.  
- `icnet_make_filename(ext, doc, d)` → `icnet-<ic>-<breadcrumb>-<timestamp>.<ext>`.

Cada domínio define os seus utilitários conforme sua estrutura de HTML.

---

## Padrão de Router por Domínio

Exemplo simplificado:

```js
const routes = [
  {
    name: "administrador/configuracao-ic/organograma",
    match: (ctx) => ctx.utils.readBreadcrumb(ctx.doc).norm.includes("organograma"),
    loader: () => import(chrome.runtime.getURL(
      "domains/icnet/administrador/configuracao-ic/organograma.js"
    )),
  },
  {
    name: "shared/export-grid",
    match: () => true, // export-grid roda em qualquer FormEntry/GridStyle
    loader: () => import(chrome.runtime.getURL(
      "domains/icnet/shared/export-grid.js"
    )),
  },
];
```

O router percorre todas as rotas, chama `match(ctx)` e importa módulos que retornarem `true`.

---

## Toolbar Compartilhada

- Módulos podem inserir uma **toolbar** acima de `FormEntry` (ICNET).  
- Se já existir toolbar nativa (ex.: Organograma), os botões são anexados nela.  
- **Idempotência:** marcar `data-cosmoware-toolbar="1"`.  
- **Visual:** usar classes Bootstrap já carregadas; ícones Font Awesome 5.0.7 presentes no ICNET.  
- **Fallback:** se FA não aplicar no frame, usar emoji.

---

## Exportação CSV (ICNET)

Implementação atual:
- Escopo: `div.FormEntry > table.GridStyle`.  
- Assumimos **sem colspan**.  
- Exporta:
  - Cabeçalhos `<th>`,  
  - Dados `<td>`,  
  - Checkbox → `true/false`,  
  - Links `<a>` → texto visível.  
- Formato: UTF-8 **BOM**, **CRLF** (Excel-friendly).  
- Nome do arquivo:  
  `icnet-<ic>-<breadcrumb>-<yyyymmdd-hhmmss>.csv`  
  (sempre minúsculo, sem acentos, sem espaços).  
- Não exporta outras páginas (sem paginação incremental).  
- Apenas uma tabela por FormEntry.

---

## Boas Práticas

- **Chrome Web Store compliance**:
  - Sem injeção de CSS/JS externos.  
  - Usar libs já carregadas na página.  
  - Não logar dados pessoais.  
- **Idempotência**: guards globais (`window.__feature_booted`) + marcações no DOM.  
- **Logs consistentes**: use `nsLogger` sempre.  
- **Módulos pequenos e isolados**: uma tela, uma responsabilidade.  
- **Facilitar colaboração IA**: código previsível, convenções estáveis.  

---

## Extensão para Novos Domínios

Para suportar outro subdomínio:
1. Criar `domains/<novo>/main.js`.  
2. Criar `domains/<novo>/<novo>-utils.js` (breadcrumb, seletores locais).  
3. Reaproveitar `core/global-rules.js` para nomes/tokens.  
4. Implementar módulos `init(ctx)` seguindo o padrão.

Essa arquitetura garante **regras globais consistentes** e **especialização local por domínio**, favorecendo evolução incremental e contribuição assistida por IA.
</file>

<file path="package.json">
{
  "scripts": {
    "repomix": "repomix --output REPOMIX.md"
  },
  "devDependencies": {
  }
}
</file>

<file path="domains/icnet/main.js">
/*****************************************************
 * domains/icnet/main.js – Router do domínio ICNET
 * Decide quais módulos de tela carregar (por breadcrumb/URL)
 * Agora carrega TODAS as rotas que casarem, uma única vez por frame.
 * Logs: [ICNET/MAIN]
 *****************************************************/

const __loadedRoutes = new Set(); // controla rotas já carregadas neste frame

export async function init(context) {
  const { utils } = context;
  const { nsLogger, normalizeText, readBreadcrumb, attachSimpleObserver } = utils || {};
  const { log, warn, error } = (nsLogger ? nsLogger("[ICNET/MAIN]") : console);

  // Boot-guard por frame (evita reinicialização do router)
  if (window.__cosmoware_icnet_main_booted) {
    log && log("Router já bootado neste frame — ignorando re-run.");
    return;
  }
  window.__cosmoware_icnet_main_booted = true;

  // Rotas do domínio icnet
  // match(ctx) → boolean, loader() → Promise<module>
  const routes = [
    {
      name: "administrador/configuracao-ic/organograma",
      match: (ctx) => {
        try {
          const { norm } = readBreadcrumb(ctx.doc);
          const alvo = normalizeText("Administrador » Configuração IC » Organograma");
          const hintUrl = /[?&#](f|functionkey)=1028\b/i.test(ctx.href); // heurística adicional
          return (norm && norm.includes(alvo)) || hintUrl;
        } catch {
          return false;
        }
      },
      loader: () =>
        import(chrome.runtime.getURL(
          "domains/icnet/administrador/configuracao-ic/organograma.js"
        ))
    },
    {
      // Pessoa Física » Voluntário — Organograma de Voluntários
      name: "pessoa-fisica/voluntario/organograma-voluntarios",
      match: (ctx) => {
        try {
          const { norm } = readBreadcrumb(ctx.doc);
          const alvo = normalizeText("Pessoa Física » Voluntário");
          const hintUrl = /[?&#](f|functionkey)=29\b/i.test(ctx.href); // heurística adicional
          return (norm && norm.includes(alvo)) || hintUrl;
        } catch {
          return false;
        }
      },
      loader: () =>
        import(chrome.runtime.getURL(
          "domains/icnet/pessoa-fisica/voluntario/organograma-voluntarios.js"
        ))
    },
    {
      // Módulo genérico: toolbar/Exportar CSV para FormEntry com GridStyle
      name: "shared/export-grid",
      match: (ctx) => {
        const doc = ctx.doc;
        return !!doc && !!doc.querySelector("div.FormEntry table.GridStyle");
      },
      loader: () =>
        import(chrome.runtime.getURL(
          "domains/icnet/shared/export-grid.js"
        ))
    },
    // Adicione novas rotas aqui no futuro…
  ];

  log && log("Boot router icnet: avaliando rotas...");

  // Processa todas as rotas que casarem; cada uma inicializa no máximo 1x por frame
  async function processRoutes() {
    for (const route of routes) {
      let ok = false;
      try {
        ok = !!route.match?.(context);
      } catch (e) {
        (warn || console.warn)(`Falha ao avaliar match da rota ${route.name}:`, e);
        ok = false;
      }

      log && log(`Rota detectada: ${route.name} | match=${ok}`);

      if (!ok) continue;
      if (__loadedRoutes.has(route.name)) {
        log && log(`Rota ${route.name} já carregada neste frame — pulando.`);
        continue;
      }

      try {
        const mod = await route.loader();
        if (typeof mod?.init !== "function") {
          warn && warn(`Módulo ${route.name} não exporta init() — nada a fazer.`);
          __loadedRoutes.add(route.name); // evita tentar de novo
          continue;
        }
        await mod.init({ ...context, utils });
        __loadedRoutes.add(route.name);
        log && log(`Módulo ${route.name} inicializado.`);
      } catch (e) {
        (error || console.error)(`Falha ao carregar/inicializar rota ${route.name}:`, e);
      }
    }
  }

  // Observa mutações da página (SPA/iframe) para tentar novas rotas que passem a casar
  const detach = attachSimpleObserver ? attachSimpleObserver(processRoutes, context.doc) : null;

  // Primeira tentativa imediata
  processRoutes();

  log && log("Router icnet: processamento inicial concluído.");
  // (Opcional) cleanup: window.addEventListener("beforeunload", detach);
}
</file>

<file path=".gitattributes">
# CosmoWare .gitattributes — tuned for VS Code on WSL (Windows + Linux)
# Enforce consistent EOLs across devs and CI.
# Default everything to LF; explicitly allow CRLF for Windows-only scripts.
# ----------------------------------------------------------------------------

# Auto-normalize text; always checkout with LF by default
* text=auto eol=lf

# --- OS-specific scripts
*.sh   text eol=lf
*.bash text eol=lf
*.zsh  text eol=lf
*.cmd  text eol=crlf
*.bat  text eol=crlf
*.ps1  text eol=crlf

# --- Source files / configs (force LF)
*.js    text eol=lf
*.mjs   text eol=lf
*.cjs   text eol=lf
*.ts    text eol=lf
*.tsx   text eol=lf
*.jsx   text eol=lf
*.css   text eol=lf
*.scss  text eol=lf
*.html  text eol=lf
*.htm   text eol=lf
*.json  text eol=lf
*.jsonc text eol=lf
*.yml   text eol=lf
*.yaml  text eol=lf
*.md    text eol=lf
*.mdx   text eol=lf
*.svg   text eol=lf
.editorconfig    text eol=lf
.gitattributes   text eol=lf
.gitignore       text eol=lf

# --- Binary assets (never modify line endings)
*.png  binary
*.jpg  binary
*.jpeg binary
*.gif  binary
*.webp binary
*.avif binary
*.ico  binary
*.bmp  binary
*.pdf  binary
*.zip  binary
*.tar  binary
*.gz   binary
*.tgz  binary
*.bz2  binary
*.7z   binary
*.rar  binary
*.mp4  binary
*.mov  binary
*.webm binary
*.wav  binary
*.mp3  binary
*.ogg  binary
*.flac binary
*.woff  binary
*.woff2 binary
*.ttf   binary
*.otf   binary
*.eot   binary
*.crx   binary
*.pem   binary

# --- GitHub Linguist hints (repository language stats / code vs docs)
doc/**         linguist-documentation
docs/**        linguist-documentation
dist/**        linguist-generated
build/**       linguist-generated
repomix-output.xml linguist-generated

# --- Release tarball hygiene (git archive)
.github/**     export-ignore
.vscode/**     export-ignore
tests/**       export-ignore
test/**        export-ignore
scripts/**     export-ignore

# Notes:
# - VS Code on Windows may still display CRLF by default. Set `"files.eol": "\n"`
#   in .vscode/settings.json to keep LF in your editor as well.
# - Lockfiles: we keep defaults (no custom merge strategy) to avoid broken installs.
</file>

<file path="DEVELOPMENT.md">
# Desenvolvimento — CosmoWare

Este documento é o guia prático para contribuir no desenvolvimento do CosmoWare.

---

## 1) Pré-requisitos

- Navegador baseado em Chromium (Chrome/Brave)
- Git instalado
- (Opcional) Node.js 18+ se quiser rodar ferramentas auxiliares (ex.: repomix)

---

## 2) Instalação local

1. Clone o repositório:
   ```bash
   git clone https://github.com/conscienciologia/CosmoWare
   ```

2. Abra `chrome://extensions` no navegador.

3. Ative o **Modo desenvolvedor**.

4. Clique em **Carregar sem compactação (Load unpacked)** e escolha a pasta do projeto.

---

## 3) Arquitetura (resumo prático)

- `core/content.js` → roteador principal de domínios
- `domains/<subdomínio>/main.js` → roteador de telas de um domínio
- `domains/<subdomínio>/<rota>/<feature>.js` → módulo independente que exporta `init(ctx)`
- `ctx.utils`: utilitários comuns (logger, breadcrumb, kroki, observer, timestamp…)

---

## 4) Rodando e depurando

1. Abra a tela alvo no navegador.  
2. Abra o console (`F12`) e verifique os logs.  
   - Logs seguem padrão: `[CT-CORE]`, `[ICNET/MAIN]`, `[ICNET/<FEATURE>]`.  
3. Recarregue a extensão e a página sempre que modificar arquivos.  

---

## 5) Criando uma nova funcionalidade

### Passos

1. Crie um novo arquivo em `domains/<subdomínio>/<rota>/<nome>.js`.
2. Registre a rota em `domains/<subdomínio>/main.js`.
3. Implemente `export async function init(ctx) { … }`.

### Boas práticas

- Validar breadcrumb/URL antes de atuar.
- Garantir **idempotência** (não duplicar UI).
- Usar apenas `ctx.utils`.
- Manter logs claros e com namespace fixo.
- Aproveitar a barra de ferramentas para adicionar botoes quando no icnet
- Desenvolvimento incremental, certifica-se que uma versão com logs esteja funcionando, que os requisitos estão corretos e depois implementa a funcionalidade.
- Inserir UI discreta, sem interferir em outras telas.

### Template mínimo

```js
// domains/<subdomínio>/<rota>/<feature>.js
export async function init(ctx) {
  const { utils, doc } = ctx;
  const { nsLogger, readBreadcrumb, attachSimpleObserver } = utils;
  const { log } = nsLogger("[ICNET/MINHA-FEATURE]");

  if (window.__minha_feature_loaded) return;
  window.__minha_feature_loaded = true;

  function isRightPage() {
    const { norm } = readBreadcrumb(doc);
    return norm.includes("administrador » configuração ic » organograma");
  }

  async function run() {
    if (!isRightPage()) return;
    log("Ativada com sucesso.");
  }

  const detach = attachSimpleObserver(run, doc);
  run();
}
```

### Registro da rota

```js
// domains/icnet/main.js
const routes = [
  {
    name: "administrador/configuracao-ic/organograma",
    match: (ctx) => {
      const { norm } = ctx.utils.readBreadcrumb(ctx.doc);
      return norm.includes("administrador » configuração ic » organograma");
    },
    loader: () => import(chrome.runtime.getURL(
      "domains/icnet/administrador/configuracao-ic/organograma.js"
    )),
  },
  // novas rotas aqui…
];
```

---

## 6) Padrões de código e UI

- IDs/classes iniciam com prefixo `cosmoware-`.
- Nenhuma dependência entre features.
- Logs com `nsLogger("[ICNET/NOME]")`.
- UI discreta e idempotente.

---

## 7) RepoMix no desenvolvimento

- O arquivo **`REPOMIX.md`** é gerado automaticamente pelo **CI** no repositório.  
- Use este arquivo como **contexto principal** ao trabalhar com IA.  
- Estratégia recomendada: **REPOMIX.md + Brief** da funcionalidade.  
- Se o `REPOMIX.md` for muito grande, use apenas trechos relevantes junto com o Brief.

Veja `AI_GUIDE.md` para instruções detalhadas de prompts.

---

## 8) Versionamento & Release

- Esquema: `YY.MM.DD.<timestamp-ms>` (ex.: `25.09.10.1757519311000`).  
- O CI atualiza `manifest.json` (e `package.json`, se existir), cria tag e GitHub Release.  
- `CHANGELOG.md` é atualizado automaticamente com os commits desde a última tag.  
- Workflow: `.github/workflows/release.yml`.  

---

## 9) Checklists práticos

### Nova feature
- [ ] Breadcrumb/URL conferidos  
- [ ] UI idempotente (não duplica)  
- [ ] Logs claros e namespaced  
- [ ] Usa apenas `ctx.utils`  
- [ ] Registrada em `domains/<subdomínio>/main.js`  
- [ ] Testada manualmente + prints  

### Antes do PR
- [ ] Rodou localmente e verificou console?  
- [ ] Anexou prints/GIFs?  
- [ ] Explicou objetivo/valor da mudança?  
- [ ] (Opcional) Colou o prompt usado com IA?
</file>

<file path="AI_GUIDE.md">
# AI Guide — Como usar IA para criar e manter funcionalidades do CosmoWare

> **Objetivo**: tornar o CosmoWare um projeto **IA-friendly** de ponta a ponta.  
> Este guia mostra como **planejar, gerar, revisar e manter** funcionalidades inteiras **usando IA**, a partir do `REPOMIX.md`.

---

## 1) Estratégia recomendada de uso do RepoMix

### 🔹 Estratégia Híbrida (recomendada)
- Sempre inicie colando o **`REPOMIX.md` atualizado** no chat da IA (ou forneça o link, se o modelo suportar).  
- Depois acrescente um **Brief estruturado** da funcionalidade desejada (veja abaixo).  
- Se o `REPOMIX.md` for muito grande para o modelo:
  - Use apenas os trechos mais relevantes (ex.: `core/utils.js`, `core/global-rules.js`, `domains/<domínio>/main.js`, exemplos próximos ao que você quer implementar).  
  - Sempre acrescente o Brief.  

Assim a IA entende o **contexto global** (arquitetura e convenções) e também o **objetivo específico** (Brief).

### Outras opções
- **Importar só o REPOMIX.md**: funciona bem em modelos com grande contexto.  
- **Importar só trechos específicos**: útil em prompts rápidos ou para modelos com limite menor, mas pode gerar inconsistências.  

---

## 2) Workflow IA-first

1. **Obtenha contexto**  
   - Use o `REPOMIX.md` atualizado pelo CI.  
   - Cole no chat da IA.  

2. **Escreva o Brief da funcionalidade** (template abaixo).  

3. **Conduza prompts incrementais**:  
   - Etapa 1: IA revisa o Brief, sugere ajustes e confirma entendimento.  
   - Etapa 2: IA gera versão **mínima com logs** (somente toolbar e botões, sem lógica pesada).  
   - Etapa 3: Você testa manualmente (console/logs).  
   - Etapa 4: IA adiciona funcionalidades reais (CSV, Kroki, etc.).  

4. **Teste manualmente** a extensão.  

5. **Itere com a IA** usando prompts de refino/depuração.  

6. **Abra PR** com checklist preenchido e, se possível, o prompt utilizado.  

---

## 3) Template de Brief

```
# Brief de funcionalidade (CosmoWare / IA)

## Domínio e Tela
- Domínio: icnet.conscienciologia.org.br
- Breadcrumb (não normalizado): Pessoa Física » Voluntário
- URL(s) típica(s): https://icnet.conscienciologia.org.br/main.aspx#

## Objetivo
Ex.: Exportar tabela de voluntários em CSV.

## Entradas da página (amostra real de HTML)
Cole trechos relevantes:
- Breadcrumb (#TbPathAndNavigation #lbPath)
- Div FormEntry + tabela GridStyle
- Exemplo de linhas relevantes

## Resultado Esperado
- Toolbar antes da tabela com botão: Exportar (ícone CSV)
- Exporta tabela inteira para CSV (UTF-8 BOM, CRLF)
- Nome do arquivo: icnet-<ic>-<breadcrumb>-<timestamp>.csv

## Critérios de Aceitação
- Só atua quando breadcrumb = “Pessoa Física » Voluntário”
- Não duplica UI (idempotência)
- Logs com prefixo [ICNET/EXPORT]
- Erros tratados no console de forma clara
- Compatível com iframes

## Observações
- Usar ctx.utils e regras globais (global-rules.js)
- IDs/Classes com prefixo cosmoware-
- Testar primeiro com logs, depois gerar CSV de fato
```

---

## 4) Prompt Base — Geração de Módulo

```
Você é um assistente desenvolvedor do projeto CosmoWare. 
Considere **todo o contexto em REPOMIX.md** e o seguinte **Brief** (abaixo). 
Vamos implementar de forma incremental:

1. Primeiro, confirme entendimento do Brief e sugira ajustes.  
2. Depois, gere versão mínima com logs (toolbar, botão, console.log).  
3. Após testes manuais, avance para versão completa (ex.: exportar CSV).

Regras:
- Estrutura: domains/<subdomínio>/<rota>/<nome>.js
- Use apenas ctx.utils (nsLogger, normalizeText, readBreadcrumb, attachSimpleObserver, krokiPlantUmlToPng, krokiPlantUmlToSvg, timeStampCompact, regras globais)
- Valide breadcrumb antes de atuar
- Idempotência (não duplicar UI)
- Logs com namespace fixo (ex.: [ICNET/EXPORT])
- IDs/classes com prefixo cosmoware-
```

---

## 5) Prompt Base — Registro no Router

```
Gere o snippet para registrar a rota no arquivo domains/<subdomínio>/main.js,
seguindo o padrão do projeto:

- `name`: caminho legível da tela
- `match(ctx)`: verificação do breadcrumb (use normalizeText só para comparar)
- `loader()`: import dinâmico via chrome.runtime.getURL

Inclua também checklist de testes manuais para validar a rota.
```

---

## 6) **Erros comuns e como evitar**

### nsLogger
- Sempre crie com namespace fixo: `[ICNET/FEATURE]`.

### normalizeText
- Use somente para comparações. Nunca normalize textos exibidos.

### Breadcrumbs
- Cada domínio pode ter **estrutura diferente**.  
- ICNet: use último breadcrumb (`#TbPathAndNavigation #lbPath`).  
- Outros domínios terão regras próprias (coloque em `<domínio>-utils.js`).  

### Idempotência
- Use guards globais e atributos `data-cosmoware-*`.  

### Toolbar
- Sempre discreta, idempotente, à esquerda.  
- Reaproveite libs já carregadas no frame (Bootstrap, Font Awesome).  
- Se ícones não carregarem → fallback em emoji.

### Arquivos gerados
- Sempre use `core/global-rules.js` para normalizar nomes.  
- Formato: `<domínio>-<ic>-<breadcrumb>-<timestamp>.<ext>`  
- Tokens: minúsculos, sem acentos, `_` como separador.

### CSV (ICNet)
- Escopo: apenas `div.FormEntry > table.GridStyle`.  
- Sem suporte a `colspan`.  
- Apenas uma tabela por FormEntry.  
- UTF-8 BOM + CRLF.  

---

## 7) Snippet de toolbar (mínima com logs)

```js
const bar = document.createElement("div");
bar.className = "cosmoware-toolbar";
bar.textContent = "Toolbar CosmoWare — Modo mínimo (logs)";
console.log("[ICNET/EXPORT] toolbar criada");
```

---

## 8) Checklist de Aceitação

- [ ] Atua somente na tela correta (breadcrumb igual ao alvo)  
- [ ] Não duplica UI (idempotência)  
- [ ] Logs claros e padronizados `[ICNET/... ]`  
- [ ] Usa apenas `ctx.utils`  
- [ ] Compatível com iframes  
- [ ] Arquivo em `domains/<domínio>/<rota>/<feature>.js`  
- [ ] Rota registrada em `domains/<domínio>/main.js`  
- [ ] Funciona incrementalmente (primeiro logs, depois funcionalidade completa)  
- [ ] Nome de arquivos normalizado pelas regras globais  
- [ ] Testado manualmente (console + UI)  
- [ ] Prompt usado documentado no PR  

---

## 9) Exemplos no Repositório

- `domains/icnet/shared/export-grid.js` (mínimo com logs → CSV)  
- `domains/icnet/pessoa-fisica/voluntario/organograma-voluntarios.js`  
- `domains/icnet/main.js`  
- `core/utils.js`  
- `core/global-rules.js`  
- `domains/icnet/icnet-utils.js`

> Estes arquivos estão sempre no `REPOMIX.md` e servem como exemplos.
</file>

<file path="manifest.json">
{
  "manifest_version": 3,
  "name": "Conscienciologia Tools (CosmoWare)",
  "version": "1.0.0",
  "description": "Extensão modular por domínio e por tela para *.conscienciologia.org.br",
  "permissions": [
    "scripting",
    "activeTab"
  ],
  "host_permissions": [
    "https://*.conscienciologia.org.br/*",
    "https://kroki.io/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://*.conscienciologia.org.br/*"
      ],
      "js": [
        "core/content.js"
      ],
      "run_at": "document_idle",
      "all_frames": true
    }
  ],
  "web_accessible_resources": [
    {
      "resources": [
        "core/utils.js",
        "core/global-rules.js",
        "domains/*/main.js",
        "domains/*/*.js",
        "domains/icnet/styles.css",
        "domains/icnet/shared/export-grid.js",
        "domains/icnet/icnet-utils.js",
        "domains/*/**/*.js",
        "domains/*/**/**/*.js"
      ],
      "matches": [
        "https://*.conscienciologia.org.br/*"
      ]
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
</file>

<file path=".github/workflows/release.yml">
name: Release

on:
  push:
    branches: [ "main" ]
  workflow_dispatch:

permissions:
  contents: write  # criar tags, commits e releases

jobs:
  release:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # precisamos do histórico para tag/changelog

      - name: Install tooling
        run: |
          sudo apt-get update
          sudo apt-get install -y jq zip

      - name: Compute date-based version (YY.M.D.HHMM)
        id: calc_ver
        shell: bash
        run: |
          # Year (two-digits) without leading zeros handled as integer
          Y_RAW=$(date -u +%y)
          Y=$((10#$Y_RAW))

          # Month/Day without leading zeros
          M=$(date -u +%-m)
          D=$(date -u +%-d)

          # HHMM as integer (removes any leading zero from hour/minute)
          HM_RAW=$(date -u +%H%M)   # e.g., 0210
          HM=$((10#$HM_RAW))        # e.g., 210

          VERSION="${Y}.${M}.${D}.${HM}"
          echo "version=${VERSION}" >> "$GITHUB_OUTPUT"

          # Optional human-friendly version name
          VNAME=$(date -u +'%y.%m.%d-%H:%MZ')
          echo "version_name=${VNAME}" >> "$GITHUB_OUTPUT"
          echo "Computed version: ${VERSION} (version_name=${VNAME})"

      - name: Make build script executable
        run: chmod +x scripts/build-zip.sh

      - name: Update manifest.json (if present)
        shell: bash
        run: |
          if [ -f manifest.json ]; then
            echo "Updating manifest.json to version ${{ steps.calc_ver.outputs.version }} (version_name=${{ steps.calc_ver.outputs.version_name }})"
            jq --arg v "${{ steps.calc_ver.outputs.version }}"                --arg vn "${{ steps.calc_ver.outputs.version_name }}"                '.version=$v | .version_name=$vn' manifest.json > manifest.json.tmp && mv manifest.json.tmp manifest.json
          else
            echo "manifest.json not found. Skipping."
          fi

      - name: Update package.json (if present)
        shell: bash
        run: |
          if [ -f package.json ]; then
            echo "Updating package.json to version ${{ steps.calc_ver.outputs.version }}"
            jq --arg v "${{ steps.calc_ver.outputs.version }}" '.version=$v' package.json > package.json.tmp && mv package.json.tmp package.json
          else
            echo "package.json not found. Skipping."
          fi

      - name: Commit version bumps (if any)
        shell: bash
        run: |
          if ! git diff --quiet; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add -A
            git commit -m "chore(release): v${{ steps.calc_ver.outputs.version }} [skip ci]"
          else
            echo "No file changes to commit."
          fi

      - name: Read updated version from manifest.json
        id: ver
        run: |
          VERSION="$(jq -r '.version' manifest.json)"
          if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
            echo "manifest.json.version não encontrado"; exit 1
          fi
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
          echo "Versão (atualizada): $VERSION"

      - name: Build ZIP
        run: ./scripts/build-zip.sh

      - name: Locate ZIP built
        id: zip
        run: |
          ZIP_PATH="dist/cosmoware-extension-v${{ steps.ver.outputs.version }}.zip"
          if [ ! -f "$ZIP_PATH" ]; then
            # fallback: tenta qualquer .zip em dist/
            ZIP_PATH=$(ls dist/*.zip 2>/dev/null | head -n1 || true)
          fi
          if [ -z "$ZIP_PATH" ] || [ ! -f "$ZIP_PATH" ]; then
            echo "Nenhum .zip encontrado em dist/"; exit 1
          fi
          echo "zip_path=$ZIP_PATH" >> "$GITHUB_OUTPUT"
          echo "ZIP localizado: $ZIP_PATH"

      - name: Generate SHA256 (if missing)
        id: sha
        run: |
          SHA_PATH="${{ steps.zip.outputs.zip_path }}.sha256"
          if [ ! -f "$SHA_PATH" ]; then
            sha256sum "${{ steps.zip.outputs.zip_path }}" | awk '{print $1}' > "$SHA_PATH"
          fi
          echo "sha_path=$SHA_PATH" >> "$GITHUB_OUTPUT"
          echo "SHA gerado/em uso: $SHA_PATH"

      - name: Upload artifact (ZIP)
        uses: actions/upload-artifact@v4
        with:
          name: cosmoware-extension-v${{ steps.ver.outputs.version }}.zip
          path: ${{ steps.zip.outputs.zip_path }}
          if-no-files-found: error
          retention-days: 30

      - name: Upload artifact (SHA256)
        uses: actions/upload-artifact@v4
        with:
          name: cosmoware-extension-v${{ steps.ver.outputs.version }}.zip.sha256
          path: ${{ steps.sha.outputs.sha_path }}
          if-no-files-found: error
          retention-days: 30

      - name: Generate changelog since last tag
        id: changelog
        shell: bash
        run: |
          LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
          if [ -n "$LAST_TAG" ]; then
            echo "Last tag: $LAST_TAG"
            echo "## Changes since $LAST_TAG" > body.md
            git log --pretty=format:'- %s (%h)' ${LAST_TAG}..HEAD >> body.md
          else
            echo "No previous tag. Listing all commits."
            echo "## Initial Release Notes" > body.md
            git log --pretty=format:'- %s (%h)' >> body.md
          fi
          echo "body_path=body.md" >> "$GITHUB_OUTPUT"

      - name: Update CHANGELOG.md
        shell: bash
        run: |
          VERSION="v${{ steps.ver.outputs.version }}"
          DATE=$(date -u +'%Y-%m-%d')
          echo "### ${VERSION} - ${DATE}" > tmp.md
          cat body.md >> tmp.md
          echo "" >> tmp.md
          if [ -f CHANGELOG.md ]; then
            cat CHANGELOG.md >> tmp.md
          fi
          mv tmp.md CHANGELOG.md
          if ! git diff --quiet; then
            git add CHANGELOG.md
            git commit -m "docs(changelog): update for ${VERSION} [skip ci]"
            git push origin HEAD:main || true
          else
            echo "No changes to CHANGELOG.md."
          fi

      - name: Create tag
        shell: bash
        run: |
          git tag "v${{ steps.ver.outputs.version }}"
          git push origin "v${{ steps.ver.outputs.version }}" || {
            echo "Tag push failed (maybe tag exists)."
          }

      - name: Create GitHub Release (with assets)
        uses: softprops/action-gh-release@v2
        with:
          tag_name: "v${{ steps.ver.outputs.version }}"
          name: "v${{ steps.ver.outputs.version }}"
          body_path: "${{ steps.changelog.outputs.body_path }}"
          files: |
            ${{ steps.zip.outputs.zip_path }}
            ${{ steps.sha.outputs.sha_path }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
</file>

<file path="README.md">
# CosmoWare

[![RepoMix](https://img.shields.io/badge/RepoMix-enabled-4B8BF4)](https://repomix.com)

**CosmoWare** é uma extensão de navegador para **reduzir o assédio digital** no uso dos sistemas da Conscienciologia (`*.conscienciologia.org.br`).  
Ela adiciona melhorias simples e úteis em telas específicas, sem alterar o funcionamento original dos sistemas.

📦 Contexto do repositório para IA: veja **[REPOMIX.md](./REPOMIX.md)**

---

## ✨ Propósito

Apoiar o voluntário na **autogestão lúcida**, tornando o uso dos sistemas mais **claro, leve e produtivo**.  
Cada funcionalidade busca diminuir atritos, automatizar tarefas repetitivas e promover mais **cosmoética digital**.

---

## 🚀 Funcionalidades

### ICNet — Pessoa Física » Voluntário — **WBS do Voluntariado**
Gera um **diagrama WBS (Work Breakdown Structure)** em imagem a partir da tabela de voluntários.

- ✅ **Toolbar discreta** antes da tabela com:
  - **🖼️ Gerar Imagem** (único gatilho de geração)
  - **Formato: PNG / SVG** (persistente via `localStorage`)
  - **Baixar imagem** (habilitado após a geração)

![](doc/feature-pessoa-fisica-voluntario.png)

---

### ICNet — Configuração IC » Organograma (clássico)
Gera automaticamente um organograma a partir dos dados da tela administrativa, com **download de PNG** nomeado com IC e data/hora.  

![](doc/feature-configuracoes-ic-organograma-voluntario.png)

---

## 🔧 Instalação (modo desenvolvedor)

1. Baixe o [código fonte zip](https://github.com/conscienciologia/CosmoWare/releases/latest/) 
2. No Chrome/Brave, abra: `chrome://extensions`
3. Ative **Developer mode / Modo desenvolvedor**
4. Clique em **Load unpacked / Carregar sem empacotar**
5. Selecione a pasta do projeto

Pronto ✅ A extensão será carregada e atuará **somente nas telas suportadas**.

---

## 🖥️ Como usar (Pessoa Física » Voluntário)

1. Abra a tela **Pessoa Física » Voluntário** no ICNet.  
2. Na toolbar inserida pela extensão, clique em **🖼️ Gerar Imagem**.  
3. (Opcional) Escolha o **formato** (PNG/SVG). O formato escolhido é **lembrado** entre páginas.  
4. Após a renderização, use **Baixar imagem** para salvar o arquivo.  

> Nas telas não reconhecidas, a extensão **não interfere**.

---

## 🩺 Solução de problemas

- **Botões não aparecem**: confirme se o breadcrumb é exatamente **Pessoa Física » Voluntário**.  
- **Sem preview/erro de rede**: verifique conexão com `https://kroki.io/` (bloqueadores podem impedir).  
- **SVG não baixa**: assegure que o navegador permita baixar **Blob URLs**; tente PNG como alternativa.  
- **Dados diferentes após paginação**: esta feature só gera a imagem quando você clicar em **Gerar Imagem** (não gera automaticamente).

---

## 🔒 Privacidade

- Lemos apenas o conteúdo da **página atual**, sem capturar dados pessoais para fora do navegador.  
- Para renderizar diagramas, usamos **Kroki.io**: enviamos **apenas o texto do PlantUML** necessário.  
- Detalhes em [`SECURITY.md`](./SECURITY.md).  

---

## 🤝 Como contribuir

CosmoWare é **aberto a contribuições humanas e via IA**.  

- Sugira novas features: abra uma [issue](./.github/ISSUE_TEMPLATE/feature_request.md)  
- Contribua com código: veja [`CONTRIBUTING.md`](./CONTRIBUTING.md)  
- Entenda a arquitetura: [`ARCHITECTURE.md`](./ARCHITECTURE.md)  
- Guia de dev: [`DEVELOPMENT.md`](./DEVELOPMENT.md)  
- Uso de IA no projeto: [`AI_GUIDE.md`](./AI_GUIDE.md)  

---

## 📜 Licença & Conduta

- Projeto comunitário e aberto  
- Siga o [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) para manter um ambiente **cosmoético e acolhedor**  

---

> ✨ **CosmoWare = Cosmoética + Software** ✨  
Promovendo lucidez, organização e leveza no uso da tecnologia.

# Suporte

Está interessado na ferramenta? Acesse o [grupo do WhatsApp](https://chat.whatsapp.com/E27UQLdYsxFJs5PVHAWgkg?mode=ems_share_c).
</file>

</files>
