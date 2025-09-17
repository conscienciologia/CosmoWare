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
