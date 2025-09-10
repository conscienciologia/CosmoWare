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
