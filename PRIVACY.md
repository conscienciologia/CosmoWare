# Política de Privacidade — CosmoWare (Extensão Chrome)

**Última atualização:** 2025-09-16  
**Finalidade única:** A extensão **CosmoWare** adiciona botões e automações no domínio **ICnet** (`*.conscienciologia.org.br`) para **exportar tabelas visíveis** (ex.: grades) e **gerar organogramas** a partir do conteúdo exibido ao usuário na própria página.

---

## 1. Quais dados coletamos

**Não coletamos, vendemos, compartilhamos ou monetizamos dados pessoais.**  
A extensão não implementa analytics, telemetria ou publicidade.

- **Sem conta e sem login.**
- **Sem coleta de histórico de navegação.**
- **Sem captura de formulários ou campos sensíveis.**

## 2. Como os dados são processados

Todo o processamento ocorre **localmente no seu navegador**, sobre o **conteúdo visível** da aba do ICnet quando você **aciona** a extensão (ex.: clique em “Extensão/Exportar”).

- Os arquivos gerados (CSV/planilhas, imagens de organograma) são criados **localmente** e **baixados por você**.
- Não mantemos cópias em servidores próprios.

## 3. Permissões e justificativas

- **`activeTab`**: usada **somente após ação do usuário** para ler o DOM da aba ativa do ICnet e executar a automação solicitada (ex.: exportar a grade visível). O acesso é **temporário** e limitado à aba ativa.
- **`scripting`**: injeta **scripts empacotados** na própria extensão para inserir botões/menus e ler elementos da página do ICnet quando você solicita a ação. **Não** há execução contínua em segundo plano nem monitoramento de navegação.
- **Permissões de host**:
  - `https://*.conscienciologia.org.br/*` — necessário para operar nas páginas do ICnet.
  - `https://kroki.io/*` — **opcional**, usado apenas quando você escolhe gerar imagem do organograma via serviço Kroki. Enviamos **somente o texto do diagrama** e recebemos a imagem resultante. **Não** enviamos dados pessoais.

## 4. Código remoto

**Não executamos código remoto.** Todo o código da extensão é empacotado (Manifest V3). Chamadas de rede (ex.: Kroki) retornam **dados/imagens**, não código executável.

## 5. Armazenamento local

Podemos guardar **preferências de uso** (ex.: último formato escolhido) em armazenamento local do navegador. Você pode limpar esses dados a qualquer momento pelas configurações do navegador.

## 6. Retenção e exclusão

- **Retenção:** não mantemos dados em servidores.
- **Exclusão:** limpe o armazenamento local do navegador para remover preferências; exclua os arquivos gerados do seu próprio computador quando desejar.

## 7. Compartilhamento com terceiros

**Não compartilhamos** dados com terceiros. O uso do **Kroki** (quando habilitado por você) envia **apenas** o texto do diagrama para gerar a imagem correspondente.

## 8. Segurança

Adotamos o princípio de **mínimo privilégio** (somente permissões necessárias) e processamento **local** sempre que possível. Recomendamos manter o navegador atualizado.

## 9. Crianças e público sensível

A extensão destina-se a **público geral** e não é direcionada a crianças. Não processamos categorias especiais de dados.

## 10. Alterações nesta política

Podemos atualizar esta política para refletir melhorias da extensão ou exigências legais. Publicaremos a nova versão no repositório do projeto e atualizaremos a data no topo deste documento.

## 11. Contato

Dúvidas ou solicitações sobre privacidade:  
Abra uma **issue** no repositório do projeto ou entre em contato pelo e‑mail do mantenedor (substitua aqui pelo seu contato oficial).

---

**Resumo:** a CosmoWare tem **propósito único** (automatizar exportações e organogramas no ICnet), usa permissões **estritamente necessárias**, processa dados **localmente**, **não coleta** dados pessoais e **não executa código remoto**.

# Privacy Policy — CosmoWare (Chrome Extension)

**Last updated:** 2025-09-16  
**Single purpose:** The **CosmoWare** extension adds buttons and automations on the **ICnet** domain (`*.conscienciologia.org.br`) to **export visible tables** (e.g., grids) and **generate org charts** from the content already displayed to the user on the page.

---

## 1. What data we collect

**We do not collect, sell, share, or monetize personal data.**  
The extension does not implement analytics, telemetry, or advertising.

- **No account and no sign‑in.**
- **No browsing history collection.**
- **No capture of forms or sensitive fields.**

## 2. How data is processed

All processing happens **locally in your browser**, on the **visible content** of the ICnet tab when **you trigger** the extension (e.g., clicking “Extension/Export”).

- Generated files (CSV/spreadsheets, org chart images) are created **locally** and **downloaded by you**.
- We do not keep copies on our own servers.

## 3. Permissions and justifications

- **`activeTab`** — used **only after user action** to read the DOM of the active ICnet tab and perform the requested automation (e.g., export the visible grid). Access is **temporary** and limited to the active tab.
- **`scripting`** — injects **packaged scripts** from the extension itself into ICnet pages to add buttons/menus and read page elements (tables, org charts) when you ask for it. **No** continuous background execution and **no** navigation tracking.
- **Host permissions:**
  - `https://*.conscienciologia.org.br/*` — required to operate on ICnet pages.
  - `https://kroki.io/*` — **optional**, used only when you choose to generate an org chart image via the Kroki service. We send **only the diagram text** and receive the resulting image. **No** personal data is sent.

## 4. Remote code

**We do not execute remote code.** All extension code is packaged (Manifest V3). Network calls (e.g., Kroki) return **data/images**, not executable code.

## 5. Local storage

We may store **usage preferences** (e.g., last chosen format) in the browser’s local storage. You can clear these at any time via your browser settings.

## 6. Retention and deletion

- **Retention:** we do not keep data on our servers.
- **Deletion:** clear the browser’s local storage to remove preferences; delete the generated files from your computer whenever you want.

## 7. Sharing with third parties

**We do not share** data with third parties. Using **Kroki** (when explicitly enabled by you) sends **only** the diagram text necessary to render the image.

## 8. Security

We follow the principle of **least privilege** (only the permissions necessary) and **local** processing whenever possible. Keep your browser up to date.

## 9. Children and sensitive audiences

This extension is intended for a **general audience** and is not directed at children. We do not process special categories of data.

## 10. Changes to this policy

We may update this policy to reflect improvements or legal requirements. We will publish the new version in the project repository and update the date at the top of this document.

## 11. Contact

Questions or privacy requests:  
Open an **issue** in the project repository or contact the maintainer by email (replace with your official contact).

---

**Summary:** CosmoWare has a **single purpose** (automate exports and org charts on ICnet), uses **strictly necessary** permissions, processes data **locally**, **does not collect** personal data, and **does not execute remote code**.
