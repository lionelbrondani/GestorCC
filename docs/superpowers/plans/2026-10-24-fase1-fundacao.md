# GestorCC — Fase 1: Fundação — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar o GestorCC no ar com dados reais para a base do sistema — planilhas no Drive, API em Apps Script, login com e-mail acadêmico, pessoas e permissões, dados pessoais, mural, notificações, histórico e backup — mantendo os demais módulos do protótipo ocultos até as fases seguintes.

**Architecture:** Novo pacote `api/` em TypeScript, empacotado com esbuild num único `Code.js` para o Apps Script e publicado com `clasp`. A lógica fica em módulos puros que recebem portas (`Repositorio`, `Cripto`, `Trava`, `Cache`, `Relogio`, `Email`, `Propriedades`); em produção as portas usam SpreadsheetApp/Utilities/LockService/CacheService/MailApp, e nos testes usam implementações em memória e o `crypto` do Node. O app ganha um `HttpCliente` que implementa o mesmo `ApiCliente` do protótipo; sem `VITE_API_URL` continua usando o cliente simulado.

**Tech Stack:** TypeScript 5.6, esbuild 0.24, @google/clasp 2.4, @types/google-apps-script, Vitest 2, Firebase Hosting (via `npx firebase-tools@13`).

**Spec:** `docs/superpowers/specs/2026-10-24-gestorcc-design.md` (seções 2–5, 12, 13, 14, 16)

## Global Constraints

- Mensagens de erro sempre em português claro, prontas para o usuário; nunca códigos técnicos na tela.
- Requisição: `POST` com corpo JSON enviado como `text/plain`: `{ acao, token, idRequisicao, dados }`. Resposta: `{ ok: true, dados }` ou `{ ok: false, erro: { codigo, mensagem } }` (spec 3).
- Senhas: PBKDF2-HMAC-SHA256 com sal individual (spec 5.1); nunca guardar senha ou matrícula em texto.
- Sessão: token assinado com HMAC, válido por 7 dias, com `versaoToken` (spec 5.2).
- 5 tentativas erradas seguidas bloqueiam o login por 15 min (spec 5.1).
- Troca obrigatória de senha para quem tem `dadosPessoais: editar`; sugerida para os demais (spec 5.1).
- Trava de gravação com espera máxima de 10 s → `SISTEMA_OCUPADO` (spec 3).
- Planilhas: **Dados** (pessoas, permissoes, avisos, avisosLeituras, notificacoes, historico, config, feriados), **Sigiloso** (dadosPessoais, credenciais) e **Relatórios** (vazia nesta fase). Ninguém além da conta do sistema edita.
- Backup diário das 3 planilhas em `Backups/AAAA-MM-DD/`, mantendo 30 dias (spec 12).
- Fuso: `America/Sao_Paulo`.
- Nenhum dado pessoal real em código, testes ou commits; `referencias/` continua fora do git.
- Custo zero: Apps Script da conta institucional, Firebase Hosting no plano Spark.
- Módulos disponíveis em produção nesta fase: Início (simplificado), Pessoas, Dados pessoais, Mural, Avisos, Perfil, Formulários, Configurações. Os demais ficam ocultos até suas fases.

## Review Focus

1. **Dois gestores salvando a mesma pessoa ao mesmo tempo:** o segundo recebe `CONFLITO` com quem alterou e quando, sem sobrescrever. → teste na Task 4 e Task 6.
2. **Envio repetido após queda de rede** (mesmo `idRequisicao`): não cria aviso duplicado; devolve a resposta anterior. → teste na Task 4 e Task 7.
3. **Planilha mexida à mão** (matrícula digitada como número `202520732`, booleano `VERDADEIRO`/`TRUE`, célula vazia, coluna fora de ordem): a leitura continua funcionando. → teste na Task 2.
4. **Sessão de quem trocou a senha, teve a senha redefinida ou foi desativado:** o token antigo deixa de valer com `SESSAO`. → teste na Task 3 e Task 5.
5. **E-mail digitado com maiúsculas e espaços** (`"  Gestor@UFSM.br "`): login funciona. → teste na Task 5.

---

## Estrutura de arquivos

```
api/
  package.json  tsconfig.json  vitest.config.ts  build.mjs
  appsscript.json                 manifesto (fuso, V8, web app, escopos)
  ambientes/teste/.clasp.json.exemplo
  ambientes/producao/.clasp.json.exemplo
  src/
    principal.ts                  doPost/doGet + funções globais (instalar, backupDiario)
    nucleo/portas.ts              interfaces das portas
    nucleo/roteador.ts            tratarRequisicao: sessão, permissão, idempotência, trava, erros
    nucleo/regras.ts              regras de acesso por ação + ações disponíveis nesta fase
    nucleo/historico.ts           registrar(...)
    auth/senhas.ts                PBKDF2
    auth/tokens.ts                emitir/ler token
    acoes/auth.ts  pessoas.ts  avisos.ts  sistema.ts
    tabelas/esquema.ts            tabelas, planilha de cada uma, colunas
    tabelas/serializacao.ts       linha ↔ objeto (tolerante)
    adaptadores/memoria.ts        Repositorio/Cache/Trava/Email em memória (testes)
    adaptadores/node.ts           Cripto com crypto do Node (testes)
    adaptadores/gas.ts            portas reais do Apps Script
    instalar.ts  backup.ts  importarPessoas.ts
  test/**/*.test.ts
app/src/api/http/httpCliente.ts   cliente HTTP real
app/src/recursos.ts               módulos ativos por fase
app/src/telas/login/RedefinirSenha.tsx
firebase.json  .firebaserc.exemplo
docs/implantacao.md               passo a passo de publicação (para o setor)
```

---

### Task 1: Pacote `api/`, build para Apps Script e verificação de publicação

**Files:**
- Create: `api/package.json`, `api/tsconfig.json`, `api/vitest.config.ts`, `api/build.mjs`, `api/appsscript.json`, `api/ambientes/{teste,producao}/.clasp.json.exemplo`, `api/src/principal.ts`, `api/src/nucleo/portas.ts`, `api/test/build.test.ts`
- Modify: `package.json` (workspaces e scripts), `.gitignore` (`api/dist/`, `api/ambientes/*/.clasp.json`)

**Interfaces:**
- Produces:

```ts
// api/src/nucleo/portas.ts
export type Planilha = 'dados' | 'sigiloso' | 'relatorios';
export interface Repositorio {
  listar<T extends { id: string }>(tabela: NomeTabela): T[];
  inserir<T extends { id: string }>(tabela: NomeTabela, registro: T): void;
  atualizar<T extends { id: string }>(tabela: NomeTabela, registro: T): void;   // pelo id; carimba atualizadoEm/atualizadoPor
  remover(tabela: NomeTabela, id: string): void;
  /** Lê uma aba fora do esquema (ex.: IMPORTAR_PESSOAS), usando a primeira linha como cabeçalho. */
  lerAbaLivre(planilha: Planilha, aba: string): Record<string, unknown>[];
}
export interface Cripto { hmacSha256(chave: Uint8Array, msg: Uint8Array): Uint8Array; aleatorio(bytes: number): Uint8Array; }
export interface Trava { executar<T>(fn: () => T, esperaMs: number): T; }   // lança ErroApi SISTEMA_OCUPADO
export interface Cache { obter(chave: string): string | null; guardar(chave: string, valor: string, segundos: number): void; }
export interface Relogio { agoraMs(): number; agora(): string /* 'AAAA-MM-DDTHH:MM' em America/Sao_Paulo */; hoje(): string; }
export interface Email { enviar(para: string, assunto: string, corpoHtml: string): void; }
export interface Propriedades { obter(chave: string): string | null; definir(chave: string, valor: string): void; }
export interface Portas { repo: Repositorio; cripto: Cripto; trava: Trava; cache: Cache; relogio: Relogio; email: Email; props: Propriedades; }
```

- `npm run build -w api` gera `api/dist/Code.js` (esbuild, `format: 'iife'`, `globalName: '__gestor'`, `target: 'es2019'`, alias `@shared` → `shared/src`) e copia `appsscript.json` para `api/dist/`. O `footer` declara as funções globais que o Apps Script enxerga:
  `function doPost(e){return __gestor.doPost(e)} function doGet(e){return __gestor.doGet(e)} function instalar(){return __gestor.instalar()} function backupDiario(){return __gestor.backupDiario()} function gatilhoMinutos(){return __gestor.gatilhoMinutos()}`
- `appsscript.json`: `timeZone: "America/Sao_Paulo"`, `runtimeVersion: "V8"`, `webapp: { executeAs: "USER_DEPLOYING", access: "ANYONE_ANONYMOUS" }`, escopos de planilhas, Drive, e-mail (`script.send_mail`), `script.scriptapp` e `script.external_request`.
- Nesta task, `doPost` responde `{ ok: true, dados: { versao: '0.1.0' } }` para `acao: 'sistema.ping'`; `doGet` devolve o mesmo JSON.

- [ ] **Step 1: Teste que falha** — `api/test/build.test.ts`: roda o build e verifica que `dist/Code.js` existe, contém `function doPost(` e `function instalar(` e não contém `import ` nem `require(`; e que `dist/appsscript.json` tem `webapp.access === 'ANYONE_ANONYMOUS'`.
- [ ] **Step 2: Rodar e ver falhar** — `npm test -w api` → FAIL.
- [ ] **Step 3: Implementar** package (devDeps exatas: `esbuild@0.24.0 @google/clasp@2.4.2 @types/google-apps-script@1.0.83 typescript@5.6.3 vitest@2.1.8`; scripts `build`, `test`, `push:teste` = `npm run build && cd ambientes/teste && clasp push -f`, idem `push:producao`), `build.mjs`, manifesto e `principal.ts`.
- [ ] **Step 4: Rodar e ver passar** — `npm test -w api` → PASS.
- [ ] **Step 5: Verificação de publicação (com o responsável do setor)** — pausa obrigatória: pedir ao usuário que rode `npx clasp login` com a conta do setor, criar o projeto de **teste** (`npx clasp create --type webapp --title "GestorCC API (teste)" --rootDir ../../dist` dentro de `api/ambientes/teste`), `npm run push:teste -w api`, publicar com `npx clasp deploy` e chamar a URL `/exec` por `fetch` a partir de `http://localhost:5173` com corpo `text/plain`. Expected: resposta `{"ok":true,"dados":{"versao":"0.1.0"}}` sem erro de CORS e sem tela de login do Google. **Se o domínio da UFSM bloquear "qualquer pessoa"**, parar e registrar: a fase passa para o plano B do spec 16 (app servido pelo `HtmlService`).
- [ ] **Step 6: Commit** — `feat(api): pacote da API em Apps Script com build e ping`

---

### Task 2: Esquema das tabelas, serialização tolerante e repositório em memória

**Files:**
- Create: `api/src/tabelas/esquema.ts`, `api/src/tabelas/serializacao.ts`, `api/src/adaptadores/memoria.ts`
- Test: `api/test/serializacao.test.ts`, `api/test/memoria.test.ts`

**Interfaces:**
- Produces:

```ts
export type NomeTabela = 'pessoas' | 'permissoes' | 'avisos' | 'avisosLeituras' | 'notificacoes' | 'historico' | 'config' | 'feriados' | 'dadosPessoais' | 'credenciais';
export type TipoColuna = 'texto' | 'numero' | 'booleano' | 'json' | 'dataHora';
export const ESQUEMA: Record<NomeTabela, { planilha: Planilha; colunas: { nome: string; tipo: TipoColuna }[] }>;
export function cabecalhos(t: NomeTabela): string[];          // inclui id, criadoEm, atualizadoEm, atualizadoPor
export function linhaParaObjeto(t: NomeTabela, cab: string[], linha: unknown[]): Record<string, unknown>;
export function objetoParaLinha(t: NomeTabela, cab: string[], obj: Record<string, unknown>): unknown[];
export function criarRepositorioMemoria(inicial?: Partial<Record<NomeTabela, unknown[]>>, relogio?: Relogio): Repositorio & { dump(): Record<NomeTabela, unknown[]> };
```

Colunas (além de `id`, `criadoEm`, `atualizadoEm`, `atualizadoPor`):
- `pessoas` (dados): nome, nomeCurto, emailAcademico, emailAlternativo, matricula, siape, tipo, vinculo, experiente(bool), escalarMenos(bool), ativo(bool), convitesAgenda
- `permissoes` (dados): pessoaId, modulo, nivel — `id = pessoaId + ':' + modulo`
- `avisos` (dados): titulo, texto, publico, pessoasIds(json), fixado(bool), validoAte, pedeConfirmacao(bool), autorId
- `avisosLeituras` (dados): avisoId, pessoaId, lidoEm — `id = avisoId + ':' + pessoaId`
- `notificacoes` (dados): pessoaId, texto, link, lida(bool)
- `historico` (dados): quando, quemId, entidade, entidadeId, acao, antes(json), depois(json), justificativa
- `config` (dados): valor(json) — `id` é a chave
- `feriados` (dados): data, nome — `id = data`
- `dadosPessoais` (sigiloso): cpf, banco, agencia, conta, nascimento, camiseta — `id = pessoaId`
- `credenciais` (sigiloso): hash, sal, iteracoes(numero), senhaInicial(bool), versaoToken(numero), falhas(numero), bloqueadoAte, resetToken, resetExpira — `id = pessoaId`

Leitura tolerante: colunas localizadas pelo **nome do cabeçalho** (a ordem não importa); `texto` converte número em texto sem notação científica (`202520732` → `'202520732'`); `booleano` aceita `true/TRUE/VERDADEIRO/sim/1`; vazio vira `''`, `false` ou `0` conforme o tipo; `json` inválido vira `null`; datas do Sheets (objeto `Date`) viram `'AAAA-MM-DDTHH:MM'`.

- [ ] **Step 1: Testes que falham**
- `linhaParaObjeto('pessoas', cab, [...])` com matrícula `202520732` (número) → `'202520732'`; `ativo: 'VERDADEIRO'` → `true`; célula vazia em `emailAlternativo` → `''`.
- Cabeçalho embaralhado (colunas em outra ordem) ainda lê o objeto certo.
- `objetoParaLinha` seguido de `linhaParaObjeto` devolve o mesmo objeto (ida e volta) para `avisos` com `pessoasIds: ['p1','p2']`.
- Repositório em memória: `inserir` + `atualizar` carimba `atualizadoEm` com o relógio; `atualizar` de id inexistente lança erro; `remover` apaga.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(api): esquema das planilhas, serialização tolerante e repositório em memória`

---

### Task 3: Senhas (PBKDF2) e tokens de sessão

**Files:**
- Create: `api/src/auth/senhas.ts`, `api/src/auth/tokens.ts`, `api/src/adaptadores/node.ts`
- Test: `api/test/senhas.test.ts`, `api/test/tokens.test.ts`

**Interfaces:**
- Produces:

```ts
export const ITERACOES_PADRAO = 2000;
export function pbkdf2Sha256(cripto: Cripto, senha: string, sal: Uint8Array, iteracoes: number): Uint8Array;   // 32 bytes, um bloco
export function criarHash(cripto: Cripto, senha: string, iteracoes?: number): { hash: string; sal: string; iteracoes: number };   // base64
export function conferirSenha(cripto: Cripto, senha: string, cred: { hash: string; sal: string; iteracoes: number }): boolean;    // comparação em tempo constante
export const VALIDADE_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;
export function emitirToken(cripto: Cripto, segredo: string, pessoaId: string, versaoToken: number, agoraMs: number): string;   // base64url(payload).base64url(hmac)
export function lerToken(cripto: Cripto, segredo: string, token: string, agoraMs: number): { pessoaId: string; versaoToken: number } | null;
export const criptoNode: Cripto;   // adaptadores/node.ts, usa node:crypto (só testes)
```

Algoritmo PBKDF2 de um bloco (o teste não fixa o caminho): `U1 = HMAC(senha, sal ‖ 00000001)`, `Ui = HMAC(senha, Ui-1)`, resultado = XOR de U1…Uc.

- [ ] **Step 1: Testes que falham**
- Vetor RFC 7914/6070 para SHA-256: senha `"password"`, sal `"salt"`, 1 iteração → hex `120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b`; 2 iterações → `ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43`.
- `conferirSenha` aceita a senha certa e recusa outra; dois `criarHash` da mesma senha têm sais e hashes diferentes.
- Token: `lerToken` devolve o conteúdo para token válido; `null` para token adulterado (1 caractere trocado), assinado com outro segredo ou vencido (`agoraMs + VALIDADE_TOKEN_MS + 1`).
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(api): senhas com PBKDF2 e tokens de sessão assinados`

---

### Task 4: Roteador — sessão, permissões, idempotência, trava, conflito e erros

**Files:**
- Create: `api/src/nucleo/roteador.ts`, `api/src/nucleo/regras.ts`, `api/src/nucleo/historico.ts`, `api/test/apoio.ts` (monta portas em memória + pessoas fictícias)
- Test: `api/test/roteador.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `Acoes`, `ErroApi`, `pode`, `MODELOS` de `@shared`.
- Produces:

```ts
export type Contexto = { portas: Portas; eu: Pessoa | null; idRequisicao: string };
export type Handler<A extends Acao> = (dados: Entrada<A>, ctx: Contexto) => Saida<A>;
export type Regra = 'publica' | 'logado' | [Modulo, 'ver' | 'editar'];
export const ACOES_FASE: Partial<Record<Acao, { regra: Regra; escrita: boolean }>>;
export function tratarRequisicao(corpo: string, portas: Portas, handlers: Partial<{ [A in Acao]: Handler<A> }>): string;   // JSON da resposta
export function registrar(ctx: Contexto, entidade: string, entidadeId: string, acao: string, antes: unknown, depois: unknown, justificativa?: string): void;
export function exigirVersao(atual: { atualizadoEm?: string; atualizadoPor?: string }, esperada: string | undefined, nomes: (id: string) => string): void;
  // lança ErroApi('CONFLITO', '<Nome> alterou este registro às HH:MM. Recarregue a tela antes de salvar.')
export function montarPessoa(repo: Repositorio, id: string): Pessoa | null;   // junta pessoas + permissoes (módulo ausente = 'nenhum')
```

Comportamento de `tratarRequisicao` (ordem):
1. JSON inválido → `REQUISICAO` "Requisição inválida.".
2. Ação fora de `ACOES_FASE` → `NAO_DISPONIVEL` "Esta função ainda não está disponível.".
3. Regra ≠ `publica`: token ausente/inválido/vencido, pessoa inexistente/inativa ou `versaoToken` diferente da credencial → `SESSAO` "Sua sessão expirou. Entre novamente.".
4. Regra de módulo sem permissão → `SEM_PERMISSAO` "Você não tem permissão para esta ação.".
5. Escrita: se `cache.obter('req:'+idRequisicao)` existir, devolve a resposta guardada; senão executa dentro de `trava.executar(fn, 10000)` e guarda a resposta por 6 horas (limite do CacheService).
6. `ErroApi` vira `{ ok:false, erro }`; qualquer outro erro vira `INTERNO` "Algo deu errado do nosso lado. Tente de novo; se continuar, avise o gestor do sistema." (e a mensagem técnica vai para o `console.error`).

`ACOES_FASE` nesta fase: `sistema.ping` (publica), `auth.entrar`, `auth.esqueciSenha`, `auth.redefinirSenha` (publicas, escrita), `auth.trocarSenha`, `perfil.salvarAgenda` (logado, escrita), `pessoas.listar` (logado), `pessoas.salvar`, `pessoas.redefinirSenha`, `pessoas.importar` (pessoas editar), `dadosPessoais.obter`/`salvar` (logado; checagem fina no handler), `avisos.listar`, `avisos.confirmarLeitura`, `notificacoes.listar`, `notificacoes.marcarLidas` (logado), `avisos.salvar` (mural editar), `historico.listar` (logado; handler exige `ehGestor`), `config.obter` (logado), `config.salvar`, `feriados.salvar` (configuracoes editar), `feriados.listar` (logado).

Acrescentar a `shared/src/api/acoes.ts`: `'sistema.ping': A<null, { versao: string }>`, `'auth.redefinirSenha': A<{ token: string; nova: string }, null>`, `'pessoas.importar': A<null, { importadas: number; atualizadas: number; problemas: { linha: number; mensagem: string }[] }>`; e `atualizadoEm?: string` em `Pessoa`, `Aviso` e `Config`. A saída de `auth.trocarSenha` passa a ser `{ token: string }` (o cliente simulado devolve o token atual, sem mudança de comportamento).

- [ ] **Step 1: Testes que falham** (`apoio.ts` cria um gestor e um bolsista fictícios com credenciais)
- Ação desconhecida → `NAO_DISPONIVEL`; sem token em `pessoas.listar` → `SESSAO`; bolsista em `pessoas.salvar` → `SEM_PERMISSAO`.
- Token de pessoa desativada → `SESSAO`; token com `versaoToken` antigo → `SESSAO`.
- **Idempotência:** duas chamadas `avisos.salvar` com o mesmo `idRequisicao` criam um único aviso e devolvem a mesma resposta.
- **Trava:** uma `Trava` falsa que sempre lança → resposta `SISTEMA_OCUPADO`.
- Handler que lança `Error('boom')` → `INTERNO` com a mensagem amigável.
- `exigirVersao` com `atualizadoEm` diferente → `CONFLITO` cuja mensagem contém o nome de quem alterou.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(api): roteador com sessão, permissões, idempotência e trava`

---

### Task 5: Autenticação — entrar, bloqueio, trocar e redefinir senha

**Files:**
- Create: `api/src/acoes/auth.ts`
- Test: `api/test/auth.test.ts`

**Interfaces:**
- Consumes: Tasks 3–4.
- Produces handlers `auth.entrar`, `auth.trocarSenha`, `auth.esqueciSenha`, `auth.redefinirSenha`, `pessoas.redefinirSenha`; e `export function criarCredencialInicial(cripto: Cripto, matricula: string): Credencial`.

Regras:
- `auth.entrar`: e-mail comparado com `trim().toLowerCase()`; pessoa ativa; se `bloqueadoAte > agora` → `BLOQUEADO` "Muitas tentativas. Tente de novo às HH:MM."; senha errada incrementa `falhas`, e na 5ª define `bloqueadoAte = agora + 15 min` e zera `falhas`; erro sempre `CREDENCIAIS` "E-mail ou senha incorretos." (sem revelar se o e-mail existe); acerto zera `falhas` e devolve `{ token, pessoa, senhaInicial }`.
- `auth.trocarSenha`: confere a atual; nova com ≥ 8 caracteres (`SENHA_CURTA`); grava novo hash, `senhaInicial=false`, `versaoToken+1`; a resposta inclui um **novo token** para a sessão atual continuar (ajustar `Saida` para `{ token: string }`).
- `auth.esqueciSenha`: sempre responde `null` (não revela se o e-mail existe); se a pessoa existir e estiver ativa, grava `resetToken` aleatório (32 bytes, base64url) com `resetExpira = agora + 1 h` e envia e-mail "Redefinir sua senha do GestorCC" com o link `${URL_APP}/redefinir?token=...` (`URL_APP` nas propriedades).
- `auth.redefinirSenha`: token igual e não vencido → grava nova senha, limpa `resetToken`, `senhaInicial=false`, `versaoToken+1`; senão `LINK_INVALIDO` "Este link expirou ou já foi usado. Peça um novo.".
- `pessoas.redefinirSenha` (gestor): senha volta para a matrícula, `senhaInicial=true`, `versaoToken+1`.
- Cada operação registra no `historico` (sem guardar senha, hash ou token).

- [ ] **Step 1: Testes que falham**
- Entrar com `"  Gestor@UFSM.br "` e a matrícula → sucesso com `senhaInicial: true`.
- 5 senhas erradas → a 6ª tentativa, mesmo com a senha certa, recebe `BLOQUEADO`; após avançar o relógio 15 min, entra.
- `trocarSenha` invalida o token antigo (`pessoas.listar` com ele → `SESSAO`) e o novo token funciona.
- `esqueciSenha` com e-mail inexistente responde `null` e não envia e-mail; com e-mail existente envia 1 e-mail contendo `/redefinir?token=`.
- `redefinirSenha` com o token do e-mail funciona uma vez; na segunda → `LINK_INVALIDO`; com o relógio além de 1 h → `LINK_INVALIDO`.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(api): autenticação com bloqueio, troca e redefinição de senha`

---

### Task 6: Pessoas, permissões, dados pessoais, perfil e importação

**Files:**
- Create: `api/src/acoes/pessoas.ts`, `api/src/importarPessoas.ts`
- Test: `api/test/pessoas.test.ts`, `api/test/importarPessoas.test.ts`

**Interfaces:**
- Produces handlers `pessoas.listar`, `pessoas.salvar`, `pessoas.importar`, `dadosPessoais.obter`, `dadosPessoais.salvar`, `perfil.salvarAgenda`; e

```ts
export interface LinhaImportacao { [coluna: string]: unknown }   // cabeçalhos: NOME, EMAIL, MATRICULA, TIPO, VINCULO, CPF, BANCO, AGENCIA, CONTA, CAMISETA, NASCIMENTO
export function prepararImportacao(linhas: LinhaImportacao[], existentes: Pessoa[]): {
  novas: { pessoa: Omit<Pessoa, 'id'>; dados: Omit<DadosPessoais, 'pessoaId'> }[];
  atualizacoes: { pessoaId: string; dados: Omit<DadosPessoais, 'pessoaId'> }[];
  problemas: { linha: number; mensagem: string }[];
};
```

Regras (mesmas do cliente simulado, agora sobre o repositório):
- `pessoas.listar`: com `pessoas: ver` ou `ehGestor` devolve tudo; senão só ativos e sem e-mail/matrícula/siape.
- `pessoas.salvar`: matrícula com `normalizarMatricula`; e-mail acadêmico único entre ativos (`EMAIL`); grava `pessoas` e regrava as linhas de `permissoes` da pessoa; pessoa nova ganha `credenciais` com a matrícula como senha (`criarCredencialInicial`); desativar incrementa `versaoToken`; usa `exigirVersao` com `atualizadoEm` enviado.
- `dadosPessoais.*`: a própria pessoa sempre; outros exigem `dadosPessoais: ver/editar`; CPF validado com `cpfValido` (`CPF`); alteração bancária feita pela própria pessoa notifica quem tem `dadosPessoais: editar`.
- `pessoas.importar`: lê a aba `IMPORTAR_PESSOAS` da planilha **Sigiloso** (via `repo` da Task 8; nos testes, linhas injetadas), chama `prepararImportacao`, cria/atualiza, e devolve o relatório. Não apaga a aba (o gestor apaga depois).
- `prepararImportacao`: nome obrigatório; matrícula com `normalizarMatricula` (aceita `2.02520732E8`? **não** — vira problema "Matrícula ilegível"); CPF com `normalizarCpf` (inválido vira problema, a pessoa entra sem CPF); e-mail obrigatório; pessoa existente identificada pela matrícula → só atualiza dados pessoais; `TIPO` padrão `bolsista`, `VINCULO` padrão `eventual`, permissões do modelo correspondente.

- [ ] **Step 1: Testes que falham** (dados fictícios)
- **Conflito:** gestor A carrega a pessoa, gestor B salva, gestor A salva com o `atualizadoEm` antigo → `CONFLITO` com o nome do gestor B.
- Nova pessoa consegue entrar com a matrícula; desativar invalida a sessão dela.
- Bolsista lê os próprios dados pessoais; lê os de outro → `SEM_PERMISSAO`.
- `prepararImportacao` com 3 linhas (uma válida nova, uma de matrícula existente, uma com CPF inválido e matrícula `2.02520732E8`) → 1 nova (com CPF), 1 atualização, 2 problemas com o número da linha (contando o cabeçalho como linha 1).
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(api): pessoas, permissões, dados pessoais e importação`

---

### Task 7: Mural, notificações, histórico, configurações e feriados

**Files:**
- Create: `api/src/acoes/avisos.ts`, `api/src/acoes/sistema.ts`
- Test: `api/test/avisos.test.ts`, `api/test/sistema.test.ts`

**Interfaces:**
- Produces handlers `avisos.listar`, `avisos.salvar`, `avisos.confirmarLeitura`, `notificacoes.listar`, `notificacoes.marcarLidas`, `historico.listar`, `config.obter`, `config.salvar`, `feriados.listar`, `feriados.salvar`, `sistema.ping`; e `export const CONFIG_PADRAO: Config` (valores do spec: diária 8000, vagas 8/1, mínimo de experientes 1, `projetoFundep: '30055'`, limite de perguntas 30, `agendaSetor.conectada: false`).

Regras: as mesmas do cliente simulado (`app/src/api/mock/mockCliente.ts`) para estas ações — público do aviso, validade, fixados primeiro, leituras vindas de `avisosLeituras`, `config.obter` mescla `CONFIG_PADRAO` com o salvo, `historico.listar` exige `ehGestor` e devolve os 200 mais recentes.

- [ ] **Step 1: Testes que falham**
- **Idempotência no mural:** mesmo `idRequisicao` duas vezes → um único aviso.
- Bolsista não vê aviso `gestores` nem aviso vencido; editor do mural vê todos.
- `confirmarLeitura` duas vezes cria uma única linha em `avisosLeituras`.
- `config.obter` sem nada salvo devolve `CONFIG_PADRAO`; depois de `config.salvar` devolve o salvo.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(api): mural, notificações, histórico e configurações`

---

### Task 8: Portas reais do Apps Script, instalação, backup e gatilhos

**Files:**
- Create: `api/src/adaptadores/gas.ts`, `api/src/instalar.ts`, `api/src/backup.ts`
- Modify: `api/src/principal.ts` (liga tudo: `doPost` → `tratarRequisicao(e.postData.contents, portasGas(), handlers)` e devolve `ContentService` JSON)
- Test: `api/test/backup.test.ts`, `api/test/instalar.test.ts`

**Interfaces:**
- Produces:

```ts
export function portasGas(): Portas;   // SpreadsheetApp.openById(props DADOS_ID / SIGILOSO_ID), Utilities, LockService.getScriptLock(), CacheService.getScriptCache(), MailApp, PropertiesService.getScriptProperties()
export function planoInstalacao(): { planilha: Planilha; nomeArquivo: string; abas: { nome: NomeTabela | 'IMPORTAR_PESSOAS'; cabecalhos: string[] }[] }[];
export function instalar(): void;      // idempotente: cria pasta "GestorCC", as 3 planilhas, abas e cabeçalhos; SEGREDO_TOKEN; gatilhos; primeiro gestor
export function pastasParaApagar(pastas: { nome: string }[], hoje: string, dias: number): string[];   // nomes 'AAAA-MM-DD' mais antigos que `dias`
export function backupDiario(): void;
```

- O repositório real lê cada aba inteira uma vez por requisição (`getDataRange().getValues()`), escreve linhas com `setValues` e localiza colunas pelo cabeçalho (serialização da Task 2).
- `instalar()` lê das propriedades `EMAIL_PRIMEIRO_GESTOR`, `NOME_PRIMEIRO_GESTOR`, `MATRICULA_PRIMEIRO_GESTOR` e `URL_APP` (o responsável preenche no editor antes de rodar); cria esse gestor com o modelo `gestor`; cria os gatilhos `backupDiario` (diário, 3h) e `gatilhoMinutos` (a cada 5 min — nesta fase só reservado para as próximas); grava `DADOS_ID`, `SIGILOSO_ID`, `RELATORIOS_ID`, `PASTA_ID`. Rodar de novo não duplica nada.
- Compartilhamento: `instalar()` **não** compartilha nada; o passo a passo (Task 10) orienta o responsável a dar acesso de leitor na planilha de Dados/Relatórios para a equipe, e nenhum acesso à Sigiloso.

- [ ] **Step 1: Testes que falham**
- `planoInstalacao()` põe `dadosPessoais` e `credenciais` só na planilha `sigiloso`, e todas as abas têm `id` como primeira coluna.
- `pastasParaApagar([{nome:'2026-09-20'},{nome:'2026-09-25'},{nome:'2026-10-20'}], '2026-10-24', 30)` → `['2026-09-20']`; nomes fora do padrão são ignorados.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Instalação no ambiente de teste (com o responsável)** — pausa: o usuário preenche as propriedades no editor do script de teste e roda `instalar`; depois `npm run push:teste -w api` e nova versão do deploy. Expected: pasta "GestorCC" com as 3 planilhas e abas; `sistema.ping` responde; `auth.entrar` com o primeiro gestor responde `senhaInicial: true`.
- [ ] **Step 6: Commit** — `feat(api): portas do Apps Script, instalação, backup e gatilhos`

---

### Task 9: App ligado à API real — cliente HTTP, módulos por fase e redefinição de senha

**Files:**
- Create: `app/src/api/http/httpCliente.ts`, `app/src/recursos.ts`, `app/src/telas/login/RedefinirSenha.tsx`
- Modify: `app/src/App.tsx`, `app/src/rotas.tsx`, `app/src/auth/RotaProtegida.tsx`, `app/src/layout/menu.ts`, `app/src/telas/login/Login.tsx`, `app/src/telas/inicio/InicioGestor.tsx`, `app/src/telas/inicio/InicioBolsista.tsx`, `app/src/auth/AvisoSenha.tsx` (usa o novo token devolvido por `auth.trocarSenha`)
- Test: `app/src/api/http/httpCliente.test.ts`, `app/src/recursos.test.ts`, `app/src/telas/login/RedefinirSenha.test.tsx`

**Interfaces:**
- Produces:

```ts
export function criarHttpCliente(url: string, opcoes?: { fetch?: typeof fetch; novoId?: () => string }): ApiCliente;
export type Recurso = Modulo | 'escalasPessoais' | 'relatar';
export function recursosAtivos(): Set<Recurso>;      // VITE_RECURSOS (lista separada por vírgula) ou todos no protótipo
export function recursoAtivo(r: Recurso): boolean;
```

- `httpCliente`: `fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ acao, token, idRequisicao, dados }), redirect: 'follow' })`; `{ ok:false }` vira `ErroApi(codigo, mensagem)`; falha de rede vira `ErroApi('REDE', 'Sem conexão com o servidor. Verifique a internet e tente de novo.')`; `idRequisicao` = `crypto.randomUUID()` por chamada.
- `App.tsx`: com `import.meta.env.VITE_API_URL` usa `criarHttpCliente`; sem, o cliente simulado. Erro `SESSAO` em qualquer chamada → `sair()` e volta ao login com `voltar`.
- Recursos em produção na fase 1: `VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes`. Menu, rotas (`Exige` também confere `recursoAtivo`) e Início escondem o que não estiver ativo; a busca fica oculta.
- `Login.tsx`: a linha das contas de exemplo só aparece no protótipo.
- `RedefinirSenha.tsx` (rota pública `/redefinir?token=`): nova senha + confirmação (≥ 8), chama `auth.redefinirSenha`, mostra "Senha alterada. Entre com a nova senha." e link para `/entrar`; `LINK_INVALIDO` mostra a mensagem e o botão "Pedir novo link".

- [ ] **Step 1: Testes que falham**
- `httpCliente` com `fetch` falso: envia `Content-Type` `text/plain`, corpo com `acao`, `token` (após `definirToken`) e `idRequisicao`; resposta `{ok:false, erro:{codigo:'SEM_PERMISSAO',…}}` rejeita com `ErroApi` de código `SEM_PERMISSAO`; `fetch` que lança → código `REDE`.
- `recursosAtivos()` com `VITE_RECURSOS='pessoas,mural'` → contém `pessoas` e não contém `escalas`; vazio → todos.
- Com recursos da fase 1, o gestor não vê "Escalas" no menu e `/escalas` mostra "Esta área chega numa próxima etapa."; `/pessoas` funciona.
- `RedefinirSenha` com senhas diferentes mostra "A confirmação não confere com a nova senha."; com sucesso mostra "Senha alterada.".
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar** — e `npm test && npm run typecheck && npm run build`.
- [ ] **Step 5: Commit** — `feat(app): cliente da API real, módulos por fase e redefinição de senha`

---

### Task 10: Publicação (teste e produção) e passo a passo para o setor

**Files:**
- Create: `firebase.json`, `.firebaserc.exemplo`, `app/.env.exemplo`, `docs/implantacao.md`
- Modify: `package.json` (scripts `deploy:app:teste`, `deploy:app:producao`), `.gitignore` (`.firebaserc`, `app/.env.*` exceto o exemplo)

**Interfaces:**
- `firebase.json`: `hosting.public = "app/dist"`, rewrite de `**` para `/index.html`, cabeçalho `Cache-Control: no-cache` para `index.html` e `sw.js`; dois sites (`teste` e `producao`) via `hosting.target`.
- `docs/implantacao.md` (para o responsável do setor, em linguagem simples): contas e acessos necessários; `clasp login`; criar projetos de teste e produção; preencher propriedades e rodar `instalar`; publicar a API; criar o projeto Firebase (plano Spark) e os dois sites; `.env` com `VITE_API_URL` e `VITE_RECURSOS`; `firebase login` e deploy; compartilhar a planilha de Dados como **leitor** com a equipe e nunca a Sigiloso; importar pessoas pela aba `IMPORTAR_PESSOAS` (e apagá-la depois); como atualizar versões; como restaurar um backup.

- [ ] **Step 1: Teste automatizado do roteiro** — `api/test/implantacao.test.ts` confere que `docs/implantacao.md` cita `instalar`, `IMPORTAR_PESSOAS`, `VITE_API_URL`, "leitor" e "Sigiloso", e que `firebase.json` reescreve `**` para `/index.html`.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Escrever os arquivos**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Publicação de teste ponta a ponta (com o responsável)** — pausa: `firebase login`, deploy do site de teste com a URL da API de teste; abrir no celular e no computador: entrar com o primeiro gestor (troca obrigatória de senha), cadastrar uma pessoa fictícia, entrar como ela, publicar um aviso, confirmar leitura, "Esqueci minha senha" com e-mail real do responsável. Expected: tudo funciona e as planilhas mostram as linhas criadas.
- [ ] **Step 6: Produção (com o responsável)** — mesmo roteiro no ambiente de produção, depois importar as pessoas reais pela aba `IMPORTAR_PESSOAS` e revisar o relatório de problemas com o responsável.
- [ ] **Step 7: Commit** — `docs: publicação da fase 1 e passo a passo para o setor`
