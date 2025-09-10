# AI Guide — Como usar IA para criar e manter funcionalidades do CosmoWare

> **Objetivo**: tornar o CosmoWare um projeto **IA-friendly** de ponta a ponta.  
> Este guia mostra como **planejar, gerar, revisar e manter** funcionalidades inteiras **usando IA**, a partir do `REPOMIX.md`.

---

## 1) Estratégia recomendada de uso do RepoMix

### 🔹 Estratégia Híbrida (recomendada)
- Sempre inicie colando o **`REPOMIX.md` atualizado** no chat da IA (ou forneça o link, se o modelo suportar).  
- Depois acrescente um **Brief estruturado** da funcionalidade desejada (veja abaixo).  
- Se o `REPOMIX.md` for muito grande para o modelo:
  - Use apenas os trechos mais relevantes (ex.: `core/utils.js`, `domains/<domínio>/main.js`, exemplos próximos ao que você quer implementar).  
  - Sempre acrescente o Brief.  

Assim a IA entende o **contexto global** (arquitetura e convenções) e também o **objetivo específico** (Brief).

### Outras opções
- **Importar só o REPOMIX.md**: funciona bem em modelos com grande contexto.  
- **Importar só trechos específicos**: útil em prompts rápidos ou para modelos com limite menor, mas pode gerar inconsistências.  

---

## 2) Workflow IA-first

1. **Obtenha contexto**  
   - Gere o `REPOMIX.md` local (`npx repomix`) ou use o do repositório (atualizado pelo CI).  
   - Cole o conteúdo no chat da IA.  

2. **Escreva o Brief da funcionalidade** (template abaixo).  

3. **Use o Prompt Base de Geração de Módulo**.  

4. **Teste manualmente** a extensão.  

5. **Itere com a IA** usando prompts de refino/depuração.  

6. **Abra PR** com checklist preenchido e, se possível, o prompt utilizado.  

---

## 3) Template de Brief

```
# Brief de funcionalidade (CosmoWare / IA)

## Domínio e Tela
- Domínio: icnet.conscienciologia.org.br
- Breadcrumb (normalizado): administrador » configuração ic » organograma
- URL(s) típica(s): https://icnet.conscienciologia.org.br/main.aspx#, /verpon/app/grid.aspx?f=1028

## Objetivo
Ex.: Extrair tabela do organograma e gerar imagem (PlantUML via Kroki) com toolbar (Atualizar / Baixar PNG).

## Entradas da página (amostra real de HTML)
Cole aqui trechos relevantes:
- Breadcrumb (#TbPathAndNavigation #lbPath)
- Tabela (#Grid1)
- Exemplo de linhas relevantes

## Resultado Esperado
- Toolbar discreta antes da tabela com botões X, Y…
- Geração de imagem PNG e link de download
- Nome do arquivo: <IC>-<timestamp>.png

## Critérios de Aceitação
- Só atua quando breadcrumb = “administrador » configuração ic » organograma”
- Não duplica UI (idempotência)
- Logs com prefixo [ICNET/ORG]
- Erros tratados no console de forma clara
- Compatível com iframes

## Observações
- Usar ctx.utils (nsLogger, readBreadcrumb, krokiPlantUmlToPng, timeStampCompact, attachSimpleObserver)
- IDs/Classes com prefixo cosmoware-
```

---

## 4) Prompt Base — Geração de Módulo

```
Você é um assistente desenvolvedor do projeto CosmoWare. 
Considere **todo o contexto em REPOMIX.md** e o seguinte **Brief** (abaixo). 
Gere um **módulo ES Module** que exporte `export async function init(ctx) { ... }`, 
e siga estes requisitos:

- Estrutura: domains/<subdomínio>/<rota>/<nome>.js
- Independente (não importa outra feature)
- Use apenas ctx.utils (nsLogger, normalizeText, readBreadcrumb, attachSimpleObserver, krokiPlantUmlToPng, timeStampCompact)
- Valide breadcrumb antes de atuar
- Idempotência (não duplicar UI)
- Logs com namespace fixo (ex.: [ICNET/ORG])
- IDs/classes com prefixo cosmoware-
- Comente trechos críticos

### Brief
[COLE AQUI O BRIEF]

### Entregue:
1) Código completo do módulo
2) Lista de seletores utilizados e justificativa
3) Logs esperados no console
```

---

## 5) Prompt Base — Registro no Router

```
Gere o snippet para registrar a rota no arquivo domains/<subdomínio>/main.js, 
seguindo o padrão do projeto:

- `name`: caminho legível da tela
- `match(ctx)`: verificação do breadcrumb
- `loader()`: import dinâmico via chrome.runtime.getURL

Além do snippet, diga onde colar e gere checklist de testes manuais.  
Breadcrumb alvo: "administrador » configuração ic » organograma".
```

---

## 6) Prompts de Refino

### Seletores/breadcrumb não batem
```
Os seletores ou breadcrumb não estão casando. 
Aqui estão os logs e HTML coletado:

[cole logs/HTML]

Por favor:
- Ajuste seletores para iframes
- Garanta idempotência
- Liste logs esperados
```

### UI duplicada
```
A UI está sendo inserida mais de uma vez. 
Revise o módulo para idempotência com flag global e uso correto de observer.
```

### Logs confusos
```
Padronize logs com nsLogger e namespace fixo.  
Mostre timeline de eventos esperada.
```

---

## 7) Checklist de Aceitação

- [ ] Atua somente na tela correta  
- [ ] Não duplica UI  
- [ ] Logs claros e padronizados  
- [ ] Usa apenas ctx.utils  
- [ ] Compatível com iframes  
- [ ] Arquivo em domains/<domínio>/<rota>/<feature>.js  
- [ ] Rota registrada em main.js  
- [ ] Testado manualmente  
- [ ] Prompt usado documentado no PR  

---

## 8) Dicas de HTML no Prompt

- Copie trechos reais do DOM (breadcrumb, tabela, botões)  
- Inclua variações (linhas pares/impares)  
- Informe se há iframes  

---

## 9) Exemplos de Critérios de Aceitação

- “Exibir toolbar com botões antes da tabela #Grid1”  
- “Gerar PNG via Kroki”  
- “Nome do arquivo <IC>-<timestamp>.png”  
- “Log final: Organograma renderizado com sucesso. Nós: N”  
- “Nunca renderizar fora do breadcrumb alvo”  

---

## 10) Automação com RepoMix

- O `REPOMIX.md` é atualizado automaticamente no GitHub Actions.  
- Sempre inicie a geração com IA usando o `REPOMIX.md` **+ Brief**.  
- Se o arquivo for grande demais, use apenas trechos essenciais.  
- Reexecute IA após atualizações no repositório para manter consistência.  

---

## 11) Prompts auxiliares

**Refatorar para padrão CosmoWare**
```
Reescreva este módulo para o padrão CosmoWare:
- exporta init(ctx)
- usa apenas ctx.utils
- logs com nsLogger
- idempotência
- comentários críticos
[cole código aqui]
```

**Gerar descrição de PR**
```
Gere descrição de PR no padrão CosmoWare:
- O que foi feito
- Prints
- Logs esperados
- Checklist
```

**Changelog curto**
```
Gere changelog curto no formato semântico (feat, fix, chore).
```

---

## 12) Segurança

- Nunca logar dados pessoais  
- Usar Kroki apenas para texto de diagrama  
- Se houver dados sensíveis → mascarar/remover e documentar no PR  

---

## 13) Exemplos no Repositório

- `domains/icnet/administrador/configuracao-ic/organograma.js`  
- `domains/icnet/main.js`  
- `core/utils.js`  

> Estes arquivos estão sempre no `REPOMIX.md` e servem como exemplos.
