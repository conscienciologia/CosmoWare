# Desenvolvimento — CosmoWare

Este documento é o guia prático para contribuir no desenvolvimento do CosmoWare.

---

## 1) Pré-requisitos

- Navegador baseado em Chromium (Chrome/Brave)
- Git instalado
- (Opcional) Node.js 18+ se quiser rodar ferramentas auxiliares (ex.: repomix)

---

## 2) Instalação local

1. Clone o repositório:
   ```bash
   git clone https://github.com/conscienciologia/CosmoWare
   ```

2. Abra `chrome://extensions` no navegador.

3. Ative o **Modo desenvolvedor**.

4. Clique em **Carregar sem compactação (Load unpacked)** e escolha a pasta do projeto.

---

## 3) Arquitetura (resumo prático)

- `core/content.js` → roteador principal de domínios
- `domains/<subdomínio>/main.js` → roteador de telas de um domínio
- `domains/<subdomínio>/<rota>/<feature>.js` → módulo independente que exporta `init(ctx)`
- `ctx.utils`: utilitários comuns (logger, breadcrumb, kroki, observer, timestamp…)

---

## 4) Rodando e depurando

1. Abra a tela alvo no navegador.  
2. Abra o console (`F12`) e verifique os logs.  
   - Logs seguem padrão: `[CT-CORE]`, `[ICNET/MAIN]`, `[ICNET/<FEATURE>]`.  
3. Recarregue a extensão e a página sempre que modificar arquivos.  

---

## 5) Criando uma nova funcionalidade

### Passos

1. Crie um novo arquivo em `domains/<subdomínio>/<rota>/<nome>.js`.
2. Registre a rota em `domains/<subdomínio>/main.js`.
3. Implemente `export async function init(ctx) { … }`.

### Boas práticas

- Validar breadcrumb/URL antes de atuar.
- Garantir **idempotência** (não duplicar UI).
- Usar apenas `ctx.utils`.
- Manter logs claros e com namespace fixo.
- Inserir UI discreta, sem interferir em outras telas.

### Template mínimo

```js
// domains/<subdomínio>/<rota>/<feature>.js
export async function init(ctx) {
  const { utils, doc } = ctx;
  const { nsLogger, readBreadcrumb, attachSimpleObserver } = utils;
  const { log } = nsLogger("[ICNET/MINHA-FEATURE]");

  if (window.__minha_feature_loaded) return;
  window.__minha_feature_loaded = true;

  function isRightPage() {
    const { norm } = readBreadcrumb(doc);
    return norm.includes("administrador » configuração ic » organograma");
  }

  async function run() {
    if (!isRightPage()) return;
    log("Ativada com sucesso.");
  }

  const detach = attachSimpleObserver(run, doc);
  run();
}
```

### Registro da rota

```js
// domains/icnet/main.js
const routes = [
  {
    name: "administrador/configuracao-ic/organograma",
    match: (ctx) => {
      const { norm } = ctx.utils.readBreadcrumb(ctx.doc);
      return norm.includes("administrador » configuração ic » organograma");
    },
    loader: () => import(chrome.runtime.getURL(
      "domains/icnet/administrador/configuracao-ic/organograma.js"
    )),
  },
  // novas rotas aqui…
];
```

---

## 6) Padrões de código e UI

- IDs/classes iniciam com prefixo `cosmoware-`.
- Nenhuma dependência entre features.
- Logs com `nsLogger("[ICNET/NOME]")`.
- UI discreta e idempotente.

---

## 7) RepoMix no desenvolvimento

- O arquivo **`REPOMIX.md`** é gerado automaticamente pelo **CI** no repositório.  
- Use este arquivo como **contexto principal** ao trabalhar com IA.  
- Estratégia recomendada: **REPOMIX.md + Brief** da funcionalidade.  
- Se o `REPOMIX.md` for muito grande, use apenas trechos relevantes junto com o Brief.

Veja `AI_GUIDE.md` para instruções detalhadas de prompts.

---

## 8) Versionamento & Release

- Esquema: `YY.MM.DD.<timestamp-ms>` (ex.: `25.09.10.1757519311000`).  
- O CI atualiza `manifest.json` (e `package.json`, se existir), cria tag e GitHub Release.  
- `CHANGELOG.md` é atualizado automaticamente com os commits desde a última tag.  
- Workflow: `.github/workflows/release.yml`.  

---

## 9) Checklists práticos

### Nova feature
- [ ] Breadcrumb/URL conferidos  
- [ ] UI idempotente (não duplica)  
- [ ] Logs claros e namespaced  
- [ ] Usa apenas `ctx.utils`  
- [ ] Registrada em `domains/<subdomínio>/main.js`  
- [ ] Testada manualmente + prints  

### Antes do PR
- [ ] Rodou localmente e verificou console?  
- [ ] Anexou prints/GIFs?  
- [ ] Explicou objetivo/valor da mudança?  
- [ ] (Opcional) Colou o prompt usado com IA?  
