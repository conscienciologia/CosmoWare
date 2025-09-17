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
