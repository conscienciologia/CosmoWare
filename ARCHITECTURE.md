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
