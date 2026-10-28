# Guia de passagem do GestorCC

Para quem vai cuidar do GestorCC depois de mim: onde tudo fica, quem é dono de cada conta, como publicar uma atualização e o que fazer quando algo dá errado.

O GestorCC foi desenvolvido por Lionel Brondani, bolsista do Centro de Convenções da UFSM, de forma gratuita. O código é aberto: <https://github.com/lionelbrondani/GestorCC>.

> **Senhas não ficam neste documento.** Guarde as senhas das contas num lugar seguro do setor e passe-as pessoalmente.

---

## 1. Em uma página

| O quê | Onde | Dono |
|---|---|---|
| Site (o que todos acessam) | <https://gestorcc-ae6f8.web.app> | Firebase, conta **gestorcc.webapp@gmail.com** |
| API (o "motor" do site) | Projeto Apps Script **GestorCC API - produção** | Conta Google do setor |
| Dados | Pasta **GestorCC** no Drive: planilhas Dados, Sigiloso e Relatórios | Conta Google do setor |
| Agenda | Agenda Google **Centro de Convenções UFSM** | Conta Google do setor |
| Código | <https://github.com/lionelbrondani/GestorCC> | GitHub |
| Manual de uso | Item **Manual** no menu do próprio site | — |

**Custo: zero.** Usamos só os planos gratuitos do Google (Apps Script, Planilhas, Drive, Agenda) e do Firebase (plano Spark, sem cartão cadastrado). Não cadastre cartão de crédito no Firebase.

**No primeiro dia:**
1. Confirme que você tem acesso às três contas (setor, gestorcc.webapp e GitHub). Veja a seção 3.
2. Entre no site com a sua conta de gestor.
3. Leia o **Manual**, no menu do site.
4. Leia as seções 6 (publicar) e 7 (problemas comuns) deste guia.

---

## 2. Como o sistema funciona

O **site** fica no Firebase e roda no navegador ou no celular. Ele conversa com a **API**, um Apps Script na conta do setor. A API guarda tudo em **planilhas Google** e cria os eventos na **agenda Google** do setor.

As planilhas ficam na pasta **GestorCC** do Drive da conta do setor:

| Planilha ou pasta | O que guarda | Quem pode abrir |
|---|---|---|
| **GestorCC - Dados** | Pessoas, eventos, sessões, escalas, contratos, almoxarifado, fichas… | Só a conta do setor (e quem administra) |
| **GestorCC - Sigiloso** | CPF, dados bancários, senhas (cifradas), contratantes, dados do responsável da ficha, nomes das cortesias | **Nunca compartilhar** |
| **GestorCC - Relatórios** | Abas prontas para consulta: agenda, escala, pagamentos, estoque, contratos | Pode ser compartilhada para leitura |
| Backups/ | Cópia diária das três planilhas (guarda 30 dias) | Mesmo cuidado da Sigiloso |
| Modelos/ | Modelos Google Docs dos contratos e termos | — |
| Documentos gerados/, Contratos/, Fichas técnicas/, Infraestrutura/ | Arquivos gerados e anexos | Não compartilhar publicamente |

**Pode editar as planilhas à mão?** Sim, com cuidado: não apague colunas nem renomeie abas. O sistema percebe a edição e atualiza o que mostra. Se algo parecer desatualizado, rode o `instalar` (seção 5).

---

## 3. Contas e acessos

| Conta | Para que serve | Recomendação |
|---|---|---|
| **Conta Google do setor** | Dona do Apps Script, das planilhas, da pasta GestorCC e da agenda | Pelo menos duas pessoas do setor com acesso |
| **gestorcc.webapp@gmail.com** | Dona do site no Firebase | A senha fica com o setor; ative a verificação em duas etapas |
| **GitHub** (`lionelbrondani/GestorCC`) | Código-fonte | Peça para ser colaborador, ou que o repositório seja transferido para uma conta do setor |
| Sua conta de **gestor no GestorCC** | Usar o sistema | Criada em **Pessoas**, com o modelo de permissão "gestor" |

**Ao assumir:**
- No Apps Script, em **Configurações do projeto → Propriedades do script**, troque `EMAIL_PRIMEIRO_GESTOR`, `NOME_PRIMEIRO_GESTOR` e `MATRICULA_PRIMEIRO_GESTOR` para os seus dados. Elas são usadas pelo `recuperarAcessoGestor` e pelo `resetarDados`.
- Quando eu sair, desative o meu cadastro em **Pessoas** (não precisa apagar).
- **Login com Google:** o ID do cliente OAuth fica no Google Cloud do projeto `gestorcc-ae6f8` (conta gestorcc.webapp), na propriedade `GOOGLE_CLIENT_ID` do Apps Script e no `VITE_GOOGLE_CLIENT_ID` do site. O passo a passo está em `docs/implantacao.md`, seção 26.

---

## 4. Rotina do dia a dia

O passo a passo de cada tela está no **Manual**, dentro do site. Em resumo:

- **Equipe:** **Pessoas → Nova pessoa**. A senha inicial é a matrícula. Para quem esqueceu a senha, use **Redefinir senha para a matrícula**.
- **Eventos:** **Agenda → Novo evento**. Montagem, passagem de som e desmontagem são **atividades de apoio** do evento.
- **Escalas:**
  1. **Disponibilidade:** abrir a rodada.
  2. **Montar:** escalar evento a evento e publicar.
  3. **Presença:** depois do evento, confirmar quem foi.
  4. **Apoio:** escalar os bolsistas fixos nas atividades de apoio.
- **Pagamentos:** lote das diárias e ficha de indicação.
- **Ficha técnica e cortesias:** gerar os links no evento e mandar ao produtor e aos destinos.
- **Relatório mensal:** panorama do setor para imprimir.

**E-mails:** o GestorCC **só envia e-mail quando alguém clica em Enviar**, depois de ver e poder editar a mensagem. Nada sai sozinho. Contas gmail.com têm um limite de cerca de 100 destinatários por dia.

---

## 5. Rotinas automáticas e funções do editor

**Automáticas (criadas pelo `instalar`):**

| Gatilho | Quando | O que faz |
|---|---|---|
| `gatilhoMinutos` | A cada 5 minutos | Refaz o que a agenda Google não aceitou, importa o formulário de problemas e atualiza a planilha de Relatórios |
| `backupDiario` | Todo dia às 3h | Copia as três planilhas para Backups/ e apaga as cópias com mais de 30 dias |
| `aoAlterarPlanilha` | Quando alguém edita a planilha à mão | Avisa o sistema para reler os dados |

Nenhuma rotina automática manda e-mail.

**Funções que você roda no editor do Apps Script** (escolha a função no alto e clique em **Executar**):

| Função | Quando usar |
|---|---|
| `instalar` | Depois de colar um `Code.js` novo, quando a versão pedir, ou se aparecer "Aba … não encontrada". Pode rodar quantas vezes quiser: não duplica nada. |
| `recuperarAcessoGestor` | O gestor das propriedades perdeu o acesso: a senha dele volta a ser a matrícula. |
| `resetarDados` | ⚠️ **Apaga tudo** (pessoas, eventos, escalas, contratos…), menos o gestor das propriedades, os itens do almoxarifado, as configurações e os feriados. **Só use para recomeçar do zero**, e confira antes se existe um backup recente. |
| `criarDadosFicticios` | Só para testes: cria pessoas e eventos "TESTE". Depois, rode `resetarDados`. |

---

## 6. Como publicar uma atualização

**Sempre nesta ordem: primeiro a API, depois o site.**

### 6.1 Preparar o computador (uma vez)
1. Instale o **Node.js** (versão LTS) e o **Git**.
2. Baixe o código: `git clone https://github.com/lionelbrondani/GestorCC.git` e, dentro da pasta, rode `npm install`.
3. Crie o arquivo **`app/.env.producao`**, que não fica no GitHub, com:

   ```
   VITE_API_URL=<endereço /exec da API: Apps Script → Implantar → Gerenciar implantações>
   VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais,pagamentos,almoxEstoque,almoxSaidas,infraestrutura,relatar,contratos,busca
   VITE_GOOGLE_CLIENT_ID=<ID do cliente OAuth, se o login com Google estiver ligado>
   ```

4. Copie o `.firebaserc.exemplo` para `.firebaserc` (também fica fora do GitHub) e troque os campos: projeto e site de produção `gestorcc-ae6f8`, site de teste `gestorcc-teste`.
5. Entre no Firebase com a conta do site: `npm run firebase -- login`, com **gestorcc.webapp@gmail.com**.

### 6.2 Testar a mudança
- `npm test` roda todos os testes; precisam passar.
- `npm run dev` abre o site no **modo protótipo**, com dados fictícios, em <http://localhost:5173>.

### 6.3 Publicar a API
O `clasp` (envio automático) é bloqueado na conta do setor, então a API é publicada colando o código:
1. `npm run build -w api` gera `api/dist/Code.js` e `api/dist/appsscript.json`.
2. No editor do Apps Script (**GestorCC API - produção**), substitua o conteúdo do `Código.gs` pelo `Code.js`. Se o manifesto mudou, substitua também o `appsscript.json`. Salve.
3. Se a versão pedir, ou na dúvida, rode **`instalar`**. Ele cria abas e colunas novas e não apaga nada.
4. **Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar.**
5. Abra o endereço `/exec` no navegador: deve aparecer a versão nova (`{"ok":true,"dados":{"versao":"…"}}`).

### 6.4 Publicar o site
`npm run deploy:app:producao`. Depois, recarregue o site uma ou duas vezes, porque o navegador guarda a versão anterior.

O histórico de cada versão e o que cada uma pediu na publicação está em `docs/implantacao.md`, no repositório.

---

## 7. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "Algo deu errado do nosso lado. Detalhe: Aba … não encontrada (rode instalar())" | Rodar o `instalar` |
| "Algo deu errado…" com outro detalhe | O detalhe aparece para quem administra as Configurações. Anote, veja em **Execuções** no Apps Script e procure no repositório |
| "O sistema está ocupado" | Tentar de novo em alguns segundos |
| Dado desatualizado depois de editar a planilha à mão | Recarregar o site; se continuar, rodar o `instalar` |
| O site mostra a versão antiga | Recarregar a página ou fechar e abrir o navegador |
| O gestor das propriedades perdeu o acesso | Rodar `recuperarAcessoGestor` |
| Pedido de autorização ao rodar uma função | Aceitar com a conta do setor (o Google pede de novo quando entra uma permissão nova) |
| `/exec` mostra a versão antiga | Faltou criar a **Nova versão** em Gerenciar implantações |
| Evento não aparece na agenda Google | O gatilho de 5 minutos tenta de novo sozinho. Confira em **Execuções** se há erro |
| Quer ver se está tudo funcionando | **Configurações → Saúde do sistema**: último backup, rotinas, agenda, e-mails e erros recentes |

---

## 8. Dados pessoais e LGPD

- **Sigilosos:** CPF, dados bancários, dados do responsável da ficha técnica e nomes e matrículas das cortesias ficam na planilha **Sigiloso**. Não compartilhe essa planilha nem a pasta Backups.
- **Na tela:** só quem tem permissão vê esses dados. Os bolsistas veem só os próprios.
- **Fora do sistema:** não copie dados pessoais para planilhas, e-mails ou grupos fora do GestorCC.
- **E-mails do sistema:** cada pessoa recebe o seu e não vê os endereços dos outros. O histórico guarda quem mandou, o assunto e quantas pessoas, sem os endereços.
- **Pessoas que saem:** desative o cadastro em vez de apagar, para manter o histórico. Para apagar dados de alguém a pedido da pessoa, remova as linhas dela nas planilhas Dados e Sigiloso.
- **Dados de teste:** os fictícios usam e-mails `@teste.invalid` e nomes "TESTE"; o `resetarDados` remove todos.
- **Limpeza automática:** depois do evento, o sistema apaga os nomes das cortesias (90 dias) e os dados do responsável da ficha (180 dias). Os prazos ficam em **Configurações → Dados pessoais (LGPD)**, e os backups guardam esses dados por mais 30 dias.

---

## 9. Mover o site para a conta gestorcc.webapp@gmail.com

Mantém o mesmo endereço (`gestorcc-ae6f8.web.app`). Nada muda para quem usa.

1. Entre no <https://console.firebase.google.com> com a conta que hoje é dona do projeto `gestorcc-ae6f8`.
2. Abra o projeto e vá na **engrenagem → Usuários e permissões → Adicionar membro**. Informe `gestorcc.webapp@gmail.com`, papel **Proprietário**.
3. Entre no Gmail de **gestorcc.webapp@gmail.com** e aceite o convite.
4. No computador: `npm run firebase -- logout` e depois `npm run firebase -- login`, com a conta nova.
5. Teste com `npm run deploy:app:producao`.
6. Funcionou? Se quiser, remova a conta antiga em **Usuários e permissões**.
7. Confira que o projeto continua no plano **Spark** (gratuito), sem conta de faturamento.

---

## 10. Checklist da passagem

- [ ] Acesso à conta Google do setor (Apps Script, Drive, Agenda)
- [ ] Acesso a gestorcc.webapp@gmail.com, com verificação em duas etapas
- [ ] Proprietário do projeto no Firebase
- [ ] Colaborador (ou dono) do repositório no GitHub
- [ ] Conta de gestor no GestorCC
- [ ] Propriedades `EMAIL_PRIMEIRO_GESTOR`, `NOME_PRIMEIRO_GESTOR` e `MATRICULA_PRIMEIRO_GESTOR` com os dados do novo responsável
- [ ] Publicou uma atualização de teste seguindo a seção 6 (pode ser a mesma versão)
- [ ] Sabe rodar `instalar` e `recuperarAcessoGestor`
- [ ] Leu a seção 8 (dados pessoais)
- [ ] Sabe onde ficam os backups

---

## 11. Contato

Lionel Brondani: lionel.brondani@acad.ufsm.br. Sugestões e erros também podem ser registrados como *Issues* no GitHub.
