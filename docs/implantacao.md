# Publicação do GestorCC — passo a passo

Este guia é para quem cuida do GestorCC no setor. Ele explica como colocar o sistema no ar, como atualizar e como recuperar um backup. Não precisa saber programar: basta seguir os passos na ordem e copiar os comandos.

O GestorCC tem duas partes:

- **A API**, que roda no Google Apps Script e guarda tudo em planilhas do Google Drive.
- **O app**, que é o site que a equipe abre no celular ou no computador. Ele fica no Firebase Hosting.

As duas partes existem em dois ambientes:

- **teste**, para experimentar sem medo;
- **produção**, que é o que a equipe usa.

Tudo cabe nos planos gratuitos do Google e do Firebase, sem cartão de crédito.

## 1. O que é preciso antes de começar

- Uma conta Google do setor. É ela que vai ser dona das planilhas e da API.
- Uma conta Google para o site (Firebase). Pode ser a do setor ou outra conta gratuita, se a do setor não tiver acesso ao Firebase. O site não guarda nenhum dado: ele só conversa com a API.
- No computador:
  - [Node.js](https://nodejs.org) versão 20 ou mais nova;
  - a pasta do projeto, já com `npm install` rodado na raiz.

## 2. Gerar o código da API

Abra o terminal na pasta do projeto e rode:

```
npm run build -w api
```

Isso gera dois arquivos na pasta `api/dist`:

- `Code.js`: a API inteira;
- `appsscript.json`: o manifesto.

O mesmo código serve para teste e para produção.

## 3. Criar os projetos da API (teste e produção)

Tudo pelo navegador, com a conta do setor:

1. Abra <https://script.google.com> e clique em **Novo projeto**.
2. Dê o nome **GestorCC API - teste**.
3. Em **Configurações do projeto** (ícone de engrenagem), marque **"Mostrar arquivo de manifesto 'appsscript.json' no editor"**.
4. Volte ao editor (ícone `< >`) e abra o `appsscript.json`. Troque todo o conteúdo pelo de `api/dist/appsscript.json`.
5. Abra o `Código.gs`, apague tudo e cole o conteúdo de `api/dist/Code.js`. Salve com Ctrl+S.
6. Confira a lista de funções na barra de cima. Devem aparecer `doPost`, `doGet`, `instalar`, `backupDiario` e `gatilhoMinutos`.
7. Repita os passos 1 a 6 para **GestorCC API - produção**.

> **Atalho opcional (clasp):** se a conta permitir a "API do Google Apps Script" (<https://script.google.com/home/usersettings>), dá para enviar o código pelo terminal em vez de colar:
>
> 1. Rode `npx clasp login` dentro de `api`.
> 2. Copie `api/ambientes/teste/.clasp.json.exemplo` para `.clasp.json` e cole nele o **ID do script**.
> 3. Rode `npm run deploy:api:teste`.
>
> Contas institucionais costumam bloquear o clasp. Nesse caso, siga o caminho manual acima.

## 4. Preencher as propriedades e rodar `instalar`

O `instalar` cria a pasta **GestorCC** no Drive com três planilhas:

- **GestorCC - Dados**: o dia a dia (pessoas, avisos, configurações). Pode ser vista pela equipe.
- **GestorCC - Sigiloso**: senhas cifradas, CPF e dados bancários. **Nunca compartilhe esta planilha.**
- **GestorCC - Relatórios**: visões para consulta. Ganha conteúdo nas próximas fases.

Ele também cria o primeiro gestor e liga duas rotinas automáticas:

- backup todo dia às 3h;
- verificação a cada 5 minutos, que acerta a agenda Google e as abas AGENDA da planilha de Relatórios.

A partir da fase 2, o `instalar` também cria a agenda Google **"Centro de Convenções UFSM"** na conta do setor (seção 13).

Antes de rodar, preencha as propriedades:

1. No projeto **GestorCC API - teste**, abra **Configurações do projeto → Propriedades do script → Adicionar propriedade**.
2. Crie estas três:

   | Propriedade | O que colocar |
   |---|---|
   | `EMAIL_PRIMEIRO_GESTOR` | e-mail de quem vai administrar o sistema (é o login dessa pessoa) |
   | `NOME_PRIMEIRO_GESTOR` | nome completo dessa pessoa |
   | `MATRICULA_PRIMEIRO_GESTOR` | matrícula dessa pessoa (vira a senha inicial) |

3. Abra o editor, escolha a função `instalar` na barra de cima e clique em **Executar**.
4. O Google pede autorização na primeira vez. Aceite com a conta do setor. O GestorCC não pede permissão para enviar e-mails: nenhum e-mail sai pelo sistema.
5. No registro de execução aparece `GestorCC instalado na pasta "GestorCC"`, com o link da pasta.

Pode rodar `instalar` de novo sem medo: ele não duplica nada que já existe.

## 5. Publicar a API

1. No editor do Apps Script, clique em **Implantar → Nova implantação**.
2. Em tipo, escolha **App da Web** e preencha:
   - **Executar como:** Eu (a conta do setor);
   - **Quem pode acessar:** Qualquer pessoa.
3. Clique em **Implantar** e copie o **URL do app da Web**. Ele termina em `/exec`.

"Qualquer pessoa" não abre os dados para o público. Qualquer pessoa consegue *falar* com a API, mas a API só responde a quem entrar com e-mail e senha, e só com o que essa pessoa tem permissão de ver.

Se a conta institucional da UFSM não mostrar a opção "Qualquer pessoa", pare aqui e avise. Existe um plano B, mas ele muda um pouco a publicação.

## 6. Criar o site no Firebase

Use a conta escolhida para o site no passo 1. Se for uma conta diferente da do setor, registre com a equipe quem é a dona: é ela que publica as versões novas do site.

1. Abra <https://console.firebase.google.com>.
2. Crie um projeto, por exemplo `gestorcc`. Fique no plano **Spark (gratuito)** e não ative o Google Analytics.
3. No menu **Hosting**, clique em **Começar** e siga até o fim.
4. Em **Hosting → Adicionar outro site**, crie dois sites, por exemplo `gestorcc-teste` e `gestorcc`.
5. Na raiz do projeto, copie `.firebaserc.exemplo` para `.firebaserc` e preencha:
   - o ID do projeto Firebase;
   - os nomes dos dois sites.
6. Entre com a conta do site:

   ```
   npm run firebase -- login
   ```

## 7. Configurar e publicar o app

1. Copie `app/.env.exemplo` para `app/.env.teste` e para `app/.env.producao`.
2. Em cada arquivo, preencha:
   - `VITE_API_URL`: o URL `/exec` da API **daquele** ambiente (passo 5);
   - `VITE_RECURSOS`: as áreas ligadas nesta fase. Áreas fora da lista aparecem como "Esta área chega numa próxima etapa." O valor de cada fase:

     | Fase | Valor |
     |---|---|
     | 1 | `VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes` |
     | 2 | `VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos` |
     | 3 | `VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais` |
     | 4 | `VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais,pagamentos` |
     | 5 | `VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais,pagamentos,almoxEstoque,almoxSaidas,infraestrutura,relatar` |
     | 6 | `VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais,pagamentos,almoxEstoque,almoxSaidas,infraestrutura,relatar,contratos` |
     | 7 | `VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais,pagamentos,almoxEstoque,almoxSaidas,infraestrutura,relatar,contratos,busca` |
3. Publique:

   ```
   npm run deploy:app:teste
   ```

4. Abra o endereço do site de teste e entre com o e-mail e a matrícula do primeiro gestor. O sistema pede uma senha nova na hora.

Quando o teste estiver aprovado, faça o mesmo para produção:

1. Repita os passos 4 e 5 no projeto **GestorCC API - produção**.
2. Publique o site de produção:

   ```
   npm run deploy:app:producao
   ```

Os arquivos `.env.teste`, `.env.producao` e `.firebaserc` ficam só no seu computador.

## 8. Compartilhar as planilhas com a equipe

- **GestorCC - Dados** e **GestorCC - Relatórios**:
  1. Clique em **Compartilhar**.
  2. Adicione os e-mails dos servidores e dos bolsistas gestores com o papel **leitor**.
  3. Ninguém além da conta do setor deve ser editor. Quem altera os dados é o sistema, e é isso que garante o histórico de quem mudou o quê.
- **GestorCC - Sigiloso**: **não compartilhe com ninguém.** Ela fica só com a conta do setor.

## 9. Importar a equipe pela aba `IMPORTAR_PESSOAS`

1. Abra **GestorCC - Sigiloso** e vá na aba `IMPORTAR_PESSOAS`.
2. Cole uma pessoa por linha, nas colunas:

   `NOME`, `EMAIL`, `MATRICULA`, `TIPO`, `VINCULO`, `CPF`, `BANCO`, `AGENCIA`, `CONTA`, `CAMISETA`, `NASCIMENTO`

   Regras de preenchimento:
   - `TIPO`: `servidor` ou `bolsista`;
   - `VINCULO`: `fixo` ou `eventual`;
   - os campos de CPF em diante são opcionais.
3. No GestorCC, abra **Pessoas e acessos → Importar da planilha → Importar agora**.
4. Confira o relatório:
   - quem já tinha cadastro com a mesma matrícula só tem os dados pessoais (CPF, banco, camiseta…) completados. O e-mail e o perfil dessa pessoa não mudam;
   - quem é novo entra com o perfil Eventual e a matrícula como senha inicial;
   - linhas com problema (CPF inválido, e-mail repetido…) aparecem com o número da linha. Corrija na planilha e importe de novo.
5. Ajuste os perfis de acesso de quem precisa de mais do que Eventual.
6. **Apague as linhas da aba `IMPORTAR_PESSOAS` depois de conferir.** Elas têm CPF e dados bancários que não precisam ficar ali.

## 10. Como atualizar para uma versão nova

1. Atualize a pasta do projeto e rode `npm install` na raiz.
2. Rode `npm test`. Tudo precisa passar.
3. Atualize o teste primeiro:
   1. Rode `npm run build -w api` e cole o `api/dist/Code.js` novo no `Código.gs` do projeto de teste. Salve. Quem usa o clasp roda `npm run deploy:api:teste`.
   2. No editor do Apps Script de teste, abra **Implantar → Gerenciar implantações**.
   3. Clique no lápis da implantação existente, escolha **Versão: Nova versão** e clique em **Implantar**. Assim o URL `/exec` continua o mesmo e o `.env` não muda.
   4. Rode `npm run deploy:app:teste` e confira o site.
4. Se estiver tudo certo, faça o mesmo no projeto de produção e rode `npm run deploy:app:producao`.

Se uma versão nova exigir `instalar` de novo (para criar abas novas), as notas da versão avisam.

## 11. Como restaurar um backup

Todo dia, às 3h, o sistema copia as três planilhas para a pasta **GestorCC/Backups/AAAA-MM-DD** e guarda os últimos 30 dias.

Para voltar uma planilha a um dia anterior:

1. Em **GestorCC/Backups**, abra a pasta do dia desejado.
2. Faça uma cópia da planilha que quer recuperar (**Arquivo → Fazer uma cópia**) e salve na pasta **GestorCC**.
3. Copie o ID da cópia: é o trecho do endereço entre `/d/` e `/edit`.
4. No projeto do Apps Script, em **Propriedades do script**, troque o valor da propriedade dessa planilha pelo ID novo:

   | Planilha | Propriedade |
   |---|---|
   | Dados | `DADOS_ID` |
   | Sigiloso | `SIGILOSO_ID` |
   | Relatórios | `RELATORIOS_ID` |

5. Renomeie a planilha antiga (por exemplo, "GestorCC - Dados (substituída)") para não confundir. Não apague: pode ser útil comparar.
6. Se a planilha restaurada for a de Dados ou a de Relatórios, compartilhe de novo com a equipe como **leitor**.

O que foi feito no sistema depois do horário do backup se perde. Por isso, avise a equipe antes de restaurar.

## 12. Se o gestor perder o acesso

Quem esquece a senha pede a um gestor. Ele abre **Pessoas e acessos**, escolhe a pessoa e usa **Redefinir senha para a matrícula**. O sistema mostra uma mensagem pronta para copiar e enviar por e-mail ou WhatsApp.

Use o passo a passo abaixo só quando **o próprio gestor** perder o acesso e não houver outro gestor para redefinir a senha dele.

1. Abra o projeto da API no Apps Script com a conta do setor.
2. Confira se as propriedades `EMAIL_PRIMEIRO_GESTOR` e `MATRICULA_PRIMEIRO_GESTOR` são de quem precisa entrar. Se não forem, troque pelos dados dessa pessoa: ela precisa já ter cadastro ativo no sistema.
3. Escolha a função `recuperarAcessoGestor` na barra de cima e clique em **Executar**.
4. Confira a mensagem no registro de execução: *"Acesso recuperado."*

A pessoa entra com o e-mail e a matrícula. O sistema pede uma senha nova na hora, e as sessões abertas em outros aparelhos são encerradas.

## 13. Agenda Google do setor (fase 2)

A partir da fase 2, todo evento criado, alterado ou cancelado no GestorCC aparece sozinho na agenda **"Centro de Convenções UFSM"**, na conta do setor. Ninguém recebe e-mail: a agenda é atualizada em silêncio.

Para ligar:

1. No projeto da API, cole o `appsscript.json` e o `Code.js` novos (seção 3) e salve.
2. Rode `instalar` de novo. Ele:
   - cria as abas `eventos` e `sessoes` na planilha **GestorCC - Dados**;
   - cria a agenda **"Centro de Convenções UFSM"**;
   - pede a permissão de **Agenda**. Aceite com a conta do setor.
3. Em **Implantar → Gerenciar implantações**, edite a implantação e escolha **Nova versão** (seção 10).
4. Publique o site com `VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos` no `.env` (seção 7).
5. No Google Agenda da conta do setor, abra as configurações da agenda **"Centro de Convenções UFSM"**:
   1. Vá em **Compartilhar com pessoas específicas**.
   2. Adicione a equipe com a opção **"Ver todos os detalhes do evento"**.
   3. Cada pessoa também pode usar o botão **"Adicionar ao meu Google Agenda"**, em Agenda ou Configurações no GestorCC.
6. Opcional: crie a propriedade `URL_APP` com o endereço do site, por exemplo `https://gestorcc-ae6f8.web.app`. Com ela, a descrição de cada evento na agenda ganha o link "Ver no GestorCC".

Se o Google Agenda estiver fora do ar quando alguém salvar um evento, o evento fica salvo no GestorCC normalmente. A rotina de 5 minutos atualiza a agenda depois.

As abas **AGENDA \<MÊS\> \<ANO\>** da planilha **GestorCC - Relatórios** são refeitas pela mesma rotina, alguns minutos depois de cada mudança.

## 14. Escalas (fase 3)

A fase 3 liga as rodadas, a disponibilidade, a montagem e a publicação das escalas, as trocas, a convocação extra, a presença e as avaliações.

Para ligar:

1. Cole o `Code.js` novo no projeto da API e salve. O manifesto não muda.
2. Rode `instalar` de novo. Ele cria as abas `rodadas`, `rodadaSessoes`, `disponibilidades`, `escalas` e `avaliacoes` na planilha **GestorCC - Dados**.
3. Em **Gerenciar implantações**, escolha **Nova versão** (seção 10).
4. Publique o site com o `VITE_RECURSOS` da fase 3 (tabela da seção 7).

Os avisos às pessoas (escala publicada, troca, convocação extra, cancelamento) aparecem no sininho do GestorCC. Nenhum e-mail é enviado.

A planilha **GestorCC - Relatórios** ganha, alguns minutos depois de cada mudança, estas abas:

- **ESCALA \<MÊS\> \<ANO\>**: a grade do mês, com experientes em negrito e "escalar menos" destacado;
- **CONSULTA \<MÊS\> \<ANO\>**: quantas escalas cada pessoa teve no mês;
- **HISTÓRICO DE TROCAS**.

## 15. Pagamentos (fase 4)

A fase 4 liga os lotes de pagamento, a ficha de indicação, os dados para pagador externo e o "Meus ganhos" dos bolsistas.

Para ligar:

1. Cole o `Code.js` novo e salve.
2. Rode `instalar` de novo. Ele cria as abas `lotes`, `loteItens` e `envioExterno` na planilha **GestorCC - Dados**.
3. Crie uma **Nova versão** da implantação.
4. Publique o site com o `VITE_RECURSOS` da fase 4.

A ficha de indicação não é enviada pelo sistema. Use **Copiar formatado** e cole no seu e-mail, ou baixe o arquivo.

A planilha de Relatórios ganha uma aba **PAGAMENTOS – \<título do lote\>** por lote, sem CPF nem dados bancários.

## 16. Almoxarifado e infraestrutura (fase 5)

Para ligar:

1. Cole o `Code.js` novo e salve.
2. Rode `instalar` de novo. Ele cria, na planilha **GestorCC - Dados**:
   - as abas do almoxarifado e das ocorrências do prédio;
   - as abas de colagem `IMPORTAR_ALMOX` e `IMPORTAR_AUTORIZADOS`.
3. Crie uma **Nova versão** da implantação e publique o site com o `VITE_RECURSOS` da fase 5.

**Trazer o almoxarifado antigo (BD_Almox):**

1. Na aba `IMPORTAR_ALMOX`, cole uma linha por item nas colunas `COD`, `NOME_ALMOX`, `NOME_COMUM`, `UNIDADE`, `VALOR`, `CATEGORIA`, `QTD_MINIMA`, `SALA`, `STATUS` e `SALDO`.
2. Na aba `IMPORTAR_AUTORIZADOS`, cole os nomes dos autorizados externos, na coluna `NOME`.
3. No GestorCC, vá em **Almoxarifado → Estoque → Importar da planilha**.

Itens já cadastrados não são alterados. O saldo de cada item novo entra como "saldo inicial (importação)".

**Formulário de problemas do prédio:**

1. Abra a planilha de respostas do Google Form e copie o ID dela, o trecho do endereço entre `/d/` e `/edit`.
2. Nas **Propriedades do script**, crie `FORMULARIO_INFRA_ID` com esse ID.
3. A conta do setor precisa conseguir abrir essa planilha.

A partir daí, as respostas novas viram ocorrências a cada 5 minutos, ou na hora pelo botão "Importar respostas do formulário".

**Fotos dos relatos:** ficam na pasta **GestorCC/Infraestrutura** do Drive, sem compartilhamento. Só quem gerencia e quem relatou as veem no GestorCC.

A planilha de Relatórios ganha as abas **ESTOQUE** e **INFRAESTRUTURA**.

## 17. Contratos e documentos (fase 6)

Para ligar:

1. Cole o `appsscript.json` e o `Code.js` novos. O manifesto agora pede a permissão de **Documentos**.
2. Rode `instalar` de novo e aceite a permissão. Ele cria as abas `contratos` e `aditivos` (planilha Dados) e `contratantes` (planilha Sigiloso).
3. Crie uma **Nova versão** da implantação e publique o site com o `VITE_RECURSOS` da fase 6.

**Modelos dos documentos.** Na pasta **GestorCC** do Drive:

1. Crie a pasta **Modelos**.
2. Coloque nela três Google Docs com estes nomes exatos:
   - `Modelo - Contrato`
   - `Modelo - Termo de autorização`
   - `Modelo - Empréstimo do piano`

   Para usar os arquivos .docx atuais, abra cada um no Google Drive e use **Arquivo → Salvar como Documentos Google**.
3. No texto de cada modelo, troque as informações de cada contrato pelos campos abaixo, com as chaves duplas.

| Campo | O que entra |
|---|---|
| `{{NUMERO}}` | número do contrato (N/AAAA) |
| `{{PROCESSO}}` | processo PEN-SIE |
| `{{EVENTO}}`, `{{DATAS}}`, `{{HORARIOS}}` | evento, datas e horários das sessões |
| `{{CONTRATANTE}}`, `{{DOCUMENTO}}`, `{{ENDERECO}}`, `{{CEP}}`, `{{REPRESENTANTE}}`, `{{EMAIL}}` | dados do contratante |
| `{{VALOR}}`, `{{VENCIMENTO}}` | valor total (base + aditivos) e vencimento da fatura |
| `{{AREAS}}`, `{{CORTESIAS}}`, `{{INGRESSO_SOLIDARIO}}`, `{{OBSERVACOES}}` | demais campos do contrato |
| `{{HOJE}}` | data em que o documento foi gerado |

Cada documento gerado vai para **GestorCC/Documentos gerados/\<ano\>**. Para mudar uma cláusula, edite o modelo, sem mexer no sistema.

**PDFs anexados** (contrato assinado e fatura): ficam em **GestorCC/Contratos**, sem compartilhamento. Baixe-os pelo GestorCC.

**Solicitação à FUNDEP:** o GestorCC monta o texto. Copie, cole no seu e-mail e anexe os PDFs assinados. O sistema não envia nada.

A planilha de Relatórios ganha a aba **CONTRATOS**, sem dados pessoais dos contratantes.

## 18. Busca inteligente (fase 7)

A barra de busca entende perguntas como "quem trabalha sábado?" ou "o que precisamos comprar?". Para isso ela usa o Gemini, no nível gratuito, sem custo.

**O que vai para o Gemini:** só a pergunta digitada e o manual de uso (`docs/manual/uso.md`, sem dados reais). O Gemini devolve qual consulta fazer, e a consulta roda no GestorCC com as permissões de quem perguntou. Nenhum dado das planilhas sai do Google da conta do setor.

Para ligar:

1. Com a conta do setor, abra <https://aistudio.google.com/apikey> e crie uma chave de API, no plano gratuito.
2. Nas **Propriedades do script**, crie `GEMINI_API_KEY` com a chave.
3. Opcional: crie `GEMINI_MODELO` para trocar o modelo. O padrão é `gemini-2.5-flash`.
4. Cole o `Code.js` novo, crie uma **Nova versão** e publique o site com o `VITE_RECURSOS` da fase 7.

O limite de perguntas por pessoa por dia fica em **Configurações**. Sem a chave, com o limite atingido ou com o Gemini fora do ar, a barra continua funcionando: ela interpreta perguntas simples por palavras-chave e sempre mostra os resultados da busca comum.

## 19. Desempenho (versão 0.8.0)

A API guarda no cache do Apps Script as abas que já leu e lê as que faltam numa chamada só, pelo serviço avançado do Sheets. O site manda juntas, num pedido só, as consultas que uma tela faz ao mesmo tempo. Tudo continua gratuito e dentro da conta do setor.

Para publicar:

1. Cole o `appsscript.json` novo (liga o serviço **Sheets**) e o `Code.js` novo. Salve.
2. Rode o **`instalar`**. Ele cria o gatilho **aoAlterarPlanilha** nas planilhas Dados e Sigiloso e começa o cache do zero. Aceite as permissões, se pedir.
3. Crie uma **Nova versão** e confira se o `/exec` mostra `"versao":"0.8.0"`.
4. Depois disso, publique o site.

**Como o cache se mantém certo:**
- Cada gravação feita pelo sistema muda a versão das abas gravadas.
- Uma edição feita direto nas planilhas Dados ou Sigiloso dispara o gatilho, que descarta o cache inteiro.
- O cache dura no máximo 6 horas.

**O que nunca vai para o cache:** `dadosPessoais` (CPF, banco, conta) e `contratantes`.

**Se algum dia aparecer um dado velho no site,** rode `instalar` de novo, que começa o cache do zero.

## 20. Ficha técnica pelo link do evento (versão 0.9.0)

A ficha técnica sai do Google Forms e passa para o GestorCC. Na tela do evento, o cartão **Ficha técnica** tem estas ações:
- **Gerar link:** cria o endereço único do evento. O produtor preenche sem login, no celular ou no computador, e marca as poltronas no mapa.
- **Copiar mensagem para o produtor:** um texto pronto para colar no e-mail ou no WhatsApp. O sistema não envia nada.
- **Ver ficha, Corrigir e Imprimir resumo:** a impressão tem uma página com os dados e outra com o mapa das poltronas reservadas.
- **Travar e Destravar:** a ficha trava sozinha no dia seguinte ao prazo (2 dias antes da primeira sessão). Os dois botões sobrepõem o prazo.
- **Gerar novo link:** o link antigo deixa de valer e o que já foi preenchido continua salvo.

Para publicar:
1. Cole o `Code.js` novo e salve.
2. Rode o **`instalar`**. Ele cria a aba `fichas` na planilha Dados e a aba `fichasSigilo` na planilha Sigiloso.
3. Crie uma **Nova versão** e confira se o `/exec` mostra `"versao":"0.9.0"`.
4. Depois disso, publique o site.

**Onde ficam os dados:**
- CPF/CNPJ, e-mail e telefone do responsável e a chave do link ficam na planilha **Sigiloso**. O resto fica na aba `fichas`.
- Os arquivos anexados pelo produtor vão para **GestorCC/Fichas técnicas**, sem link público.
- Só quem pode **editar eventos** vê a ficha no GestorCC.

**Folder do espaço:** para a ficha mostrar o link do folder, cadastre em **Configurações → Links de formulários** um link com "Folder" no nome.

## 21. Distribuição de cortesias (versão 0.10.0)

Na tela do evento, o cartão **Cortesias** reparte as cortesias entre destinos, por exemplo "Casa do Estudante: 30":
- **Copiar mensagem:** cada destino recebe um link próprio e um texto pronto para mandar. O sistema não envia nada.
- **O que o destino faz:** abre o link sem login, vê "Você recebeu 30 cortesias para distribuir à Casa do Estudante" e lança nome e matrícula de cada pessoa, sem passar da quantidade. Dá para salvar e voltar até o dia anterior ao evento. Depois disso a lista trava, e o gestor pode destravar.
- **Matrícula:** é pedida por padrão. Para um destino de fora da UFSM, desmarque "Pedir a matrícula".
- **Imprimir lista:** sai uma lista única em ordem alfabética (ou separada por destino), com uma coluna para marcar quem retirou.

Para publicar:
1. Cole o `Code.js` novo e salve.
2. Rode o **`instalar`**. Ele cria a aba `cortesiasDestinos` na planilha Dados e a aba `cortesiasSigilo` na planilha Sigiloso.
3. Crie uma **Nova versão** e confira se o `/exec` mostra `"versao":"0.10.0"`.
4. Depois disso, publique o site.

**Onde ficam os dados:** os nomes e as matrículas ficam na planilha **Sigiloso** e não vão para o cache.

## 22. Ajustes de uso (versão 0.11.0)

- **Contratos:**
  - cada contrato aparece num cartão com a trilha das 6 etapas (Contrato, Fatura, ECAD, ISS, FUNDEP, Cortesias). Verde = concluído, azul = em andamento, amarelo = a fazer, laranja = prazo perto, vermelho = atrasado, cinza = isento;
  - o resumo no topo mostra o que falta em cada etapa, e clicar filtra a lista.
- **Almoxarifado:**
  - na Saída, "Quem está retirando" aceita digitar o nome. Um nome novo pode ser cadastrado na hora como autorizado;
  - a aba **Quem pode retirar** lista as pessoas de fora, que podem ser incluídas, renomeadas e desativadas.
- **Trocas:** valem também depois do evento. Se a presença já foi confirmada, quem entra fica como realizado. Só ficam travadas quando a pessoa já está num lote de pagamento.
- **Montar escala:**
  - o modo **Evento a evento** mostra um evento por tela, com as vagas como caixas e as pessoas como blocos para tocar;
  - **Escalar próximo evento** salva e avança. No último evento, **Revisar e publicar**.
- **Erro interno:** quem administra as Configurações passa a ver o detalhe técnico na mensagem.

Para publicar: cole o `Code.js` novo, crie uma **Nova versão** e confira se o `/exec` mostra `"versao":"0.11.0"`. Não há abas novas, e não precisa rodar o `instalar`.
