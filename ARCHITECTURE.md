# ARCHITECTURE

## Visão Geral

CosmoWare é uma extensão **modular** para Chrome (Manifest V3) que atua em páginas específicas dos sistemas da Conscienciologia (`*.conscienciologia.org.br`).  

Fluxo principal:
1. **`core/content.js`**: carregado em todos os frames.  
   - Detecta o domínio (ex.: `icnet.conscienciologia.org.br`).  
   - Encaminha para o **roteador de domínio**.

2. **`domains/<domínio>/main.js`**: router por domínio.  
   - Lê breadcrumb/URL da página (cada domínio tem regra própria).  
   - Identifica a rota correspondente.  
   - Carrega dinamicamente o módulo da feature.

3. **`domains/<domínio>/<rota>/<feature>.js`**: módulo da funcionalidade.  
   - Exporta apenas `init(ctx)`.  
   - Deve ser idempotente (não duplicar UI).  
   - Contém toda a lógica daquela tela.

---

## Filosofia de Modularização

- **Primeiro nível:** domínio (ex.: `icnet/`).  
- **Segundo nível:** caminho da rota (ex.: `administrador/configuracao-ic/`).  
- **Arquivo final:** a feature da tela (ex.: `organograma.js`).  

Cada feature é **independente** e pode ser criada ou evoluída isoladamente, inclusive com ajuda de IA.

---

## Contrato do Módulo

Todo módulo deve exportar uma função assíncrona `init(ctx)`:

```js
export async function init(ctx) {
  const { utils, doc, href, host } = ctx;
  const { nsLogger } = utils;
  const { log } = nsLogger("[ICNET/FEATURE]");

  if (window.__my_feature_loaded) return;
  window.__my_feature_loaded = true;

  // verificação de breadcrumb ou URL aqui...
  log("Feature iniciada!");
}
```

### `ctx` contém:
- `doc`: documento do frame atual.  
- `href`, `host`: informações do frame.  
- `utils`: conjunto de utilidades globais (`nsLogger`, `attachSimpleObserver`, `krokiPlantUmlToPng`, etc.).

---

## Utilitários Globais (`core/`)

- **`utils.js`**: logger, normalização de texto, `readBreadcrumb`, timestamps, Kroki (PlantUML), observer de DOM.  
- **`global-rules.js`**: regras de padronização independentes de domínio:
  - `rule_sanitize_token(s)` → minúsculo, sem acentos, `_` como separador.  
  - `rule_join_tokens(parts)` → une tokens normalizados.  
  - `rule_timestamp_token(d)` → `yyyymmdd-hhmmss`.  
  - `rule_make_filename(parts, ext, d)` → `tokens-timestamp.ext`.

Essas funções garantem que nomes de arquivos gerados sejam **consistentes** em todos os módulos.

---

## Utilitários por Domínio (`domains/<domínio>/*-utils.js`)

Exemplo ICNET (`domains/icnet/icnet-utils.js`):
- `icnet_readBreadcrumbLast(doc)` → último breadcrumb `#TbPathAndNavigation #lbPath`.  
- `icnet_breadcrumb_token(doc)` → breadcrumb normalizado (via regras globais).  
- `icnet_ic_token(doc)` → IC atual (ex.: `JURISCONS`).  
- `icnet_findFormEntriesWithGrid(doc)` → `div.FormEntry` com `table.GridStyle`.  
- `icnet_make_filename(ext, doc, d)` → `icnet-<ic>-<breadcrumb>-<timestamp>.<ext>`.

Cada domínio define os seus utilitários conforme sua estrutura de HTML.

---

## Padrão de Router por Domínio

Exemplo simplificado:

```js
const routes = [
  {
    name: "administrador/configuracao-ic/organograma",
    match: (ctx) => ctx.utils.readBreadcrumb(ctx.doc).norm.includes("organograma"),
    loader: () => import(chrome.runtime.getURL(
      "domains/icnet/administrador/configuracao-ic/organograma.js"
    )),
  },
  {
    name: "shared/export-grid",
    match: () => true, // export-grid roda em qualquer FormEntry/GridStyle
    loader: () => import(chrome.runtime.getURL(
      "domains/icnet/shared/export-grid.js"
    )),
  },
];
```

O router percorre todas as rotas, chama `match(ctx)` e importa módulos que retornarem `true`.

---

## Toolbar Compartilhada

- Módulos podem inserir uma **toolbar** acima de `FormEntry` (ICNET).  
- Se já existir toolbar nativa (ex.: Organograma), os botões são anexados nela.  
- **Idempotência:** marcar `data-cosmoware-toolbar="1"`.  
- **Visual:** usar classes Bootstrap já carregadas; ícones Font Awesome 5.0.7 presentes no ICNET.  
- **Fallback:** se FA não aplicar no frame, usar emoji.

---

## Exportação CSV (ICNET)

Implementação atual:
- Escopo: `div.FormEntry > table.GridStyle`.  
- Assumimos **sem colspan**.  
- Exporta:
  - Cabeçalhos `<th>`,  
  - Dados `<td>`,  
  - Checkbox → `true/false`,  
  - Links `<a>` → texto visível.  
- Formato: UTF-8 **BOM**, **CRLF** (Excel-friendly).  
- Nome do arquivo:  
  `icnet-<ic>-<breadcrumb>-<yyyymmdd-hhmmss>.csv`  
  (sempre minúsculo, sem acentos, sem espaços).  
- Não exporta outras páginas (sem paginação incremental).  
- Apenas uma tabela por FormEntry.

---

## Boas Práticas

- **Chrome Web Store compliance**:
  - Sem injeção de CSS/JS externos.  
  - Usar libs já carregadas na página.  
  - Não logar dados pessoais.  
- **Idempotência**: guards globais (`window.__feature_booted`) + marcações no DOM.  
- **Logs consistentes**: use `nsLogger` sempre.  
- **Módulos pequenos e isolados**: uma tela, uma responsabilidade.  
- **Facilitar colaboração IA**: código previsível, convenções estáveis.  

---

## Extensão para Novos Domínios

Para suportar outro subdomínio:
1. Criar `domains/<novo>/main.js`.  
2. Criar `domains/<novo>/<novo>-utils.js` (breadcrumb, seletores locais).  
3. Reaproveitar `core/global-rules.js` para nomes/tokens.  
4. Implementar módulos `init(ctx)` seguindo o padrão.

Essa arquitetura garante **regras globais consistentes** e **especialização local por domínio**, favorecendo evolução incremental e contribuição assistida por IA.
