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
- verificação a cada 5 minutos, reservada para as próximas fases.

Antes de rodar, preencha as propriedades:

1. No projeto **GestorCC API - teste**, abra **Configurações do projeto → Propriedades do script → Adicionar propriedade**.
2. Crie estas quatro:

   | Propriedade | O que colocar |
   |---|---|
   | `EMAIL_PRIMEIRO_GESTOR` | e-mail de quem vai administrar o sistema |
   | `NOME_PRIMEIRO_GESTOR` | nome completo dessa pessoa |
   | `MATRICULA_PRIMEIRO_GESTOR` | matrícula dessa pessoa (vira a senha inicial) |
   | `URL_APP` | endereço do site deste ambiente (passo 6), por exemplo `https://gestorcc-teste.web.app` |

3. Abra o editor, escolha a função `instalar` na barra de cima e clique em **Executar**.
4. O Google pede autorização na primeira vez. Aceite com a conta do setor.
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
   - `VITE_RECURSOS`: as áreas ligadas nesta fase. Na fase 1 o valor é `pessoas,dadosPessoais,mural,formularios,configuracoes`. Áreas fora da lista aparecem como "Esta área chega numa próxima etapa."
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
   - quem já tinha cadastro com o mesmo e-mail é atualizado;
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
