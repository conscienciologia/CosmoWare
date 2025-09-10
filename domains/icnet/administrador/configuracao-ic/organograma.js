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
