# GestorCC — Fase 2: Eventos e agenda — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar a Agenda com dados reais. Isso inclui:
- cadastro de eventos e sessões, com edição e cancelamento;
- feriados, impressão do mês e estatísticas;
- a agenda Google do setor sempre sincronizada;
- a aba AGENDA na planilha de Relatórios.

**Architecture:** As ações `eventos.*` e `sessoes.*` entram na API seguindo o padrão da fase 1: handlers puros sobre as portas, com testes no repositório em memória.

A sincronização com o Google Agenda funciona assim:
- ela é uma porta nova, `AgendaGoogle`;
- em produção, essa porta usa o serviço avançado de Agenda, sempre com `sendUpdates: 'none'`;
- o evento do Google é montado por uma função pura;
- se o Google falhar, a sessão fica marcada como pendente e o `gatilhoMinutos` tenta de novo.

No app, as telas do protótipo já existem. Elas passam a usar a validação compartilhada e deixam de consultar áreas que ainda não estão ligadas.

**Tech Stack:** o mesmo da fase 1:
- TypeScript 5.6 e esbuild 0.24;
- Vitest 2;
- Apps Script, agora com o serviço avançado Calendar v3;
- Firebase Hosting.

**Spec:** `docs/superpowers/specs/2026-10-24-gestorcc-design.md`, seções 4.1 (eventos, sessões, feriados), 5.3, 6.3 (Agenda), 7.1, 7.8 (agenda do mês), 7.10, 7.11, 11 (AGENDA `<MÊS>`) e 15.

## Global Constraints

- Mensagens de erro sempre em português claro, prontas para o usuário (spec 3).
- Toda gravação:
  - passa pelo roteador da fase 1 (sessão, permissão, `idRequisicao`, trava de 10 s);
  - confere `atualizadoEm` (`CONFLITO`);
  - registra no `historico`.
- **O sistema não envia e-mails.** Os eventos e convites do Google Agenda são criados e alterados com `sendUpdates: 'none'`, e nenhum código usa MailApp/GmailApp. O teste de build da fase 1 já protege isso.
- Convidados da agenda não veem os e-mails uns dos outros: `guestsCanSeeOtherGuests: false` (spec 7.11).
- Descrição do evento no Google:
  - leva organizador, servidor responsável, chegada e link;
  - **não leva** o contato do organizador nem outros dados pessoais (spec 7.11).
- Permissões (spec 5.3):

  | Ação | Quem pode |
  |---|---|
  | `eventos.listar` | qualquer pessoa logada (bolsistas vão precisar das sessões na fase 3) |
  | `eventos.salvar`, `eventos.cancelar`, `sessoes.cancelar` | `eventos: editar` |

- Fuso `America/Sao_Paulo`. Datas `AAAA-MM-DD`, horas `HH:MM`, sempre gravadas como texto (a correção da fase 1 já faz isso).
- A API é publicada colando `api/dist/Code.js` e `api/dist/appsscript.json` no editor do Apps Script, sem clasp.
- Custo zero.
- Nenhum dado pessoal real em código, testes ou commits.
- Áreas ligadas em produção nesta fase: `VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos`.
  - Escalas, rodadas, almoxarifado, contratos e infraestrutura continuam desligados.
  - O app **não pode chamar** as ações delas.

## Review Focus

1. **Sessão de outro evento no formulário.** O caso: um `id` de sessão antigo ou adulterado que pertence a outro evento. A API recusa com `NAO_ENCONTRADO` e não move a sessão. → teste na Task 2.
2. **Dois gestores editando o mesmo evento.** O segundo recebe `CONFLITO` com quem alterou e quando. → teste na Task 2.
3. **Sessão que passa da meia-noite** (22:00 às 01:00). No Google, o evento termina no dia seguinte, e não antes de começar. → teste na Task 4.
4. **Google Agenda fora do ar durante a gravação.** O evento fica salvo no GestorCC, a sessão fica pendente, e a rotina de 5 minutos acerta depois. → teste na Task 4.
5. **Horário digitado errado** (`8:00`, `25:00`, `12h`). A gravação é recusada com a data da sessão na mensagem. → teste na Task 1.

---

## Estrutura de arquivos

```
shared/src/
  eventos.ts            validarEvento (usada pelo app e pela API)
  agendaMes.ts          agendaDoMes, horarioSessao, rotuloDiaAgenda (impressão e planilha)
api/src/
  acoes/eventos.ts      eventos.listar, eventos.salvar, eventos.cancelar, sessoes.cancelar
  agenda/eventoAgenda.ts  eventoDaAgenda (puro)
  agenda/sincronizar.ts   sincronizarAgenda, removerDaAgenda, sincronizarPendentes
  relatorios/agenda.ts    marcarAgendaPendente, gerarRelatoriosPendentes
  nucleo/portas.ts      + AgendaGoogle, + Repositorio.escreverAbaLivre, + tabelas eventos/sessoes
  tabelas/esquema.ts    + eventos, sessoes
  tabelas/serializacao.ts + tipo de coluna numeroOpcional
  adaptadores/memoria.ts  + agendaMemoria, escreverAbaLivre
  adaptadores/gas.ts      + agendaGas (Calendar v3), escreverAbaLivre
  instalar.ts           cria a agenda do setor (AGENDA_ID)
  principal.ts          gatilhoMinutos: pendências da agenda e relatórios
app/src/
  telas/agenda/EventoForm.tsx, EventoDetalhe.tsx, ImprimirAgenda.tsx
  telas/inicio/InicioGestor.tsx, InicioBolsista.tsx
  telas/pessoal/AgendaGoogle.tsx (CartaoAgendaSetor)
  teste/renderizar.tsx  + opção aoCriarApi
```

---

### Task 1: Validação compartilhada do evento

**Files:**
- Create: `shared/src/eventos.ts`
- Create: `shared/src/eventos.test.ts`
- Modify: `shared/src/index.ts` (export)
- Modify: `shared/src/tipos.ts` (`Evento.atualizadoEm?: string`)
- Modify: `app/src/telas/agenda/EventoForm.tsx:45-49` (troca as 4 checagens pela função)

**Interfaces:**
- Produces:
  - `validarEvento(evento: Evento, sessoes: Sessao[]): string | null`. Devolve a primeira mensagem de erro, ou `null`.
  - `Evento.atualizadoEm?: string`.

- [ ] **Step 1: Write the failing tests** (`shared/src/eventos.test.ts`, usando as fábricas `evento` e `sessao` de `shared/src/teste/fabricas.ts`)

```ts
const ev = (p: Partial<Evento> = {}) => evento({ nome: 'Formatura', tipo: 'Formatura', pagamento: 'interno', ...p });
const ses = (p: Partial<Sessao> = {}) => sessao({ data: '2026-12-05', chegada: '07:30', inicio: '08:00', fim: '12:00', ...p });
it('aceita evento completo', () => expect(validarEvento(ev(), [ses()])).toBeNull());
it('as mensagens, na ordem das regras', () => {
  expect(validarEvento(ev({ nome: '  ' }), [ses()])).toBe('Informe o nome do evento.');
  expect(validarEvento(ev({ tipo: 'Festa' as never }), [ses()])).toBe('Escolha o tipo do evento.');
  expect(validarEvento(ev(), [])).toBe('O evento precisa de ao menos uma sessão.');
  expect(validarEvento(ev(), [ses({ data: '' })])).toBe('Todas as sessões precisam de data.');
  expect(validarEvento(ev({ pagamento: 'externo', pagadorExterno: ' ' }), [ses()])).toBe('Informe quem paga os bolsistas neste evento externo.');
});
it.each(['8:00', '25:00', '12h', '12:60'])('horário %s é recusado com a data da sessão', (h) => {
  expect(validarEvento(ev(), [ses({ data: '2026-12-05', inicio: h })])).toBe('Horário inválido na sessão de 05/12. Use HH:MM.');
});
it('horário vazio (null) é aceito; vagas negativas ou quebradas não', () => {
  expect(validarEvento(ev(), [ses({ chegada: null, inicio: null, fim: null, horarioADefinir: true })])).toBeNull();
  expect(validarEvento(ev(), [ses({ data: '2026-12-05', vagasBolsistas: -1 })])).toBe('Número de vagas inválido na sessão de 05/12.');
  expect(validarEvento(ev(), [ses({ data: '2026-12-05', minimoExperientes: 1.5 })])).toBe('Número de vagas inválido na sessão de 05/12.');
});
```

- [ ] **Step 2: Run them to verify they fail**

  Run: `npm test -w shared -- eventos`
  Expected: FAIL, "validarEvento is not a function".

- [ ] **Step 3: Implement `validarEvento` in `shared/src/eventos.ts`.**
  - Hora válida: `/^([01]\d|2[0-3]):[0-5]\d$/`.
  - Data válida: `/^\d{4}-\d{2}-\d{2}$/`.
  - Vagas: as três contagens precisam ser `Number.isInteger(n) && n >= 0`.
  - A ordem das regras é a da lista de testes.
  - Exporte em `index.ts`.

- [ ] **Step 4: Use the function in `EventoForm.salvar`.** Troque as 4 checagens por `const problema = validarEvento(ev, lista); if (problema) return setErro(problema);`.

- [ ] **Step 5: Run the tests to verify they pass**

  Run: `npm test -w shared && npm test -w app && npm run typecheck`
  Expected: PASS.

- [ ] **Step 6: Commit** — `feat(shared): validação de evento compartilhada entre app e API`

---

### Task 2: API de eventos: tabelas, listar e salvar

**Files:**
- Modify:
  - `api/src/nucleo/portas.ts` (`NomeTabela` += `'eventos' | 'sessoes'`)
  - `api/src/tabelas/esquema.ts`
  - `api/src/tabelas/serializacao.ts`
  - `api/src/nucleo/regras.ts`
  - `api/src/principal.ts` (`HANDLERS` += `handlersEventos`)
- Create:
  - `api/src/acoes/eventos.ts`
  - `api/test/eventos.test.ts`
- Test: `api/test/serializacao.test.ts`, `api/test/instalar.test.ts`

**Interfaces:**
- Consumes: `validarEvento` (Task 1); `exigirVersao`, `registrar` e `novoId` (fase 1).
- Produces:
  - `handlersEventos: Handlers`, com `eventos.listar` e `eventos.salvar` nesta task.
  - `paraEvento(linha): Evento` e `paraSessao(linha): Sessao`, exportadas para as Tasks 3, 4 e 6.
  - O tipo de coluna `'numeroOpcional'`: célula vazia ↔ `null`.
  - As colunas internas `googleEventoId` e `agendaPendente` em `sessoes`. Elas **nunca** saem para o app.

**Colunas:**

```
eventos: t nome, t tipo, t organizador, t contatoOrganizador, t servidorResponsavelId, o publicoEstimado,
         o publicoReal, t pagamento, t pagadorExterno, t instrumento, t status, t observacoes
sessoes: t eventoId, t data, t rotulo, t chegada, t inicio, t fim, b horarioADefinir, n vagasBolsistas,
         n vagasServidores, o diaria, n minimoExperientes, t status, t publicadaEm, t convocacaoAbertaAte,
         n convocacaoVagas, t googleEventoId, b agendaPendente
```

Legenda: `o` = `numeroOpcional`.

**Conversão da planilha para o app:**
- Textos opcionais vazios (`servidorResponsavelId`, `pagadorExterno`, `observacoes`, `rotulo`) somem do objeto.
- `publicoEstimado`, `publicoReal` e `diaria` vazios viram ausente/`null`.
- `chegada`, `inicio`, `fim` e `publicadaEm` vazios viram `null`.
- `convocacao` vira `null` sem `convocacaoAbertaAte`; com ela, vira `{ abertaAte, vagas }`.

- [ ] **Step 1: Write the failing tests**
  - Em `serializacao.test.ts`, `numeroOpcional`:
    - `''` → `null`;
    - `'120'` → `120`;
    - `'abc'` → `null`;
    - na escrita, `null` → `''`.
  - Em `instalar.test.ts`: `abasDe('dados')` contém `eventos` e `sessoes`.
  - Em `eventos.test.ts`, com `criarAmbiente({ handlers: handlersEventos })`, gestor `p01` e bolsista `p02`:

```ts
it('cria evento com duas sessões e devolve o que ficou gravado', ...)
  // salvar com id '' no evento e nas sessões → ids gerados; listar de 2026-12-01 a 2026-12-31 devolve as 2 sessões;
  // inicio vazio volta null; publicoReal não informado não aparece; googleEventoId e agendaPendente não aparecem
it('listar traz só sessões do período e os eventos delas', ...)
it('recusa com a mensagem da validação', ...)            // { erro: { codigo: 'VALIDACAO', mensagem: 'Informe o nome do evento.' } }
it('segundo gestor com versão antiga recebe CONFLITO', ...) // atualizadoEm antigo → codigo 'CONFLITO'
it('sessão de outro evento é recusada e não muda de evento', ...) // codigo 'NAO_ENCONTRADO', mensagem 'Sessão não encontrada neste evento.'
it('sessão retirada do formulário é apagada; publicada não', ...)
  // publicadaEm preenchida → codigo 'SESSAO_PUBLICADA', mensagem 'A sessão de 05/12 já foi publicada. Cancele-a em vez de remover.'
it('evento cancelado não pode ser editado', ...)          // codigo 'EVENTO_CANCELADO', mensagem 'Este evento foi cancelado e não pode ser alterado.'
it('bolsista lista, mas não salva', ...)                   // salvar → SEM_PERMISSAO
it('histórico registra quem criou e quem alterou', ...)    // acoes 'criou evento' e 'alterou evento'
```

- [ ] **Step 2: Run them to verify they fail**

  Run: `npm test -w api -- eventos serializacao instalar`
  Expected: FAIL, porque `handlersEventos` ainda não existe e `numeroOpcional` é desconhecido.

- [ ] **Step 3: Implement.**
  - Tipo de coluna `numeroOpcional`: na leitura, vazio ou não numérico → `null`; na escrita, `null` → `''`.
  - Tabelas `eventos` e `sessoes`, as duas na planilha `dados`.
  - `eventos.salvar`, nesta ordem:
    1. `validarEvento` (erro `VALIDACAO`);
    2. carrega o anterior e confere a versão;
    3. evento cancelado → `EVENTO_CANCELADO`;
    4. um `id` de sessão que não é deste evento → `NAO_ENCONTRADO`;
    5. sessões retiradas do formulário: se alguma tem `publicadaEm` → `SESSAO_PUBLICADA`; senão `repo.remover`;
    6. grava o evento: `status` vem do anterior, ou `'ativo'` se é novo;
    7. grava cada sessão. Uma sessão nova recebe `novoId(portas, 's')`, `status: 'ativa'` e `publicadaEm: null`; uma existente preserva `googleEventoId`, `agendaPendente` e `publicadaEm`;
    8. `registrar`;
    9. devolve `{ evento, sessoes }` relidos.
  - A notificação de "horário definido" aos escalados **fica para a fase 3**, junto com as escalas. Deixe um comentário de uma linha no lugar.
  - Em `ACOES_FASE`, as quatro ações com as regras de Global Constraints. `eventos.cancelar` e `sessoes.cancelar` respondem `NAO_DISPONIVEL` até a Task 3.

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npm test -w api && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat(api): eventos e sessões na planilha (listar e salvar)`

---

### Task 3: Cancelar evento e sessão

**Files:**
- Modify: `api/src/acoes/eventos.ts`
- Test: `api/test/eventos.test.ts`

**Interfaces:**
- Produces:
  - `eventos.cancelar({ eventoId, justificativa })` e `sessoes.cancelar({ sessaoId, justificativa })`. Ambas devolvem `null`.
  - `idsSessoesAfetadas`: as duas ações devolvem internamente a lista de sessões alteradas, que a Task 4 usa para sincronizar.

- [ ] **Step 1: Write the failing tests**

```ts
it('cancelar evento cancela todas as sessões e registra a justificativa', ...)
  // status 'cancelado'; sessões 'cancelada'; historico acao 'cancelou o evento', justificativa 'Chuva forte'
it('cancelar uma sessão mantém o evento e as outras sessões ativas', ...)
it('justificativa em branco é recusada', ...)  // codigo 'JUSTIFICATIVA', mensagem 'Informe o motivo do cancelamento.'
it('cancelar de novo não dá erro nem duplica o histórico', ...)
it('evento ou sessão inexistente', ...)        // 'Evento não encontrado.' / 'Sessão não encontrada.' (NAO_ENCONTRADO)
```

- [ ] **Step 2: Run them to verify they fail**

  Run: `npm test -w api -- eventos`
  Expected: FAIL com `NAO_DISPONIVEL`.

- [ ] **Step 3: Implement.**
  - A justificativa vai no 7º parâmetro de `registrar`.
  - Marcar as escalas como `cancelado` e avisar os escalados **fica para a fase 3**. Deixe um comentário de uma linha.

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npm test -w api`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat(api): cancelar evento e sessão com justificativa`

---

### Task 4: Agenda Google do setor

**Files:**
- Modify:
  - `api/src/nucleo/portas.ts`
  - `api/src/adaptadores/memoria.ts`
  - `api/src/adaptadores/gas.ts`
  - `api/src/acoes/eventos.ts`
  - `api/src/acoes/sistema.ts`
  - `api/src/instalar.ts`
  - `api/src/principal.ts`
  - `api/appsscript.json`
  - `api/test/apoio.ts`
- Create:
  - `api/src/agenda/eventoAgenda.ts`
  - `api/src/agenda/sincronizar.ts`
  - `api/test/agenda.test.ts`
- Test: `api/test/build.test.ts`, `api/test/sistema.test.ts`

**Interfaces:**
- Consumes: `paraEvento` e `paraSessao` (Task 2); as sessões afetadas (Tasks 2 e 3).
- Produces:

```ts
// nucleo/portas.ts
export type QuandoAgenda = { diaInteiro: true; dia: DataISO } | { diaInteiro: false; inicio: string; fim: string }; // 'AAAA-MM-DDTHH:MM'
export interface EventoAgenda { titulo: string; descricao: string; quando: QuandoAgenda; convidados: string[] }
export interface AgendaGoogle {
  ligada(): boolean;
  /** Cria (id null) ou atualiza; devolve o id do evento no Google. Lança erro se o Google falhar. */
  salvar(id: string | null, evento: EventoAgenda): string;
  remover(id: string): void;
}
// Portas ganha: agenda: AgendaGoogle

// agenda/eventoAgenda.ts
export function eventoDaAgenda(evento: Evento, sessao: Sessao, o: { responsavel: string; linkApp: string | null; convidados: string[] }): EventoAgenda;
// agenda/sincronizar.ts
export function sincronizarAgenda(portas: Portas, sessaoIds: string[]): void;
export function removerDaAgenda(portas: Portas, googleIds: string[]): void; // melhor esforço: ignora falhas
export function sincronizarPendentes(portas: Portas): number;              // devolve quantas ficaram certas
// adaptadores/memoria.ts
export function agendaMemoria(ligada?: boolean): AgendaGoogle & { eventos: Map<string, EventoAgenda>; falhar: boolean };
```

**Regras de `eventoDaAgenda`:**
- **Título:** `nome` + `' – ' + rotulo`, se a sessão tiver rótulo.
  - Começa com `'CANCELADO – '` se a sessão estiver `cancelada` ou o evento `cancelado`.
  - Termina com `' (horário a definir)'` quando o evento for de dia inteiro.
- **Início:** `inicio`, ou `chegada` se não houver `inicio`. Sem nenhum dos dois, ou com `horarioADefinir`, o evento é `{ diaInteiro: true, dia: data }`.
- **Fim:** `fim`, ou o início + 1 h se não houver `fim`. Se `fim <= início`, o fim cai no dia seguinte.
- **Descrição:** uma linha por item, só os presentes:
  - `Organizador: X`;
  - `Servidor responsável: Nome`;
  - `Chegada da equipe: HH:MM`, ou `Chegada da equipe: a definir`;
  - `Ver no GestorCC: <linkApp>/agenda/<eventoId>`.

  Nunca leva `contatoOrganizador`.

**Sincronização:**
- `linkApp` vem da propriedade opcional `URL_APP`, sem `/` no final; sem ela, `null`.
- `convidados` é `[]` nesta fase. A fase 3 preenche com os escalados publicados que têm `convitesAgenda`. Deixe um comentário de uma linha.
- Agenda desligada (`ligada()` falso): não faz nada e não marca pendência.
- Erro do Google: grava `agendaPendente: true`. Sucesso: grava `googleEventoId` e `agendaPendente: false`.

- [ ] **Step 1: Write the failing tests** (`agenda.test.ts`)

```ts
describe('eventoDaAgenda', () => {
  it('título, horário e descrição sem dados pessoais', ...)  // descricao não contém o contatoOrganizador
  it('horário a definir vira dia inteiro', ...)               // titulo termina com ' (horário a definir)'
  it('sessão que passa da meia-noite termina no dia seguinte', ...)
    // data '2026-12-05', inicio '22:00', fim '01:00' → { inicio: '2026-12-05T22:00', fim: '2026-12-06T01:00' }
  it('sem fim dura 1 hora; sem início usa a chegada', ...)
  it('cancelado ganha o prefixo', ...)                         // 'CANCELADO – Formatura Medicina – Manhã'
});
describe('sincronização', () => {
  it('salvar evento cria um evento por sessão e guarda o id do Google', ...)
  it('alterar a sessão atualiza o mesmo evento, sem criar outro', ...)  // agenda.eventos.size continua igual
  it('cancelar evento atualiza o título no Google', ...)
  it('sessão removida some do Google', ...)
  it('Google fora do ar: a gravação vale e a sessão fica pendente até o gatilho', ...)
    // agenda.falhar = true → salvar ok, sessão agendaPendente; falhar = false → sincronizarPendentes() === 1, pendência some
  it('agenda não criada: nada é enviado e nada fica pendente', ...)
});
```

Inclua também:
- em `sistema.test.ts`, `config.obter` com `AGENDA_ID` e `AGENDA_CONTA` nas propriedades devolve:
  ```ts
  agendaSetor: { nome: 'Centro de Convenções UFSM', conta: AGENDA_CONTA,
                 link: 'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(AGENDA_ID), conectada: true }
  ```
  Sem `AGENDA_ID`, `conectada: false` e `link: ''`;
- em `build.test.ts`, o manifesto:
  - tem o escopo `https://www.googleapis.com/auth/calendar`;
  - tem `dependencies.enabledAdvancedServices` com `{ userSymbol: 'Calendar', serviceId: 'calendar', version: 'v3' }`;
  - continua sem nenhum escopo de e-mail.

- [ ] **Step 2: Run them to verify they fail**

  Run: `npm test -w api -- agenda sistema build`
  Expected: FAIL.

- [ ] **Step 3: Implement the pure part.**
  - A porta, `agendaMemoria` e a inclusão de `agenda` em `apoio.ts`. Os testes usam `agendaMemoria(true)`, e o `criarAmbiente` aceita `{ agenda }`.
  - `eventoDaAgenda`, `sincronizarAgenda`, `removerDaAgenda` e `sincronizarPendentes`.
  - As chamadas em `eventos.salvar`, `eventos.cancelar` e `sessoes.cancelar`, **depois** de gravar. `removerDaAgenda` recebe os `googleEventoId` das sessões apagadas.
  - Em `config.obter`, `agendaSetor` vem sempre das propriedades. O que estiver salvo em `config` é ignorado para esse campo.

- [ ] **Step 4: Implement the Apps Script part** (sem teste unitário, conferida na Task 7).
  - **Manifesto:**
    - escopo `https://www.googleapis.com/auth/calendar`;
    - `"dependencies": { "enabledAdvancedServices": [{ "userSymbol": "Calendar", "serviceId": "calendar", "version": "v3" }] }`.
  - **`agendaGas`:**
    - O id da agenda vem da propriedade `AGENDA_ID`. `ligada()` = `!!AGENDA_ID`.
    - `salvar`:
      - sem id, `Calendar.Events.insert(recurso, agendaId, { sendUpdates: 'none' })`;
      - com id, `Calendar.Events.patch(recurso, agendaId, id, { sendUpdates: 'none' })`. Se o `patch` falhar porque o evento foi apagado à mão no Google, faz o `insert` e devolve o id novo.
    - O `recurso` tem `summary`, `description`, `start`/`end`, `attendees` (de `convidados`), `guestsCanSeeOtherGuests: false` e `guestsCanInviteOthers: false`.
      - Com horário, `start`/`end` são `{ dateTime: 'AAAA-MM-DDTHH:MM:00', timeZone: 'America/Sao_Paulo' }`.
      - Em dia inteiro, `start` é `{ date: dia }` e `end` é `{ date: somarDias(dia, 1) }`.
    - `remover`: `Calendar.Events.remove(agendaId, id, { sendUpdates: 'none' })`.
    - Se o `@types/google-apps-script` não declarar `Calendar`, declare só o mínimo usado num `declare const Calendar` local.
  - **`instalar`:**
    - Sem `AGENDA_ID`, cria a agenda com `Calendar.Calendars.insert({ summary: 'Centro de Convenções UFSM', timeZone: 'America/Sao_Paulo' })` e guarda o id em `AGENDA_ID`.
    - Guarda em `AGENDA_CONTA` o `Calendar.Calendars.get('primary').id`, que é o e-mail da conta.
  - **`gatilhoMinutos`:** chama `sincronizarPendentes(portasGas())` dentro de `travaGas.executar(..., 10000)`. Se a trava estiver ocupada, só pula esta rodada.

- [ ] **Step 5: Run the tests to verify they pass**

  Run: `npm test -w api && npm run typecheck && npm run build -w api`
  Expected: PASS. Confira também que `api/dist/Code.js` não tem `MailApp` nem `GmailApp`.

- [ ] **Step 6: Commit** — `feat(api): agenda Google do setor sincronizada, sem e-mail de convite`

---

### Task 5: App da fase 2: só consultar o que está ligado

**Files:**
- Modify:
  - `app/src/teste/renderizar.tsx`
  - `app/src/telas/inicio/InicioGestor.tsx`
  - `app/src/telas/inicio/InicioBolsista.tsx`
  - `app/src/telas/agenda/EventoDetalhe.tsx`
  - `app/src/telas/pessoal/AgendaGoogle.tsx`
- Create: `app/src/telas/inicio/InicioFase2.test.tsx`, `app/src/telas/agenda/EventoDetalhe.test.tsx`

**Interfaces:**
- Produces: `renderizar({ ..., aoCriarApi?: (api) => void })`. O callback é chamado antes do `render`, para os testes espionarem as consultas iniciais.

Constante dos testes:

```ts
const FASE2 = 'pessoas,dadosPessoais,mural,formularios,configuracoes,eventos';
const DESLIGADAS = ['escalas.listar', 'rodadas.listar', 'disponibilidades.listar', 'almox.listar', 'contratos.listar', 'infra.listar'];
```

- [ ] **Step 1: Write the failing tests**
  - `InicioFase2.test.tsx`:
    - **'início do gestor na fase 2 mostra a agenda e não consulta áreas desligadas':**
      - usa `renderizar({ rota: '/', recursos: FASE2, aoCriarApi: (api) => (chamar = vi.spyOn(api, 'chamar')) })`;
      - espera o cartão "Hoje";
      - nenhuma chamada usa uma ação de `DESLIGADAS`;
      - o texto "Contratado em" não aparece.
    - **'início do bolsista na fase 2 não consulta escalas nem rodadas':** o mesmo, com `pessoa: 'bolsista'`.
  - `EventoDetalhe.test.tsx`, **'detalhe do evento na fase 2 esconde a escala e não consulta escalas.listar':**
    - abre um evento das fixtures;
    - o botão "Montar escala" e a coluna "Escala" não aparecem;
    - `escalas.listar` não é chamada.
  - Em `AgendaGoogle.test.tsx`, **'agenda do setor desconectada orienta a rodar instalar':**
    - com `config.obter` respondendo `conectada: false`, mostra "A agenda do setor ainda não foi criada";
    - não mostra o link.

- [ ] **Step 2: Run them to verify they fail**

  Run: `npm test -w app -- InicioFase2 EventoDetalhe AgendaGoogle`
  Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **Consultas de áreas desligadas:** em cada `useConsulta` de área desligada, combine `habilitada` com `recursoAtivo(...)`:

    | Consultas | Recurso |
    |---|---|
    | escalas, rodadas e disponibilidades no Início do gestor e no detalhe do evento | `escalas` |
    | escalas e rodadas no Início do bolsista | `escalasPessoais` |
    | almoxarifado | `almoxEstoque` |
    | contratos | `contratos` |
    | infraestrutura | `infraestrutura` |

  - **`EventoDetalhe`:**
    - esconde "Montar escala" e a coluna "Escala" sem `escalas`;
    - no aviso de cancelamento, a frase sobre escalados só aparece com `escalas`.
  - **`CartaoAgendaSetor`:**
    - **Desconectada:** mostra "A agenda do setor ainda não foi criada. Rode `instalar` no projeto do Apps Script."
    - **Conectada:** mostra o botão "Adicionar ao meu Google Agenda", que aponta para `link`.
    - **A nota "Protótipo: …":** só aparece com `MODO_PROTOTIPO`.

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npm test -w app && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat(app): fase 2 liga a Agenda sem consultar áreas desligadas`

---

### Task 6: Aba AGENDA na planilha de Relatórios

**Files:**
- Create:
  - `shared/src/agendaMes.ts`
  - `shared/src/agendaMes.test.ts`
  - `api/src/relatorios/agenda.ts`
  - `api/test/relatorios.test.ts`
- Modify:
  - `app/src/telas/agenda/ImprimirAgenda.tsx` (usa `agendaDoMes`, `horarioSessao`, `rotuloDiaAgenda`)
  - `api/src/nucleo/portas.ts`
  - `api/src/adaptadores/memoria.ts`
  - `api/src/adaptadores/gas.ts`
  - `api/src/acoes/eventos.ts`
  - `api/src/acoes/sistema.ts` (`feriados.salvar`)
  - `api/src/principal.ts`

**Interfaces:**
- Consumes: `paraEvento` e `paraSessao` (Task 2).
- Produces:

```ts
// shared/src/agendaMes.ts — mesma regra que a impressão já usa (ImprimirAgenda.tsx:12-20 e 169-177)
export interface LinhaAgendaMes {
  dia: DataISO; feriado: string | null;
  eventos: { nome: string; responsavel: string; respNugac: string }[]; horarios: string[];
}
export function agendaDoMes(ano: number, mes: number, d: { eventos: Evento[]; sessoes: Sessao[]; feriados: Feriado[]; nomeServidor: (id: string) => string }): LinhaAgendaMes[];
export function horarioSessao(s: Sessao): string;   // 'Manhã: 08:00 - 12:00' | 'a definir'
export function rotuloDiaAgenda(d: DataISO): string; // 'Sábado, 05'
// Repositorio ganha:
escreverAbaLivre(p: Planilha, nome: string, linhas: string[][]): void; // cria a aba se faltar, limpa e escreve
// relatorios/agenda.ts
export function marcarAgendaPendente(props: Propriedades, meses: string[]): void; // 'AAAA-MM', em RELATORIOS_PENDENTES (JSON)
export function gerarRelatoriosPendentes(portas: Portas): string[];              // nomes das abas escritas
```

**Regras:**
- **Aba:** `AGENDA ${mesExtenso(mes).toUpperCase()} ${ano}`, por exemplo `AGENDA DEZEMBRO 2026`.
- **Linhas:**
  - a primeira é o cabeçalho `DIA | EVENTO | RESPONSÁVEL | RESP NUGAC | HORÁRIO`;
  - depois, uma linha por dia do mês;
  - vários eventos no mesmo dia ficam numa célula só, separados por quebra de linha;
  - dia de feriado sem evento vira `[rotulo, 'FERIADO – <nome>', '', '', '']`.
- **O que entra:** só sessões `ativa` de eventos `ativo`.
- **Responsável:** `organizador`, mais `' / ' + contatoOrganizador` se houver contato.
- **Resp. NUGAC:** o primeiro nome do servidor.
- **Quando refazer:**
  - `eventos.salvar`, `eventos.cancelar` e `sessoes.cancelar` marcam os meses das sessões, as antigas e as novas;
  - `feriados.salvar` marca os meses dos feriados antigos e novos do ano;
  - `gatilhoMinutos` gera as pendentes, dentro da mesma trava da Task 4, e limpa a marca.

- [ ] **Step 1: Write the failing tests**
  - `agendaMes.test.ts`:
    - dezembro tem 31 linhas;
    - um feriado sem evento;
    - um dia com 2 eventos;
    - sessão cancelada fica de fora;
    - `horarioSessao` com rótulo e com horário a definir.
  - `relatorios.test.ts`:
    - **'salvar evento marca o mês e o gatilho escreve a aba':** depois do `eventos.salvar` em 2026-12, `gerarRelatoriosPendentes` devolve `['AGENDA DEZEMBRO 2026']`, a aba tem 32 linhas e o cabeçalho certo, e não há mais pendências;
    - **'mudar feriado marca o mês do feriado'**;
    - **'sem pendências não escreve nada'.**
  - O teste da impressão (`ImprimirAgenda.test.tsx`) precisa continuar passando sem mudanças.

- [ ] **Step 2: Run them to verify they fail**

  Run: `npm test -w shared -- agendaMes && npm test -w api -- relatorios`
  Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Mova `rotuloDia` e `horario` de `ImprimirAgenda.tsx` para o `shared` e use `agendaDoMes` no modelo legado. O modelo atualizado continua usando `doDia`.
  - **`escreverAbaLivre`:**
    - na memória, um `Map`;
    - no Apps Script:
      - `getSheetByName ?? insertSheet`;
      - `clearContents`;
      - `setValues` com `paraCelula`;
      - cabeçalho em negrito, nas cores da fase 1;
      - a primeira linha congelada.

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `npm test && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat: aba AGENDA do mês na planilha de Relatórios`

---

### Task 7: Publicação da fase 2

**Files:**
- Modify:
  - `api/src/versao.ts` (`'0.2.0'`)
  - `api/test/sistema.test.ts`
  - `app/.env.exemplo`
  - `docs/implantacao.md`
  - `api/test/implantacao.test.ts`
  - os arquivos locais `app/.env.teste` e `app/.env.producao`, que ficam fora do git

- [ ] **Step 1: Write the failing tests.**
  - `sistema.ping` devolve `'0.2.0'`.
  - `implantacao.test.ts` confere que o guia cita `Centro de Convenções UFSM`, `URL_APP` e o valor de `VITE_RECURSOS` com `eventos`.

- [ ] **Step 2: Run them to verify they fail.**

  Run: `npm test -w api -- sistema implantacao`
  Expected: FAIL.

- [ ] **Step 3: Update the version, `.env.exemplo` and the guide.** O guia ganha uma seção "Agenda Google do setor" com estes passos:
  1. Colar o manifesto e o `Code.js` novos.
  2. Rodar `instalar` de novo. Ele cria as abas `eventos` e `sessoes` e a agenda, e pede a permissão de Agenda.
  3. **Nova versão** da implantação.
  4. No Google Agenda, compartilhar a agenda "Centro de Convenções UFSM" com a equipe, com a opção "Ver todos os detalhes do evento".
  5. Opcional: a propriedade `URL_APP` com o endereço do site, para o link na descrição dos eventos.

- [ ] **Step 4: Run the whole suite and the build.**

  Run: `npm test && npm run typecheck && npm run build -w api`
  Expected: PASS.

- [ ] **Step 5: Commit** — `chore: fase 2 pronta para publicar (versão 0.2.0)`

- [ ] **Step 6: Publish together with the user** (só a produção; o ambiente de teste segue parado, como combinado na fase 1).
  1. O usuário cola os dois arquivos e roda `instalar`.
  2. O usuário cria a nova versão da implantação e confere `"versao":"0.2.0"` no `/exec`.
  3. Rodar `npm run deploy:app:producao`.
  4. Teste completo:
     - criar um evento com 2 sessões, e elas aparecem na agenda "Centro de Convenções UFSM";
     - mudar um horário, e o mesmo evento é atualizado no Google;
     - cancelar uma sessão, e ela aparece como "CANCELADO – …";
     - imprimir o mês nos dois modelos;
     - ver as estatísticas;
     - em até 5 minutos, a aba "AGENDA <MÊS> <ANO>" aparece na planilha de Relatórios;
     - nenhum e-mail chega.
