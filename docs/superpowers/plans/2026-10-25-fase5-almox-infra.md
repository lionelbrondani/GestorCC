# GestorCC — Fase 5: Almoxarifado e infraestrutura — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ligar o almoxarifado e as ocorrências do prédio com dados reais (spec 10.1, 10.4, 11 e 13.2):
- estoque, saída, ajuste, pedidos e recebimento;
- importação do catálogo antigo;
- ocorrências, "Relatar problema" com foto, importação do formulário de problemas;
- as abas ESTOQUE e INFRAESTRUTURA.

**Architecture:** Ações em `api/src/acoes/almox.ts` e `api/src/acoes/infra.ts`, reaproveitando `shared/almox.ts` e `shared/infraestrutura.ts`. Duas portas novas:
- `arquivos`: guarda a foto numa pasta `Infraestrutura/` do Drive e a lê de volta;
- `formulario`: lê as respostas do Google Form de problemas.

**Spec:** `docs/superpowers/specs/2026-10-24-gestorcc-design.md`, seções 10.1, 10.4, 11 e 13.

## Global Constraints

- Permissões (protótipo, `mockCliente.ts:111-122`):

  | Quem | Ações |
  |---|---|
  | `almoxEstoque: ver` | `almox.movimentos`, `almox.pedidos` |
  | `almoxEstoque: editar` | `almox.salvarItem`, `almox.ajustar`, `almox.criarPedido`, `almox.receber`, `almox.importar` |
  | `almoxSaidas: editar` | `almox.retirar` |
  | `infraestrutura: editar` | `infra.atualizar`, `infra.importarFormulario` |
  | qualquer pessoa logada | `almox.listar` (exige `almoxEstoque` ou `almoxSaidas` em `ver`), `infra.listar` (sem permissão, só os próprios relatos), `infra.relatar`, `infra.foto` (gestor ou quem relatou) |

- **Não permite saldo negativo** (spec 10.1). Todo movimento de estoque atualiza `saldo` na mesma gravação.
- **Nenhum e-mail.** Os avisos são notificações no app:
  - ocorrência nova → quem tem `infraestrutura: editar`;
  - mudança de situação → quem relatou.
- **Fotos:** ficam no Drive, sem link público. O app as busca por `infra.foto`.
- **Importação do almoxarifado** pelas abas `IMPORTAR_ALMOX` e `IMPORTAR_AUTORIZADOS` da planilha **Dados**, criadas pelo `instalar`.
  - O saldo importado vira um movimento de `ajuste` com motivo `'saldo inicial (importação)'`.
  - O histórico de retiradas do sistema antigo não é importado.
- `VITE_RECURSOS` da fase 5: `pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais,pagamentos,almoxEstoque,almoxSaidas,infraestrutura,relatar`.

## Review Focus

1. **Duas retiradas do mesmo item ao mesmo tempo, somando mais que o saldo.** A trava serializa as gravações e a segunda é recusada. → teste na Task 1.
2. **O mesmo código digitado como `12` e `0012`.** É o mesmo item, graças a `formatarCod`. → teste na Task 1.
3. **Recebimento parcial seguido do restante.** O pedido passa de `parcial` a `recebido` e o saldo soma certo. → teste na Task 1.
4. **Resposta do formulário importada duas vezes**, pelo botão e pelo gatilho. Ela não é duplicada (`respostaFormularioId`). → teste na Task 2.
5. **Transição inválida**, como `chamado` sem número ou `naoProcede` sem observação. É recusada com a mensagem de `validarTransicao`. → teste na Task 2.

### Task 1: Almoxarifado na API (com importação)

**Tabelas** (todas em `dados`):

```
almoxItens               id = cod: t cod, t nomeAlmox, t nomeComum, t unidade, n valor, t categoria, n qtdMinima, t sala, t status, n saldo
almoxMovimentos          d quando, t tipo, t cod, n qtd, n valorUnitario, t retiradoPorPessoaId, t retiradoPorExterno, t eventoId, t ocorrenciaId, t finalidade, t pedidoId, t motivo
almoxAutorizadosExternos t nome, b ativo
almoxPedidos             t solicitanteId, t status
almoxPedidoItens         t pedidoId, t cod, n qtdPedida, n qtdRecebida, n valorEstimado
```

Abas de importação na planilha Dados:
- `IMPORTAR_ALMOX`: `COD | NOME_ALMOX | NOME_COMUM | UNIDADE | VALOR | CATEGORIA | QTD_MINIMA | SALA | STATUS | SALDO`;
- `IMPORTAR_AUTORIZADOS`: `NOME`.

O contrato ganha `'almox.importar': A<null, { itens: number; autorizados: number; problemas: { linha: number; mensagem: string }[] }>`.

**Mensagens de erro:**

| Situação | Código | Mensagem |
|---|---|---|
| ajuste sem motivo | `MOTIVO` | `'Informe o motivo do ajuste.'` |
| ajuste que deixaria saldo negativo | `ESTOQUE` | `'O ajuste deixaria o saldo negativo.'` |
| retirada sem finalidade | `FINALIDADE` | `'Informe a finalidade da retirada.'` |
| retirada sem pessoa nem autorizado externo ativo | `QUEM_RETIRA` | `'Informe quem está retirando.'` |
| retirada inválida | `ESTOQUE` | os erros de `validarRetirada` unidos por `; ` |
| pedido sem itens | `PEDIDO_VAZIO` | `'Inclua ao menos um item no pedido.'` |
| receber pedido inexistente | `NAO_ENCONTRADO` | `'Pedido não encontrado.'` |
| receber pedido já recebido | `PEDIDO_FECHADO` | `'Este pedido já foi recebido.'` |

**Testes** (`api/test/almox.test.ts`):
- cadastrar item com `cod` `'12'` vira `'0012'`;
- a retirada baixa o saldo e grava o movimento com quem retirou;
- retirar acima do saldo é recusado, e duas retiradas seguidas que somam mais que o saldo também;
- o ajuste exige motivo e não fica negativo;
- recebimento parcial e depois total: o status muda e o saldo soma;
- a importação cria itens e autorizados, com problema por linha (`COD` em branco), saldo inicial como ajuste, e reimportar não duplica;
- sem permissão → `SEM_PERMISSAO`.

- [ ] Write the tests. Run `npm test -w api -- almox`. Expected: FAIL.
- [ ] Implement, plus the button "Importar da planilha" no Estoque, com o modal no mesmo padrão de `ImportarPlanilha.tsx`. Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] Commit: `feat(api): almoxarifado com estoque, saída, pedidos e importação`.

### Task 2: Infraestrutura na API

**Tabelas** (em `dados`):

```
ocorrencias          n numero, t titulo, t descricao, t categoria, t local, t prioridade, t status, t origem, t relatorNome, t relatorPessoaId, t relatorContato, t eventoId, t fotoId, t chamadoNumero, t chamadoLink, t chamadoAbertoEm, t resolvidaEm, t respostaFormularioId
ocorrenciasHistorico t ocorrenciaId, d quando, t quemId, t de, t para, t observacao
```

**Portas:**

```ts
export interface Arquivos { salvarImagem(dataUrl: string, nome: string): string; lerImagem(id: string): string | null }
export interface Formulario { respostasInfra(): Record<string, unknown>[] | null } // null = FORMULARIO_INFRA_ID não configurado
```

**Contrato e tipo:**
- o contrato ganha `'infra.foto': A<{ id: Id }, string | null>`;
- `Ocorrencia` ganha `temFoto?: boolean`. A API devolve `foto: null` e `temFoto`.

**Leitura das respostas do formulário.** Cada coluna é reconhecida pelo cabeçalho, sem diferenciar maiúsculas:

| Cabeçalho que contém | Vira |
|---|---|
| `carimbo` ou `timestamp` | data |
| `nome` | `relatorNome` |
| `e-mail`, `email`, `telefone` ou `contato` | `relatorContato` |
| `local` ou `onde` | `local` |
| `tipo` ou `categoria` | `categoria` |
| `descri`, `problema` ou `aconteceu` | `titulo` (primeiros 80 caracteres) e `descricao` |
| `urgen` ou `prioridade` | `'urgente'` se a resposta tiver "sim" ou "urgente"; senão `'media'` |

O `respostaFormularioId` é a data mais os primeiros 30 caracteres da descrição.

**Testes** (`api/test/infra.test.ts`):
- relatar cria `#1`, guarda a foto no Drive (porta em memória), avisa quem gerencia e o relator vê a ocorrência em "Meus relatos";
- `infra.foto` devolve a imagem ao gestor e ao relator, e `SEM_PERMISSAO` a outra pessoa;
- transições: `chamado` exige número; `naoProcede` exige observação; o histórico registra o caminho de/para; o relator é avisado;
- correção de prioridade, tipo e local;
- importar o formulário cria ocorrências com `origem: 'formulario'`, e importar de novo não duplica;
- sem planilha configurada, o botão recebe `FORMULARIO`: `'Configure a planilha do formulário (propriedade FORMULARIO_INFRA_ID).'`

- [ ] Write the tests and run them. Expected: FAIL.
- [ ] Implement, including the Apps Script part:
  - `arquivosGas` cria ou acha a pasta `Infraestrutura` dentro de `PASTA_ID`, grava o blob da data URL e devolve o id; `lerImagem` monta a data URL em base64;
  - `formularioGas` abre `FORMULARIO_INFRA_ID` e lê a primeira aba;
  - no app, `OcorrenciaDetalhe` busca a foto com `infra.foto` quando `temFoto` vem verdadeiro.

  Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] Commit: `feat(api): ocorrências do prédio com foto e importação do formulário`.

### Task 3: Abas ESTOQUE e INFRAESTRUTURA, gatilho e app da fase 5

**Abas:**
- **`ESTOQUE`**: `COD | ITEM | CATEGORIA | SALA | SALDO | MÍNIMO | SITUAÇÃO` (`Crítico` ou `OK`), só itens ativos, em ordem de código. Destaque nas linhas críticas.
- **`INFRAESTRUTURA`**: `Nº | OCORRÊNCIA | LOCAL | TIPO | PRIORIDADE | SITUAÇÃO | Nº DO CHAMADO UFSM | DIAS EM ABERTO`. Abertas primeiro, por prioridade; destaque nos chamados atrasados.

**Marcas e gatilho:**
- as chaves `estoque` e `infra` são marcadas pelas gravações do almoxarifado e da infraestrutura;
- o `gatilhoMinutos` também importa as respostas novas do formulário, se configurado, sem erro quando não está.

**Testes:**
- as abas são escritas pelo gatilho;
- **app**, com o `VITE_RECURSOS` da fase 5: as telas `/almox`, `/infra` e `/relatar` não chamam `contratos.listar`.

- [ ] Write the tests. Expected: FAIL.
- [ ] Implement, with version `0.5.0`, the `.env` files and section 16 of the guide (`FORMULARIO_INFRA_ID`, `instalar`, the import tabs). Run `npm test && npm run typecheck && npm run build -w api`. Expected: PASS.
- [ ] Commit: `feat: abas de estoque e infraestrutura e app da fase 5 (versão 0.5.0)`.
