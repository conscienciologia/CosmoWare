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
