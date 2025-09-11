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
