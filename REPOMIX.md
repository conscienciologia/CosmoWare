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
  utils.js
domains/
  icnet/
    administrador/
      configuracao-ic/
        organograma.js
    pessoa-fisica/
      voluntario/
        organograma-voluntarios.js
    main.js
templates/
  module-template.js
.gitattributes
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

/** Cria um MutationObserver simples (childList+subtree) e retorna o handler para disconnect */
export function attachSimpleObserver(cb, doc = document) {
  const mo = new MutationObserver(cb);
  mo.observe(doc.documentElement || doc.body, { childList: true, subtree: true });
  return () => mo.disconnect();
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

<file path="domains/icnet/pessoa-fisica/voluntario/organograma-voluntarios.js">
// domains/icnet/pessoa-fisica/voluntario/organograma-voluntarios.js
// CosmoWare — ICNET | Geração de organograma (PlantUML WBS via Kroki) a partir da tabela de Voluntários

export async function init(ctx) {
  const {
    nsLogger,
    normalizeText,
    readBreadcrumb,
    attachSimpleObserver,
    krokiPlantUmlToPng,
    timeStampCompact,
  } = ctx.utils || {};

  // Logger compatível com main.js
  const { log, warn } = nsLogger?.("[ICNET/PF-VOL]") || {
    log: (...a) => console.log("[ICNET/PF-VOL]", ...a),
    warn: (...a) => console.warn("[ICNET/PF-VOL]", ...a),
  };
  const ns = log;
  const err = (...a) => console.error("[ICNET/PF-VOL]", ...a);

  try {
    ns("init: módulo carregado");

    // 1) Validação de breadcrumb
    const bcObj = readBreadcrumb?.(document) || { raw: "", norm: "" };
    const alvo = normalizeText?.("Pessoa Física » Voluntário");
    const bcOk = bcObj.norm === alvo;

    ns("breadcrumb:", bcObj.raw, "=> ok?", bcOk);
    if (!bcOk) {
      warn("breadcrumb não confere — abortando.");
      return;
    }

    // 2) Selecionar a tabela alvo (#Grid1)
    const grid = document.querySelector("#Grid1");
    if (!grid) {
      warn("tabela #Grid1 não encontrada — abortando.");
      return;
    }

    // 3) Toolbar idempotente
    const TOOLBAR_ID = "cosmoware-pf-vol-toolbar";
    let toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = TOOLBAR_ID;
      toolbar.className = "cosmoware-toolbar cosmoware-pf-vol-toolbar";
      Object.assign(toolbar.style, {
        display: "flex",
        gap: "8px",
        alignItems: "center",
        margin: "8px 0",
        padding: "6px 8px",
        border: "1px solid #ddd",
        borderRadius: "6px",
        background: "#fafafa",
        fontSize: "12px",
      });

      const btnRefresh = document.createElement("button");
      btnRefresh.type = "button";
      btnRefresh.className = "cosmoware-btn cosmoware-btn-refresh";
      btnRefresh.textContent = "Atualizar";
      Object.assign(btnRefresh.style, { cursor: "pointer" });

      const btnDownload = document.createElement("a");
      btnDownload.className = "cosmoware-btn cosmoware-btn-download";
      btnDownload.textContent = "Baixar PNG";
      btnDownload.href = "javascript:void(0)";
      btnDownload.setAttribute(
        "download",
        `ICNET-voluntarios-${timeStampCompact?.() || Date.now()}.png`
      );
      Object.assign(btnDownload.style, { cursor: "pointer" });

      const status = document.createElement("span");
      status.className = "cosmoware-status";
      status.textContent = "— pronto";
      status.style.opacity = "0.7";

      toolbar.appendChild(btnRefresh);
      toolbar.appendChild(btnDownload);
      toolbar.appendChild(status);

      grid.parentElement?.insertBefore(toolbar, grid);

      // Preview
      const PREVIEW_ID = "cosmoware-pf-vol-preview";
      if (!document.getElementById(PREVIEW_ID)) {
        const preview = document.createElement("div");
        preview.id = PREVIEW_ID;
        preview.className = "cosmoware-preview cosmoware-pf-vol-preview";
        Object.assign(preview.style, { margin: "6px 0 10px" });

        const img = document.createElement("img");
        img.className = "cosmoware-preview-img";
        img.alt = "Organograma (PNG)";
        Object.assign(img.style, {
          maxWidth: "100%",
          border: "1px solid #eee",
          borderRadius: "4px",
          background: "#fff",
        });

        preview.appendChild(img);
        toolbar.parentElement?.insertBefore(preview, toolbar.nextSibling);
      }

      // Listeners
      btnRefresh.addEventListener("click", () => {
        renderFromGrid().catch((e) => err("render manual falhou:", e));
      });

      // Observer para mudanças no grid (ex.: paginação ASP.NET)
      // Importante: attachSimpleObserver(callback, node)
      attachSimpleObserver?.(() => {
        clearTimeout(renderFromGrid.__t);
        renderFromGrid.__t = setTimeout(() => {
          ns("observer: mudanças detectadas na #Grid1 → atualizando organograma…");
          renderFromGrid().catch((e) => err("render via observer falhou:", e));
        }, 120);
      }, grid);

      ns("toolbar inserida com sucesso (idempotente).");
    } else {
      ns("toolbar já presente — mantendo idempotência.");
    }

    // Primeira renderização
    await renderFromGrid();

    // ===== Funções internas =====

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

        // Preserva maiúsculas/minúsculas originais para exibição
        const nome = textPreservandoCase(tds[0]);
        const pf = textPreservandoCase(tds[1]);
        const ativoEl = tr.querySelector('input[type="checkbox"]');
        const ativo = Boolean(ativoEl?.checked);
        const unidade = textPreservandoCase(tds[3]);
        const orgDepto = textPreservandoCase(tds[4]);
        const funcao = textPreservandoCase(tds[5]);
        const dataInicio = textPreservandoCase(tds[6]);
        const dataSaida = textPreservandoCase(tds[7]);

        // Inativo se houver Data Saída preenchida
        const inativoPorSaida = dataSaida && dataSaida.trim().length > 0;
        const ativoFinal = ativo && !inativoPorSaida;

        items.push({
          nome,
          pf,
          ativo: ativoFinal,
          unidade,
          orgDepto,
          funcao,
          dataInicio,
          dataSaida,
        });
      }
      return items;
    }

    // ---- WBS com estereótipos <<ativo>> e <<inativo>> + estilos no <style> ----
    function buildPlantUml(vols) {
      const esc = (s) => (s || "").trim();

      // Árvore raiz com agrupamento por OrgDepto (split por "\")
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

      // ======== Lógica do "raiz condicional" ========
      // Se existir APENAS um nível raiz (ex.: "Colegiado Administrativo")
      // e não houver voluntários diretamente em root, usamos esse nó como raiz
      // e NÃO imprimimos "* Voluntários".
      const onlyOneRoot =
        root.volunteers.length === 0 && root.children.length === 1;

      // Renderização
      const lines = [];
      lines.push("@startwbs");

      // Estilos WBS (classes .ativo / .inativo)
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

      function renderNode(node, prefix) {
        lines.push(`${prefix} ${node.name}`);

        // Subnós (ordenados)
        for (const child of node.children.sort((a, b) =>
          a.name.localeCompare(b.name)
        )) {
          renderNode(child, prefix + "*");
        }

        // Voluntários (ordenados por nome)
        for (const v of node.volunteers.sort((a, b) =>
          a.nome.localeCompare(b.nome)
        )) {
          const stereo = v.ativo ? "ativo" : "inativo";
          const label = `${esc(v.nome)} (${esc(v.funcao) || "—"})`;
          lines.push(`${prefix}* ${label} <<${stereo}>>`);
        }
      }

      if (onlyOneRoot) {
        // Usa o único filho como raiz
        const single = root.children[0];
        renderNode(single, "*");
      } else {
        // Mantém "Voluntários" como raiz visível
        renderNode(root, "*");
      }

      lines.push("@endwbs");
      return lines.join("\n");
    }

    async function renderFromGrid() {
      const statusEl = document.querySelector(
        "#" + TOOLBAR_ID + " .cosmoware-status"
      );
      const previewImg = document.querySelector(
        "#cosmoware-pf-vol-preview .cosmoware-preview-img"
      );
      const downloadA = document.querySelector(
        "#" + TOOLBAR_ID + " .cosmoware-btn-download"
      );

      try {
        statusEl && (statusEl.textContent = "— coletando dados…");
        const items = extractVolunteers();
        ns(`extraídos ${items.length} voluntários (página atual da grade).`);

        statusEl && (statusEl.textContent = "— gerando PlantUML…");
        const uml = buildPlantUml(items);

        // Logar UML para inspeção
        ns("=== PlantUML WBS gerado ===\n" + uml + "\n=== fim PlantUML ===");

        statusEl && (statusEl.textContent = "— solicitando PNG ao Kroki…");
        const pngData = await krokiPlantUmlToPng?.(uml);
        ns("PNG recebido do Kroki.");

        let blob;
        if (pngData instanceof Blob) {
          blob = pngData;
        } else if (
          pngData instanceof ArrayBuffer ||
          ArrayBuffer.isView?.(pngData)
        ) {
          const ab = pngData instanceof ArrayBuffer ? pngData : pngData.buffer;
          blob = new Blob([ab], { type: "image/png" });
        } else if (typeof pngData === "string") {
          if (pngData.startsWith("data:image/png")) {
            const b64 = pngData.split(",")[1];
            const bin = atob(b64);
            const u8 = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
            blob = new Blob([u8], { type: "image/png" });
          } else {
            // Caso Kroki retorne URL/dataURI já pronto
            previewImg && (previewImg.src = pngData);
          }
        }

        let url;
        if (blob) {
          url = URL.createObjectURL(blob);
          previewImg && (previewImg.src = url);
        }

        const fname = `ICNET-voluntarios-${
          timeStampCompact?.() || Date.now()
        }.png`;

        if (downloadA) {
          if (url) downloadA.href = url;
          downloadA.setAttribute("download", fname);
        }

        statusEl && (statusEl.textContent = "— pronto ✓");
        ns("organograma renderizado com sucesso.");
      } catch (e) {
        statusEl && (statusEl.textContent = "— erro");
        err("falha ao renderizar organograma:", e);
      }
    }
  } catch (e) {
    err("erro inesperado no init:", e);
  }
}
</file>

<file path="templates/module-template.js">
export async function init(ctx) { console.log('Template de módulo CosmoWare'); }
</file>

<file path=".gitattributes">
# Use line endings do sistema operacional local
* text=auto

# Scripts shell sempre LF
*.sh text eol=lf

# Batch/PowerShell sempre CRLF
*.bat text eol=crlf
*.ps1 text eol=crlf

# JSON, YAML, MD, etc. forçar LF (para CI/CD não quebrar)
*.yml text eol=lf
*.yaml text eol=lf
*.json text eol=lf
*.md text eol=lf
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

<file path="ARCHITECTURE.md">
# ARCHITECTURE

## Visão Geral

CosmoWare é uma extensão **modular** para Chrome (Manifest V3) que atua em páginas específicas dos sistemas da Conscienciologia (`*.conscienciologia.org.br`).  

O fluxo de execução é:

1. **`core/content.js`**: carregado em todos os frames.  
   - Detecta o domínio (ex.: `icnet.conscienciologia.org.br`).  
   - Encaminha para o **roteador de domínio**.

2. **`domains/<subdomínio>/main.js`**: router por domínio.  
   - Lê breadcrumb e URL da página.  
   - Identifica a rota correspondente.  
   - Carrega dinamicamente o módulo da feature.

3. **`domains/<subdomínio>/<rota>/<feature>.js`**: módulo da funcionalidade.  
   - Exporta apenas `init(ctx)`.  
   - Contém toda a lógica daquela tela.  
   - Deve ser idempotente (não duplicar UI).

---

## Filosofia de Modularização

- **Primeiro nível:** domínio (ex.: `icnet/`).  
- **Segundo nível:** caminho da rota (ex.: `administrador/configuracao-ic/`).  
- **Arquivo final:** a feature da tela (ex.: `organograma.js`).  

Exemplo:

```
domains/
  icnet/
    main.js
    administrador/
      configuracao-ic/
        organograma.js
```

Cada feature é **independente** e pode ser desenvolvida, revisada ou substituída isoladamente.

---

## Contrato do Módulo

Todo módulo deve exportar uma função assíncrona `init(ctx)`:

```js
export async function init(ctx) {
  const { utils, doc, href, host } = ctx;
  const { nsLogger, readBreadcrumb } = utils;
  const { log } = nsLogger("[ICNET/FEATURE]");

  if (window.__my_feature_loaded) return;
  window.__my_feature_loaded = true;

  const { norm } = readBreadcrumb(doc);
  if (!norm.includes("administrador » configuração ic » organograma")) return;

  log("Feature iniciada!");
  // ... sua lógica aqui ...
}
```

### `ctx` contém:
- `doc`: documento do frame atual.  
- `href`, `host`: informações do frame.  
- `utils`: conjunto de utilidades globais (logger, normalização, Kroki, observers, etc.).

---

## Utilidades Disponíveis (`ctx.utils`)

- `nsLogger(namespace)`: cria logger com prefixo consistente (`log`, `warn`, `error`).  
- `normalizeText(str)`: remove acentos e normaliza para minúsculas.  
- `readBreadcrumb(doc)`: retorna `{ raw, norm }` do breadcrumb atual.  
- `krokiPlantUmlToPng(uml)`: gera Blob de PNG via Kroki.  
- `timeStampCompact()`: retorna timestamp compacto para nomear arquivos.  
- `attachSimpleObserver(fn, doc)`: executa `fn` quando DOM muda, desconectando após sucesso.

---

## Convenções

- **IDs e classes**: prefixo `cosmoware-` ou `ct-`.  
- **Logs**: prefixo fixo por módulo (ex.: `[ICNET/ORG]`).  
- **Breadcrumb**: principal forma de detecção da rota.  
- **URL params**: podem complementar a detecção (`?f=1028`).  
- **Idempotência**: cada módulo deve garantir que não injete UI mais de uma vez.

---

## Exemplo de Roteador de Domínio (`icnet/main.js`)

```js
import { nsLogger, readBreadcrumb } from "../../core/utils.js";

const { log } = nsLogger("[ICNET/MAIN]");

const routes = [
  {
    name: "administrador/configuracao-ic/organograma",
    match: (ctx) => {
      const { norm } = readBreadcrumb(ctx.doc);
      return norm.includes("administrador » configuração ic » organograma");
    },
    loader: () => import(chrome.runtime.getURL(
      "domains/icnet/administrador/configuracao-ic/organograma.js"
    )),
  },
];

export async function init(ctx) {
  for (const r of routes) {
    try {
      if (r.match(ctx)) {
        log(`Rota detectada: ${r.name}`);
        const mod = await r.loader();
        await mod.init(ctx);
        return;
      }
    } catch (e) {
      console.error(`[ICNET/MAIN] erro em rota ${r.name}`, e);
    }
  }
}
```

---

## Boas Práticas

- Atuar **somente** na tela correta.  
- Usar logs claros e consistentes.  
- Não duplicar elementos visuais.  
- Não depender de outra feature.  
- Respeitar privacidade (não logar dados pessoais).  
- PRs pequenos e focados em **uma tela/uma funcionalidade**.
</file>

<file path="CODE_OF_CONDUCT.md">
# Código de Conduta — CosmoWare

Diretrizes de convivência.
</file>

<file path="CONTRIBUTING.md">
# Contributing to CosmoWare

Fluxo de contribuição e boas práticas.
</file>

<file path="DEVELOPMENT.md">
# DEVELOPMENT

Guia técnico para rodar e desenvolver o CosmoWare.
</file>

<file path="SECURITY.md">
# SECURITY

Políticas de segurança e privacidade.
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

<file path="domains/icnet/main.js">
/*****************************************************
 * domains/icnet/main.js – Router do domínio ICNET
 * Decide qual módulo de tela carregar (por breadcrumb/URL)
 * Logs: [ICNET/MAIN]
 *****************************************************/
export async function init(context) {
  const { utils } = context;
  const { nsLogger, normalizeText, readBreadcrumb, attachSimpleObserver } = utils;
  const { log, warn } = nsLogger("[ICNET/MAIN]");

  if (window.__ct_icnet_main_loaded) return;
  window.__ct_icnet_main_loaded = true;

  // Rotas do domínio icnet
  // match(ctx) → boolean, loader() → Promise<module>
  const routes = [
    {
      name: "administrador/configuracao-ic/organograma",
      match: (ctx) => {
        const { norm } = readBreadcrumb(ctx.doc);
        const alvo = normalizeText("Administrador » Configuração IC » Organograma");
        // Heurística adicional (opcional): f=1028 no URL
        const hintUrl = /[?&#](f|functionkey)=1028\b/i.test(ctx.href);
        return norm.includes(alvo) || hintUrl;
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
        // readBreadcrumb retorna objeto { raw, norm, ... } no seu router
        const { norm } = readBreadcrumb(ctx.doc);
        const alvo = normalizeText("Pessoa Física » Voluntário");

        // Heurística adicional: rota também casa por ?f=29
        const hintUrl = /[?&#](f|functionkey)=29\b/i.test(ctx.href);

        // Mais tolerante: 'includes' em vez de igualdade estrita
        return (norm && norm.includes(alvo)) || hintUrl;
        } catch {
        return false;
        }
    },
    loader: () =>
        import(
        chrome.runtime.getURL(
            "domains/icnet/pessoa-fisica/voluntario/organograma-voluntarios.js"
        )
        )
    }


    // Adicione novas rotas aqui no futuro
  ];

  let bootedOnce = false;

  async function tryRoute() {
    if (bootedOnce) return;
    const route = routes.find(r => {
      try { return r.match(context); } catch { return false; }
    });
    if (!route) return;

    log("Rota detectada:", route.name);
    try {
      const mod = await route.loader();
      if (typeof mod?.init !== "function") {
        warn(`Módulo ${route.name} não exporta init()`);
        return;
      }
      await mod.init({ ...context, utils });
      bootedOnce = true;
      log(`Módulo ${route.name} inicializado.`);
    } catch (e) {
      console.error("[ICNET/MAIN]", "Falha ao carregar módulo:", route.name, e);
    }
  }

  // Observa mutações da página (SPA/iframe) para tentar casar a rota
  const detach = attachSimpleObserver(tryRoute, context.doc);

  // Primeira tentativa imediata
  tryRoute();

  // Cleanup automático quando necessário? (opcional)
  // window.addEventListener("beforeunload", detach);
}
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
  - Use apenas os trechos mais relevantes (ex.: `core/utils.js`, `domains/<domínio>/main.js`, exemplos próximos ao que você quer implementar).  
  - Sempre acrescente o Brief.  

Assim a IA entende o **contexto global** (arquitetura e convenções) e também o **objetivo específico** (Brief).

### Outras opções
- **Importar só o REPOMIX.md**: funciona bem em modelos com grande contexto.  
- **Importar só trechos específicos**: útil em prompts rápidos ou para modelos com limite menor, mas pode gerar inconsistências.  

---

## 2) Workflow IA-first

1. **Obtenha contexto**  
   - Gere o `REPOMIX.md` local (`npx repomix`) ou use o do repositório (atualizado pelo CI).  
   - Cole o conteúdo no chat da IA.  

2. **Escreva o Brief da funcionalidade** (template abaixo).  

3. **Use o Prompt Base de Geração de Módulo**.  

4. **Teste manualmente** a extensão.  

5. **Itere com a IA** usando prompts de refino/depuração.  

6. **Abra PR** com checklist preenchido e, se possível, o prompt utilizado.  

---

## 3) Template de Brief

```
# Brief de funcionalidade (CosmoWare / IA)

## Domínio e Tela
- Domínio: icnet.conscienciologia.org.br
- Breadcrumb (normalizado): administrador » configuração ic » organograma
- URL(s) típica(s): https://icnet.conscienciologia.org.br/main.aspx#, /verpon/app/grid.aspx?f=1028

## Objetivo
Ex.: Extrair tabela do organograma e gerar imagem (PlantUML via Kroki) com toolbar (Atualizar / Baixar PNG).

## Entradas da página (amostra real de HTML)
Cole aqui trechos relevantes:
- Breadcrumb (#TbPathAndNavigation #lbPath)
- Tabela (#Grid1)
- Exemplo de linhas relevantes

## Resultado Esperado
- Toolbar discreta antes da tabela com botões X, Y…
- Geração de imagem PNG e link de download
- Nome do arquivo: <IC>-<timestamp>.png

## Critérios de Aceitação
- Só atua quando breadcrumb = “administrador » configuração ic » organograma”
- Não duplica UI (idempotência)
- Logs com prefixo [ICNET/ORG]
- Erros tratados no console de forma clara
- Compatível com iframes

## Observações
- Usar ctx.utils (nsLogger, readBreadcrumb, krokiPlantUmlToPng, timeStampCompact, attachSimpleObserver)
- IDs/Classes com prefixo cosmoware-
```

---

## 4) Prompt Base — Geração de Módulo

```
Você é um assistente desenvolvedor do projeto CosmoWare. 
Considere **todo o contexto em REPOMIX.md** e o seguinte **Brief** (abaixo). 
Gere um **módulo ES Module** que exporte `export async function init(ctx) { ... }`, 
e siga estes requisitos:

- Estrutura: domains/<subdomínio>/<rota>/<nome>.js
- Independente (não importa outra feature)
- Use apenas ctx.utils (nsLogger, normalizeText, readBreadcrumb, attachSimpleObserver, krokiPlantUmlToPng, timeStampCompact)
- Valide breadcrumb antes de atuar
- Idempotência (não duplicar UI)
- Logs com namespace fixo (ex.: [ICNET/ORG])
- IDs/classes com prefixo cosmoware-
- Comente trechos críticos

### Brief
[COLE AQUI O BRIEF]

### Entregue:
1) Código completo do módulo
2) Lista de seletores utilizados e justificativa
3) Logs esperados no console
```

---

## 5) Prompt Base — Registro no Router

```
Gere o snippet para registrar a rota no arquivo domains/<subdomínio>/main.js, 
seguindo o padrão do projeto:

- `name`: caminho legível da tela
- `match(ctx)`: verificação do breadcrumb
- `loader()`: import dinâmico via chrome.runtime.getURL

Além do snippet, diga onde colar e gere checklist de testes manuais.  
Breadcrumb alvo: "administrador » configuração ic » organograma".
```

---

## 6) Prompts de Refino

### Seletores/breadcrumb não batem
```
Os seletores ou breadcrumb não estão casando. 
Aqui estão os logs e HTML coletado:

[cole logs/HTML]

Por favor:
- Ajuste seletores para iframes
- Garanta idempotência
- Liste logs esperados
```

### UI duplicada
```
A UI está sendo inserida mais de uma vez. 
Revise o módulo para idempotência com flag global e uso correto de observer.
```

### Logs confusos
```
Padronize logs com nsLogger e namespace fixo.  
Mostre timeline de eventos esperada.
```

---

## 7) Checklist de Aceitação

- [ ] Atua somente na tela correta  
- [ ] Não duplica UI  
- [ ] Logs claros e padronizados  
- [ ] Usa apenas ctx.utils  
- [ ] Compatível com iframes  
- [ ] Arquivo em domains/<domínio>/<rota>/<feature>.js  
- [ ] Rota registrada em main.js  
- [ ] Testado manualmente  
- [ ] Prompt usado documentado no PR  

---

## 8) Dicas de HTML no Prompt

- Copie trechos reais do DOM (breadcrumb, tabela, botões)  
- Inclua variações (linhas pares/impares)  
- Informe se há iframes  

---

## 9) Exemplos de Critérios de Aceitação

- “Exibir toolbar com botões antes da tabela #Grid1”  
- “Gerar PNG via Kroki”  
- “Nome do arquivo <IC>-<timestamp>.png”  
- “Log final: Organograma renderizado com sucesso. Nós: N”  
- “Nunca renderizar fora do breadcrumb alvo”  

---

## 10) Automação com RepoMix

- O `REPOMIX.md` é atualizado automaticamente no GitHub Actions.  
- Sempre inicie a geração com IA usando o `REPOMIX.md` **+ Brief**.  
- Se o arquivo for grande demais, use apenas trechos essenciais.  
- Reexecute IA após atualizações no repositório para manter consistência.  

---

## 11) Prompts auxiliares

**Refatorar para padrão CosmoWare**
```
Reescreva este módulo para o padrão CosmoWare:
- exporta init(ctx)
- usa apenas ctx.utils
- logs com nsLogger
- idempotência
- comentários críticos
[cole código aqui]
```

**Gerar descrição de PR**
```
Gere descrição de PR no padrão CosmoWare:
- O que foi feito
- Prints
- Logs esperados
- Checklist
```

**Changelog curto**
```
Gere changelog curto no formato semântico (feat, fix, chore).
```

---

## 12) Segurança

- Nunca logar dados pessoais  
- Usar Kroki apenas para texto de diagrama  
- Se houver dados sensíveis → mascarar/remover e documentar no PR  

---

## 13) Exemplos no Repositório

- `domains/icnet/administrador/configuracao-ic/organograma.js`  
- `domains/icnet/main.js`  
- `core/utils.js`  

> Estes arquivos estão sempre no `REPOMIX.md` e servem como exemplos.
</file>

<file path="manifest.json">
{
  "manifest_version": 3,
  "name": "Conscienciologia Tools",
  "version": "0.4.0",
  "description": "Extensão modular por domínio e por tela para *.conscienciologia.org.br",
  "permissions": ["scripting", "activeTab"],
  "host_permissions": [
    "https://*.conscienciologia.org.br/*",
    "https://kroki.io/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://*.conscienciologia.org.br/*"],
      "js": ["core/content.js"],
      "run_at": "document_idle",
      "all_frames": true
    }
  ],
  "web_accessible_resources": [
    {
      "resources": [
        "core/utils.js",
        "domains/*/main.js",
        "domains/*/*.js",
        "domains/*/**/*.js",
        "domains/*/**/**/*.js"
      ],
      "matches": ["https://*.conscienciologia.org.br/*"]
    }
  ]
}
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

      - name: Compute date-based version (YY.MM.DD.<ms>)
        id: ver
        shell: bash
        run: |
          DATE=$(date -u +'%y.%m.%d')
          TS=$(date -u +%s%3N)   # timestamp em milissegundos (UTC)
          VERSION="${DATE}.${TS}"
          echo "version=${VERSION}" >> "$GITHUB_OUTPUT"
          echo "Computed version: ${VERSION}"

      - name: Update manifest.json (if present)
        shell: bash
        run: |
          if [ -f manifest.json ]; then
            echo "Updating manifest.json to version ${{ steps.ver.outputs.version }}"
            jq --arg v "${{ steps.ver.outputs.version }}" '.version=$v' manifest.json > manifest.json.tmp && mv manifest.json.tmp manifest.json
          else
            echo "manifest.json not found. Skipping."
          fi

      - name: Update package.json (if present)
        shell: bash
        run: |
          if [ -f package.json ]; then
            echo "Updating package.json to version ${{ steps.ver.outputs.version }}"
            jq --arg v "${{ steps.ver.outputs.version }}" '.version=$v' package.json > package.json.tmp && mv package.json.tmp package.json
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
            git commit -m "chore(release): v${{ steps.ver.outputs.version }}"
          else
            echo "No file changes to commit."
          fi

      - name: Create tag
        shell: bash
        run: |
          git tag "v${{ steps.ver.outputs.version }}"
          git push origin "v${{ steps.ver.outputs.version }}" || {
            echo "Tag push failed (maybe tag exists)."
          }

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
            git commit -m "docs(changelog): update for ${VERSION}"
          else
            echo "No changes to CHANGELOG.md."
          fi

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: "v${{ steps.ver.outputs.version }}"
          name: "v${{ steps.ver.outputs.version }}"
          body_path: "${{ steps.changelog.outputs.body_path }}"
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

## 🚀 Funcionalidades atuais

- **Organograma (ICNet)**  
  - Extrai dados da tela `Administrador » Configuração IC » Organograma`  
  - Gera automaticamente um **diagrama em imagem** (PlantUML via Kroki)  
  - Permite **baixar o PNG** nomeado com IC e data/hora  

Novas funcionalidades serão adicionadas de forma incremental, sempre de forma **modular**.

---

## 🔧 Instalação (modo desenvolvedor)

1. Clone o repositório:  
   ```bash
   git clone https://github.com/conscienciologia/CosmoWare
   ```
2. No Chrome/Brave, abra: `chrome://extensions`
3. Ative **Developer mode / Modo desenvolvedor**
4. Clique em **Load unpacked / Carregar sem empacotar**
5. Selecione a pasta do projeto

Pronto ✅ A extensão será carregada e atuará **somente nas telas suportadas**.

---

## 🖥️ Como usar

- Acesse normalmente os sistemas (ex.: ICNet)  
- Quando entrar em uma tela suportada, a CosmoWare injeta uma **toolbar discreta** com ações úteis  
- Os **logs** no console do navegador confirmam a ativação  

> Nas telas não reconhecidas, a extensão **não interfere**.

---

## 🔒 Privacidade

- Lemos apenas o conteúdo da **página atual**, sem capturar dados pessoais.  
- Para renderizar organogramas, usamos **Kroki.io** (somente o texto do diagrama é enviado).  
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
</file>

</files>
