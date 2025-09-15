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
