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
    main.js
templates/
  module-template.js
.repomixignore
.repomixrc.json
AI_GUIDE.md
ARCHITECTURE.md
CODE_OF_CONDUCT.md
CONTRIBUTING.md
DEVELOPMENT.md
manifest.json
package.json
README-old.md
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
# AI Guide

Guia para colaboração com Inteligência Artificial.
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

<file path="README-old.md">
# Conscienciologia Tools (Extensão Chrome)

Extensão modular para os sistemas `*.conscienciologia.org.br`.\
O objetivo é **acrescentar funcionalidades úteis** em diferentes telas
dos sistemas, mantendo uma **arquitetura simples, modular e
colaborativa**.

------------------------------------------------------------------------

## ✨ Filosofia do Projeto

1.  **Modularidade por Domínio e Tela**
    -   Primeiro nível: **domínio** (ex.:
        `icnet.conscienciologia.org.br`).\
    -   Segundo nível: **tela** (ex.:
        `Administrador » Configuração IC » Organograma`).\
    -   Cada funcionalidade vive em um arquivo **independente**
        (`organograma.js`) e só é carregada quando o usuário estiver
        naquela tela.
2.  **Independência das Funcionalidades**
    -   Cada módulo exporta apenas:

        ``` js
        export async function init(ctx) { ... }
        ```

    -   O módulo decide sozinho se deve atuar, verificando breadcrumb ou
        URL.\

    -   Um módulo **nunca importa outro módulo de feature**.
3.  **Simplicidade para Contribuir**
    -   Para adicionar uma nova funcionalidade:
        1.  Criar um novo arquivo em
            `domains/<domínio>/<rota>/minha-feature.js`.
        2.  Adicionar uma rota correspondente em
            `domains/<domínio>/main.js`.\
    -   Nada mais!\
    -   Isso torna fácil para pessoas e até IA criarem novas features.
4.  **Acoplamento baixo, utilidades comuns**
    -   Funções genéricas (normalizeText, logger, kroki.io, etc.) ficam
        em `core/utils.js`.\
    -   Os módulos recebem `ctx.utils` para usar utilidades sem precisar
        importar direto → isso reduz dependências e evita conflitos.
5.  **Princípio de Menor Surpresa**
    -   A extensão **não interfere** em telas que não conhece.\
    -   Cada módulo verifica o breadcrumb/URL antes de atuar.\
    -   O usuário só vê mudanças na tela correta.
6.  **Transparência e Depuração**
    -   Todos os módulos usam logs com **prefixo claro**: `[CT-CORE]`,
        `[ICNET/MAIN]`, `[ICNET/ORG]`.\
    -   Isso facilita acompanhar o que está acontecendo no console do
        navegador.\
    -   Atalhos de debug (`Ctrl+Shift+O` no Organograma) permitem forçar
        a execução manual.
7.  **Sem Build, Apenas ES Modules**
    -   Todos os arquivos são `.js` nativos (ESM).\
    -   Carregados via `import(chrome.runtime.getURL(...))`.\
    -   Basta editar os arquivos, recarregar a extensão no
        `chrome://extensions` e testar.

------------------------------------------------------------------------

## 📂 Estrutura do Projeto

    manifest.json
    core/
      content.js       → content script único, roteia por domínio
      utils.js         → utilidades compartilhadas
    domains/
      icnet/
        main.js        → roteador do domínio icnet
        administrador/
          configuracao-ic/
            organograma.js  → funcionalidade Organograma

------------------------------------------------------------------------

## 🚀 Como Funciona

1.  **`core/content.js`** roda em todas as páginas
    `*.conscienciologia.org.br`.\
2.  Detecta o **subdomínio** (`icnet`, `icent`, ...) e importa o
    `domains/<subdomínio>/main.js`.\
3.  O **router do domínio** (`main.js`) decide qual funcionalidade
    carregar, baseado em breadcrumb ou URL.\
4.  A funcionalidade (`organograma.js`) injeta sua UI e lógica apenas
    naquela tela.

------------------------------------------------------------------------

## 🛠️ Como Criar uma Nova Funcionalidade

1.  Identifique o **domínio** (ex.: `icnet`).\

2.  Crie um novo arquivo no caminho da tela:

        domains/icnet/financeiro/despesas/minha-feature.js

3.  Dentro do módulo:

    ``` js
    export async function init(ctx) {
      const { utils, doc } = ctx;
      const { nsLogger, readBreadcrumb } = utils;
      const { log } = nsLogger("[ICNET/MINHA-FEATURE]");

      if (window.__my_feature_loaded) return;
      window.__my_feature_loaded = true;

      const { norm } = readBreadcrumb(doc);
      if (!norm.includes("Financeiro » Despesas")) return;

      log("Ativando minha nova feature!");
      // ... sua lógica aqui ...
    }
    ```

4.  Registre a rota em `domains/icnet/main.js`:

    ``` js
    {
      name: "financeiro/despesas/minha-feature",
      match: (ctx) => readBreadcrumb(ctx.doc).norm.includes("financeiro » despesas"),
      loader: () =>
        import(chrome.runtime.getURL(
          "domains/icnet/financeiro/despesas/minha-feature.js"
        ))
    }
    ```

------------------------------------------------------------------------

## 🔎 Logs

-   `[CT-CORE]`: carregamento principal e roteamento de domínio.\
-   `[ICNET/MAIN]`: roteador do domínio icnet.\
-   `[ICNET/ORG]`: módulo Organograma.

Use o console do navegador para acompanhar o fluxo.

------------------------------------------------------------------------

## 📌 Filosofia Final

Este projeto segue a ideia de **lego pieces**:\
- cada funcionalidade é uma peça isolada,\
- fácil de montar, remover ou trocar,\
- sem dependências escondidas.

Assim, tanto humanos quanto IA podem contribuir rapidamente sem medo de
quebrar o resto do sistema.


Adicionar https://repomix.com/

E criar funcionalidades a partir do arquivo gerado.
</file>

<file path="SECURITY.md">
# SECURITY

Políticas de segurança e privacidade.
</file>

<file path="README.md">
# CosmoWare

[![RepoMix](https://img.shields.io/badge/RepoMix-enabled-4B8BF4)](https://repomix.com)


Extensão para Chrome voltada a **diminuir o assédio digital** nos sistemas da Conscienciologia.


README.md
CONTRIBUTING.md
DEVELOPMENT.md
ARCHITECTURE.md
AI_GUIDE.md
SECURITY.md
CODE_OF_CONDUCT.md
templates/
  module-template.js
.github/
  ISSUE_TEMPLATE/
    feature_request.md
  PULL_REQUEST_TEMPLATE.md


# Dica de uso com IA

Quando for abrir uma issue de feature ou iniciar um prompt de geração de código, você (ou quem contribui) pode colar o link para o REPOMIX.md e dizer:

“Considere o contexto do repo em REPOMIX.md. A nova funcionalidade deve ser um módulo independente conforme o contrato init(ctx) e roteada em domains/<domínio>/main.js.”

Isso reduz drasticamente o atrito de onboarding e melhora a qualidade de saídas da IA.
</file>

</files>
