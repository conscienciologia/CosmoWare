# AI Guide — Como usar IA para criar e manter funcionalidades do CosmoWare

> **Objetivo**: tornar o CosmoWare um projeto **IA-friendly** de ponta a ponta.  
> Este guia mostra como **planejar, gerar, revisar e manter** funcionalidades inteiras **usando IA**, a partir do `REPOMIX.md`.

---

## 1) Estratégia recomendada de uso do RepoMix

### 🔹 Estratégia Híbrida (recomendada)
- Sempre inicie colando o **`REPOMIX.md` atualizado** no chat da IA (ou forneça o link, se o modelo suportar).  
- Depois acrescente um **Brief estruturado** da funcionalidade desejada (veja abaixo).  
- Se o `REPOMIX.md` for muito grande para o modelo:
  - Use apenas os trechos mais relevantes (ex.: `core/utils.js`, `core/global-rules.js`, `domains/<domínio>/main.js`, exemplos próximos ao que você quer implementar).  
  - Sempre acrescente o Brief.  

Assim a IA entende o **contexto global** (arquitetura e convenções) e também o **objetivo específico** (Brief).

### Outras opções
- **Importar só o REPOMIX.md**: funciona bem em modelos com grande contexto.  
- **Importar só trechos específicos**: útil em prompts rápidos ou para modelos com limite menor, mas pode gerar inconsistências.  

---

## 2) Workflow IA-first

1. **Obtenha contexto**  
   - Use o `REPOMIX.md` atualizado pelo CI.  
   - Cole no chat da IA.  

2. **Escreva o Brief da funcionalidade** (template abaixo).  

3. **Conduza prompts incrementais**:  
   - Etapa 1: IA revisa o Brief, sugere ajustes e confirma entendimento.  
   - Etapa 2: IA gera versão **mínima com logs** (somente toolbar e botões, sem lógica pesada).  
   - Etapa 3: Você testa manualmente (console/logs).  
   - Etapa 4: IA adiciona funcionalidades reais (CSV, Kroki, etc.).  

4. **Teste manualmente** a extensão.  

5. **Itere com a IA** usando prompts de refino/depuração.  

6. **Abra PR** com checklist preenchido e, se possível, o prompt utilizado.  

---

## 3) Template de Brief

```
# Brief de funcionalidade (CosmoWare / IA)

## Domínio e Tela
- Domínio: icnet.conscienciologia.org.br
- Breadcrumb (não normalizado): Pessoa Física » Voluntário
- URL(s) típica(s): https://icnet.conscienciologia.org.br/main.aspx#

## Objetivo
Ex.: Exportar tabela de voluntários em CSV.

## Entradas da página (amostra real de HTML)
Cole trechos relevantes:
- Breadcrumb (#TbPathAndNavigation #lbPath)
- Div FormEntry + tabela GridStyle
- Exemplo de linhas relevantes

## Resultado Esperado
- Toolbar antes da tabela com botão: Exportar (ícone CSV)
- Exporta tabela inteira para CSV (UTF-8 BOM, CRLF)
- Nome do arquivo: icnet-<ic>-<breadcrumb>-<timestamp>.csv

## Critérios de Aceitação
- Só atua quando breadcrumb = “Pessoa Física » Voluntário”
- Não duplica UI (idempotência)
- Logs com prefixo [ICNET/EXPORT]
- Erros tratados no console de forma clara
- Compatível com iframes

## Observações
- Usar ctx.utils e regras globais (global-rules.js)
- IDs/Classes com prefixo cosmoware-
- Testar primeiro com logs, depois gerar CSV de fato
```

---

## 4) Prompt Base — Geração de Módulo

```
Você é um assistente desenvolvedor do projeto CosmoWare. 
Considere **todo o contexto em REPOMIX.md** e o seguinte **Brief** (abaixo). 
Vamos implementar de forma incremental:

1. Primeiro, confirme entendimento do Brief e sugira ajustes.  
2. Depois, gere versão mínima com logs (toolbar, botão, console.log).  
3. Após testes manuais, avance para versão completa (ex.: exportar CSV).

Regras:
- Estrutura: domains/<subdomínio>/<rota>/<nome>.js
- Use apenas ctx.utils (nsLogger, normalizeText, readBreadcrumb, attachSimpleObserver, krokiPlantUmlToPng, krokiPlantUmlToSvg, timeStampCompact, regras globais)
- Valide breadcrumb antes de atuar
- Idempotência (não duplicar UI)
- Logs com namespace fixo (ex.: [ICNET/EXPORT])
- IDs/classes com prefixo cosmoware-
```

---

## 5) Prompt Base — Registro no Router

```
Gere o snippet para registrar a rota no arquivo domains/<subdomínio>/main.js,
seguindo o padrão do projeto:

- `name`: caminho legível da tela
- `match(ctx)`: verificação do breadcrumb (use normalizeText só para comparar)
- `loader()`: import dinâmico via chrome.runtime.getURL

Inclua também checklist de testes manuais para validar a rota.
```

---

## 6) **Erros comuns e como evitar**

### nsLogger
- Sempre crie com namespace fixo: `[ICNET/FEATURE]`.

### normalizeText
- Use somente para comparações. Nunca normalize textos exibidos.

### Breadcrumbs
- Cada domínio pode ter **estrutura diferente**.  
- ICNet: use último breadcrumb (`#TbPathAndNavigation #lbPath`).  
- Outros domínios terão regras próprias (coloque em `<domínio>-utils.js`).  

### Idempotência
- Use guards globais e atributos `data-cosmoware-*`.  

### Toolbar
- Sempre discreta, idempotente, à esquerda.  
- Reaproveite libs já carregadas no frame (Bootstrap, Font Awesome).  
- Se ícones não carregarem → fallback em emoji.

### Arquivos gerados
- Sempre use `core/global-rules.js` para normalizar nomes.  
- Formato: `<domínio>-<ic>-<breadcrumb>-<timestamp>.<ext>`  
- Tokens: minúsculos, sem acentos, `_` como separador.

### CSV (ICNet)
- Escopo: apenas `div.FormEntry > table.GridStyle`.  
- Sem suporte a `colspan`.  
- Apenas uma tabela por FormEntry.  
- UTF-8 BOM + CRLF.  

---

## 7) Snippet de toolbar (mínima com logs)

```js
const bar = document.createElement("div");
bar.className = "cosmoware-toolbar";
bar.textContent = "Toolbar CosmoWare — Modo mínimo (logs)";
console.log("[ICNET/EXPORT] toolbar criada");
```

---

## 8) Checklist de Aceitação

- [ ] Atua somente na tela correta (breadcrumb igual ao alvo)  
- [ ] Não duplica UI (idempotência)  
- [ ] Logs claros e padronizados `[ICNET/... ]`  
- [ ] Usa apenas `ctx.utils`  
- [ ] Compatível com iframes  
- [ ] Arquivo em `domains/<domínio>/<rota>/<feature>.js`  
- [ ] Rota registrada em `domains/<domínio>/main.js`  
- [ ] Funciona incrementalmente (primeiro logs, depois funcionalidade completa)  
- [ ] Nome de arquivos normalizado pelas regras globais  
- [ ] Testado manualmente (console + UI)  
- [ ] Prompt usado documentado no PR  

---

## 9) Exemplos no Repositório

- `domains/icnet/shared/export-grid.js` (mínimo com logs → CSV)  
- `domains/icnet/pessoa-fisica/voluntario/organograma-voluntarios.js`  
- `domains/icnet/main.js`  
- `core/utils.js`  
- `core/global-rules.js`  
- `domains/icnet/icnet-utils.js`

> Estes arquivos estão sempre no `REPOMIX.md` e servem como exemplos.
