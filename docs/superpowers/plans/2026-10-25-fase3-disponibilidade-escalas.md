# GestorCC — Fase 3: Disponibilidade e escalas — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar o ciclo completo da escala com dados reais, para o GestorCC substituir o Gerador de Escala no dia a dia (spec 15). O ciclo é: rodada → disponibilidade → montagem → publicação → trocas, convocação extra e presença → avaliações e relatórios.

**Architecture:** As ações `rodadas.*`, `disponibilidades.*`, `escalas.*` e `avaliacoes.*` entram na API no padrão das fases 1 e 2: handlers puros sobre as portas, com testes no repositório em memória.

As regras de montagem já existem em `shared/escala/*` e o app as usa. A API repete no servidor só o que **bloqueia**:
- conflito de horário;
- papel (servidor ou bolsista);
- prazo;
- sessão cancelada.

Também entram aqui as pendências da fase 2: escalas canceladas junto com a sessão, aviso de horário definido e convidados no Google Agenda. As telas do protótipo já existem e só ganham ajustes de fase.

**Tech Stack:** o mesmo da fase 2. Não entra nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-10-24-gestorcc-design.md`, seções 4.1 (rodadas, rodadaSessoes, disponibilidades, escalas, avaliacoes), 5.3, 7.2–7.9, 7.11 (B), 8.1, 11 e 15.

## Global Constraints

- Mensagens de erro em português claro.
- Toda gravação passa pelo roteador: sessão, permissão, `idRequisicao`, trava de 10 s e `historico`.
- **O sistema não envia e-mails.**
  - Os avisos às pessoas são **notificações no app**, com `notificar` (fase 1).
  - Os convites do Google Agenda são silenciosos (`sendUpdates: 'none'`, fase 2).
- Permissões (spec 5.3 e o protótipo, `app/src/api/mock/mockCliente.ts:88-99`):

  | Quem | Ações |
  |---|---|
  | qualquer pessoa logada | `rodadas.listar`, `disponibilidades.listar`, `disponibilidades.marcar`, `escalas.listar` |
  | `escalas: editar` | `rodadas.salvar`, `escalas.salvarRascunho`, `escalas.publicar`, `escalas.trocar`, `escalas.convocar`, `escalas.confirmarPresenca`, `avaliacoes.salvar` |
  | `escalas: ver` | `avaliacoes.listar` |

- **Quem vê o quê.**
  - Rascunhos e disponibilidades de outras pessoas: só quem tem `escalas: ver`.
  - Quem é escalado vê as próprias sessões publicadas e os colegas delas (spec 7.3 e 7.4).
- Servidor ocupa só vaga de servidor, e bolsista, só vaga de bolsista (spec 7.3).
- `faltou` e `cancelado` nunca são pagos (spec 8.1). Nesta fase, `loteId` fica sempre vazio. A fase 4 cria os lotes.
- Áreas ligadas em produção nesta fase: `VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais`. Pagamentos, almoxarifado, contratos e infraestrutura continuam desligados. O app não chama `lotes.*` nem `ganhos.meus`.
- API publicada colando `api/dist/Code.js` e `api/dist/appsscript.json`, sem clasp. Custo zero. Nenhum dado pessoal real em testes.

## Review Focus

1. **Mesma disponibilidade marcada duas vezes seguidas** (toque duplo no celular, rede lenta). Fica uma linha só por pessoa e sessão, com a última resposta. → teste na Task 2.
2. **Marcar no limite do prazo.** No minuto exato do prazo é aceito; um minuto depois é recusado com `PRAZO`. → teste na Task 2.
3. **Mesma pessoa em duas sessões que se sobrepõem, de eventos diferentes.** O servidor recusa com `CONFLITO_HORARIO`, mesmo que o app deixe passar. → teste na Task 3.
4. **Presença confirmada de novo para corrigir uma falta.** `faltou` volta a `realizado` e ninguém fica com as duas situações. → teste na Task 4.
5. **Sessão cancelada com escalas publicadas.**
   - As escalas viram `cancelado` e os escalados recebem notificação.
   - O evento no Google perde os convidados e ganha "CANCELADO –".
   - Uma troca nessa sessão é recusada.

   → teste na Task 5.

---

## Estrutura de arquivos

```
shared/src/tipos.ts            Rodada.sessoesNovas?: Id[]
api/src/acoes/rodadas.ts       rodadas.listar/salvar, disponibilidades.listar/marcar, incluirEmRodadaAberta
api/src/acoes/escalas.ts       escalas.listar/salvarRascunho/publicar/trocar/convocar/confirmarPresenca
api/src/acoes/avaliacoes.ts    avaliacoes.listar/salvar
api/src/escalas/comum.ts       LinhaEscala, linhas*, nomeSessao, contextoEscala, exigirSemConflito
api/src/acoes/eventos.ts       pendências da fase 2 (cancelar escalas, horário definido)
api/src/agenda/sincronizar.ts  convidados = escalados publicados com convitesAgenda
api/src/relatorios/            agenda.ts → pendentes.ts (chaves) + escala.ts (ESCALA, CONSULTA, HISTÓRICO DE TROCAS)
app/src/                       rotas.tsx, layout/menu.ts, layout/Shell.tsx, telas/pessoal/MinhaDisponibilidade.tsx
```

---

### Task 1: Tabelas da fase 3 e funções comuns da escala

**Files:**
- Modify:
  - `api/src/nucleo/portas.ts` (`NomeTabela` += `'rodadas' | 'rodadaSessoes' | 'disponibilidades' | 'escalas' | 'avaliacoes'`)
  - `api/src/tabelas/esquema.ts`
  - `shared/src/tipos.ts` (`Rodada.sessoesNovas?: Id[]`)
- Create: `api/src/escalas/comum.ts`, `api/test/escalasComum.test.ts`
- Test: `api/test/instalar.test.ts`

**Colunas** (todas na planilha `dados`):

```
rodadas:          t nome, t prazo, t status
rodadaSessoes:    t rodadaId, t sessaoId, b nova                 id = `${rodadaId}:${sessaoId}`
disponibilidades: t pessoaId, t sessaoId, b disponivel, t origem, d respondidoEm   id = `${pessoaId}:${sessaoId}`
escalas:          t sessaoId, t pessoaId, t papel, t status, b adicaoDireta, t loteId
avaliacoes:       t pessoaId, t mes, n nota, t observacao, t autorId          id = `${pessoaId}:${mes}`
```

**Interfaces:**
- Consumes: `paraEvento`, `paraSessao`, `linhasEventos`, `linhasSessoes`, `LinhaSessao` (fase 2); `temConflito`, `ContextoEscala` (`shared/escala/autoPreencher.ts`).
- Produces (`api/src/escalas/comum.ts`):

```ts
export interface LinhaEscala { id: string; sessaoId: string; pessoaId: string; papel: 'bolsista' | 'servidor'; status: StatusEscala; adicaoDireta: boolean; loteId: string }
export const linhasEscalas: (ctx: Contexto) => LinhaEscala[];
export function paraEscala(l: LinhaEscala): Escala;                 // loteId '' → null
export function nomeSessao(evento: Evento, sessao: Sessao): string; // 'Formatura Teste (05/12)'
export function contextoEscala(ctx: Contexto): ContextoEscala;      // pessoas ativas, sessões ativas, escalas, disponibilidades
/** Lança CONFLITO_HORARIO se a pessoa já tem escala que conta (contaNaEscala) em sessão sobreposta. */
export function exigirSemConflito(ctx: Contexto, pessoaId: string, sessao: Sessao): void;
```

Mensagem de `exigirSemConflito`: `` `${nomeCurto} já está escalado(a) em outra sessão no mesmo horário (${DD/MM}).` ``

- [ ] **Step 1: Write the failing tests**
  - Em `instalar.test.ts`: `abasDe('dados')` contém as 5 tabelas.
  - Em `escalasComum.test.ts`:
    - `nomeSessao` → `'Formatura Teste (05/12)'`;
    - `exigirSemConflito`:
      - lança `CONFLITO_HORARIO` para uma sessão de **outro evento** das 08:00 às 12:00, quando a pessoa já está `publicado` numa das 10:00 às 14:00 no mesmo dia;
      - não lança se aquela escala está `cancelado`;
      - não lança para sessões das 08:00 às 10:00 e das 10:00 às 12:00, porque encostar não é sobrepor.

- [ ] **Step 2: Run them to verify they fail.**

  Run: `npm test -w api -- instalar escalasComum`
  Expected: FAIL.

- [ ] **Step 3: Implement** o esquema, o tipo e `comum.ts`. `contextoEscala` monta o `ContextoEscala` a partir do repositório, usando `paraSessao`/`paraEscala`.

- [ ] **Step 4: Run them to verify they pass.**

  Run: `npm test -w api && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat(api): tabelas da escala e regras comuns`

---

### Task 2: Rodadas e disponibilidade

**Files:**
- Create: `api/src/acoes/rodadas.ts`, `api/test/rodadas.test.ts`
- Modify:
  - `api/src/nucleo/regras.ts`
  - `api/src/principal.ts`
  - `api/src/acoes/eventos.ts` (sessão nova entra em rodada aberta)

**Interfaces:**
- Produces:
  - `handlersRodadas: Handlers`;
  - `sessaoAbertaPara(ctx: Contexto, sessaoId: string): 'rodada' | 'convocacao' | null`;
  - `incluirEmRodadaAberta(ctx: Contexto, sessaoIds: string[]): void`.

**Regras:**

- **`rodadas.salvar(r: Rodada)`**: cria quando `id` vem vazio; atualiza quando vem preenchido.
  - **Validações** (todas com o código `VALIDACAO`):

    | Problema | Mensagem |
    |---|---|
    | nome vazio | `'Informe o nome da rodada.'` |
    | prazo que não segue `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/` | `'Informe o prazo da rodada.'` |
    | nenhuma sessão | `'Escolha ao menos uma sessão.'` |
    | sessão inexistente ou cancelada | `'Sessão não encontrada ou cancelada.'` |

  - **Sessões:** grava `rodadaSessoes` (adiciona as novas e remove as retiradas).
  - **Ao criar:**
    - notifica pessoas ativas: `` `Rodada de disponibilidade aberta: ${nome}. Responda até ${DD/MM} às ${HH:MM}.` ``, link `'/disponibilidade'`;
    - histórico `'abriu a rodada'`.
  - **Ao alterar:** histórico `` `alterou a rodada (${status})` ``.
- **`rodadas.listar`**: devolve todas, com `sessaoIds` e `sessoesNovas` (as linhas com `nova = true`).
- **`sessaoAbertaPara`**: a sessão está ativa e uma destas vale:
  - convocação com `abertaAte >= agora` → `'convocacao'`;
  - rodada `aberta` com `prazo >= agora` que inclui a sessão → `'rodada'`.
- **`disponibilidades.listar({ sessaoIds })`**: com `escalas: ver`, devolve todas; sem isso, só as próprias.
- **`disponibilidades.marcar({ sessaoId, disponivel, pessoaId? })`**:
  - **Marcando para outra pessoa:** exige `escalas: editar`, grava `origem: 'gestor'` e registra no histórico `` `marcou disponibilidade por outra pessoa (${Sim|Não})` ``.
  - **Marcando para si mesmo:**
    - sem sessão aberta → `PRAZO`, `'O prazo para marcar disponibilidade nesta sessão terminou.'`;
    - pela convocação, já estando escalado na sessão → `JA_ESCALADO`, `'Você já está escalado(a) nesta sessão.'`;
    - `origem` é `'convocacao'` ou `'proprio'`.
  - **Gravação:** um único registro por `id = pessoaId:sessaoId`, atualizado se já existir. `respondidoEm = agora`.
- **`incluirEmRodadaAberta`**: chamada em `eventos.salvar` para as sessões **novas**.
  - Cada sessão nova entra, com `nova = true`, em toda rodada `aberta` com prazo no futuro que já tenha uma sessão do **mesmo mês** (spec 7.2.3).

- [ ] **Step 1: Write the failing tests**

```ts
it('gestor abre rodada; todos são avisados no app; bolsista lista', ...)
it('validações da rodada', ...)                       // as 4 mensagens
it('bolsista marca Sim e Não; fica uma linha só', ...) // marcar 2× → listar devolve 1, disponivel = último valor
it('prazo: no minuto exato vale, depois não', ...)     // prazo '2026-10-24T10:00' com relógio 10:00 ok; avancarMinutos(1) → PRAZO
it('gestor marca por outra pessoa, com histórico', ...) // origem 'gestor'
it('bolsista não vê a disponibilidade dos outros', ...)
it('sessão nova do mesmo mês entra na rodada aberta com selo nova', ...) // eventos.salvar → rodadas.listar().sessoesNovas contém
it('convocação aberta aceita só quem não está escalado', ...)           // origem 'convocacao'; escalado → JA_ESCALADO
```

- [ ] **Step 2: Run them to verify they fail.**

  Run: `npm test -w api -- rodadas`
  Expected: FAIL.

- [ ] **Step 3: Implement.** Registre as ações em `ACOES_FASE` e em `HANDLERS`.

- [ ] **Step 4: Run them to verify they pass.**

  Run: `npm test -w api && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat(api): rodadas e disponibilidade`

---

### Task 3: Montagem e publicação

**Files:**
- Create: `api/src/acoes/escalas.ts`, `api/test/escalas.test.ts`
- Modify:
  - `api/src/nucleo/regras.ts`
  - `api/src/principal.ts`
  - `api/src/agenda/sincronizar.ts` (convidados)

**Interfaces:**
- Consumes: `comum.ts` (Task 1).
- Produces:
  - `handlersEscalas: Handlers`, com `escalas.listar`, `escalas.salvarRascunho` e `escalas.publicar` nesta task;
  - `convidadosDaSessao(portas: Portas, sessaoId: string): string[]`, em `sincronizar.ts`. Devolve o `convitesAgenda` das pessoas **ativas** com escala `publicado` ou `realizado` nessa sessão.

**Regras:**

- **`escalas.listar({ de, ate })`** (como no protótipo):
  - com `escalas: ver`: todas as escalas das sessões do período;
  - sem isso: só as sessões em que a pessoa tem escala que não é rascunho, com os colegas dessas sessões, também sem rascunho.
- **`escalas.salvarRascunho({ sessaoId, itens })`**: substitui os rascunhos da sessão.
  - **Recusas:**

    | Situação | Código | Mensagem |
    |---|---|---|
    | sessão cancelada | `SESSAO_CANCELADA` | `'Esta sessão foi cancelada.'` |
    | pessoa inativa ou inexistente | `NAO_ENCONTRADO` | `'Pessoa não encontrada ou inativa.'` |
    | papel diferente do tipo da pessoa | `PAPEL` | `'Servidor só ocupa vaga de servidor, e bolsista, vaga de bolsista.'` |
    | conflito de horário | `CONFLITO_HORARIO` | a de `exigirSemConflito` |

  - **Já escalado:** quem já tem escala que conta nesta sessão é ignorado.
  - **`adicaoDireta`:** é calculada no servidor, `true` quando a pessoa não está disponível. Cada adição direta vai para o histórico: `` `escalou ${nomeCurto} sem disponibilidade` ``.
- **`escalas.publicar({ sessaoIds })`**:
  - `rascunho` → `publicado`, e `sessao.publicadaEm = agora` nas sessões que tinham rascunho;
  - notifica cada escalado: `'Sua escala foi publicada. Confira os horários.'`, link `'/minhas-escalas'`;
  - histórico `` `publicou ${n} sessão(ões)` ``;
  - `sincronizarAgenda` dessas sessões, agora com os convidados.

- [ ] **Step 1: Write the failing tests**

```ts
it('gestor monta rascunho; bolsista não vê rascunho', ...)
it('servidor em vaga de bolsista é recusado', ...)                 // PAPEL
it('conflito de horário com outro evento bloqueia no servidor', ...) // CONFLITO_HORARIO
it('escalar indisponível marca adição direta e registra', ...)
it('publicar avisa no app e mostra os colegas da sessão ao escalado', ...)
it('publicar põe no Google quem ativou os convites, sem expor os outros', ...)
  // agendaMemoria: convidados === ['bolsista.pessoal@exemplo.com'] (só quem tem convitesAgenda)
it('sessão cancelada não aceita rascunho', ...)                    // SESSAO_CANCELADA
```

- [ ] **Step 2: Run them to verify they fail.**

  Run: `npm test -w api -- escalas`
  Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Troque o `convidados: []` de `sincronizarAgenda` por `convidadosDaSessao`.
  - `perfil.salvarAgenda`, da fase 1, passa a chamar `sincronizarAgenda` para as sessões futuras em que a pessoa está publicada.

- [ ] **Step 4: Run them to verify they pass.**

  Run: `npm test -w api && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat(api): montar e publicar escala`

---

### Task 4: Trocas, convocação extra e presença

**Files:**
- Modify: `api/src/acoes/escalas.ts`, `api/src/nucleo/regras.ts`
- Test: `api/test/escalas.test.ts`

**Interfaces:**
- Produces:
  - `escalas.trocar`, `escalas.convocar` e `escalas.confirmarPresenca`;
  - o histórico da troca com `entidade: 'troca'`, `entidadeId: sessaoId`, `antes: { sai }`, `depois: { entra }` e `justificativa`. A Task 7 lê esse formato.

**Regras:**

- **`escalas.trocar({ sessaoId, sai, entra, justificativa })`** segue o protótipo (`mockCliente.ts:314-345`).
  - **Recusas:**

    | Situação | Código | Mensagem |
    |---|---|---|
    | justificativa vazia | `JUSTIFICATIVA` | `'Informe a justificativa da troca.'` |
    | sem quem sai e sem quem entra | `TROCA_VAZIA` | `'Escolha quem sai e/ou quem entra.'` |
    | quem sai não está escalado | `NAO_ENCONTRADO` | `'Esta pessoa não está escalada nesta sessão.'` |
    | papel diferente | `PAPEL` | `'Servidor só pode ser trocado por servidor, e bolsista por bolsista.'` |
    | quem entra já está na sessão | `DUPLICADO` | `'Esta pessoa já está escalada nesta sessão.'` |
    | sessão cancelada | `SESSAO_CANCELADA` | `'Esta sessão foi cancelada.'` |
    | conflito para quem entra | `CONFLITO_HORARIO` | a de `exigirSemConflito` |

  - **Quem sai:** a escala é removida.
  - **Quem entra:** recebe o `status` de quem saiu, ou `publicado` se ninguém saiu. `adicaoDireta` é verdadeira quando a pessoa não está disponível.
  - **Notificações e agenda:**
    - quem sai: `` `Você foi retirado(a) da escala: ${nomeSessao}.` ``;
    - quem entra: `` `Você foi escalado(a): ${nomeSessao}.` ``;
    - `sincronizarAgenda` da sessão.
- **`escalas.convocar({ sessaoId, vagas, abertaAte })`**:
  - **Recusas:**

    | Situação | Código | Mensagem |
    |---|---|---|
    | sessão sem `publicadaEm` | `NAO_PUBLICADA` | `'Publique a escala desta sessão antes de abrir convocação extra.'` |
    | `vagas` não é inteiro ≥ 1 | `VAGAS` | `'Informe ao menos 1 vaga extra.'` |
    | `abertaAte <= agora` | `PRAZO` | `'O prazo da convocação precisa ser no futuro.'` |

  - **Efeito:**
    - `vagasBolsistas += vagas`;
    - grava `convocacaoAbertaAte` e `convocacaoVagas`;
    - notifica os bolsistas ativos que não estão na sessão: `` `Precisamos de mais ${vagas} bolsista(s): ${nomeSessao}. Marque se puder.` ``, link `'/disponibilidade'`;
    - histórico com justificativa `'convocação extra'`;
    - devolve a `Sessao`.
- **`escalas.confirmarPresenca({ sessaoId, faltaram })`**:
  - **Recusa:** sessão com `data > hoje` → `FUTURA`, `'Esta sessão ainda não aconteceu.'`
  - **Efeito:**
    - escalas `publicado`, `realizado` ou `faltou` sem `loteId` passam a `faltou` se a pessoa está em `faltaram`, e a `realizado` se não está;
    - o histórico da sessão diz `` `confirmou presença (${n} falta(s))` ``;
    - para cada pessoa que **passou** a faltar, também vai `'faltou'` para o histórico da pessoa.

- [ ] **Step 1: Write the failing tests**

```ts
it('troca sai/entra com justificativa avisa os dois e fica no histórico de trocas', ...)
it('troca só entra (convocação extra) e só sai', ...)
it('troca recusa papel diferente, duplicado, conflito e sessão cancelada', ...)
it('convocação aumenta as vagas e avisa só bolsistas fora da sessão', ...)
it('convocação recusa sessão não publicada, vagas 0 e prazo no passado', ...)
it('presença: desmarcados viram faltou; confirmar de novo corrige a falta', ...) // faltou → realizado
it('presença de sessão futura é recusada', ...)                                 // FUTURA
```

- [ ] **Step 2: Run them to verify they fail.**

  Run: `npm test -w api -- escalas`
  Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them to verify they pass.**

  Run: `npm test -w api && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat(api): trocas, convocação extra e presença`

---

### Task 5: Cancelamentos e horário definido (pendências da fase 2)

**Files:**
- Modify: `api/src/acoes/eventos.ts`
- Test: `api/test/eventos.test.ts`

**Regras:**

- **`cancelarSessao` e `cancelarEvento`:**
  - as escalas das sessões afetadas, quando não estão `cancelado` e não têm `loteId`, passam a `cancelado`;
  - cada escalado recebe uma notificação: `` `Sessão cancelada: ${nomeSessao}. Você não precisa comparecer.` ``, link `'/minhas-escalas'`.

  Troque os comentários "fase 3" de `eventos.ts` pelo código.
- **`eventos.salvar`:** a sessão que tinha `horarioADefinir = true` e passou a ter horário notifica as pessoas com escala `publicado`: `` `Horário definido: ${evento.nome}, chegada às ${chegada}.` ``, link `'/minhas-escalas'`.

- [ ] **Step 1: Write the failing tests**

```ts
it('cancelar sessão cancela as escalas, avisa e tira os convidados do Google', ...)
it('cancelar evento cancela as escalas de todas as sessões', ...)
it('horário definido avisa só quem está publicado na sessão', ...)
```

- [ ] **Step 2: Run them to verify they fail.**

  Run: `npm test -w api -- eventos`
  Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them to verify they pass.**

  Run: `npm test -w api`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat(api): cancelar evento cancela as escalas e avisa os escalados`

---

### Task 6: Avaliações e app da fase 3

**Files:**
- Create: `api/src/acoes/avaliacoes.ts`, `api/test/avaliacoes.test.ts`, `app/src/telas/escalas/Fase3.test.tsx`
- Modify:
  - `api/src/nucleo/regras.ts`
  - `api/src/principal.ts`
  - `app/src/rotas.tsx:50`
  - `app/src/layout/menu.ts:50`
  - `app/src/layout/Shell.tsx:121-131`
  - `app/src/telas/pessoal/MinhaDisponibilidade.tsx` (ou `CalendarioDisponibilidade.tsx`)

**Regras:**

- **`avaliacoes.listar({ mes })`**: todas as do mês.
- **`avaliacoes.salvar(a)`**:
  - **Recusas:**

    | Situação | Código | Mensagem |
    |---|---|---|
    | nota que não é inteiro de 1 a 5 | `NOTA` | `'A nota vai de 1 a 5.'` |
    | `mes` fora de `AAAA-MM` | `VALIDACAO` | `'Mês inválido.'` |
    | bolsista inexistente | `NAO_ENCONTRADO` | `'Pessoa não encontrada.'` |

  - **Efeito:** um único registro por `pessoaId:mes`, atualizado se já existir; `autorId = eu`; histórico `'avaliou'`.
- **App:**
  - **Meus ganhos** (rota, item do menu e botão "Ganhos" da barra do celular) passa a depender do recurso `pagamentos`, não de `escalasPessoais`. Sem ele, a barra do celular mostra "Avisos", como já faz para servidores.
  - **Minha disponibilidade:** uma sessão em `rodada.sessoesNovas` mostra a etiqueta **"nova"**.
  - **O protótipo** mostra o selo também. No mock, `eventos.salvar` passa a incluir a sessão nova numa rodada aberta do mesmo mês, com a mesma regra da API.

Constante dos testes do app:

```ts
const FASE3 = 'pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais';
```

- [ ] **Step 1: Write the failing tests**
  - `avaliacoes.test.ts`:
    - salva e lista;
    - nota 0 e 6 → `NOTA`;
    - uma segunda avaliação no mesmo mês substitui a primeira;
    - bolsista → `SEM_PERMISSAO`.
  - `Fase3.test.tsx`:
    - **'bolsista na fase 3 tem escalas e disponibilidade, mas não Ganhos':**
      - `renderizar({ pessoa: 'bolsista', rota: '/', recursos: FASE3, aoCriarApi })`;
      - os links "Minhas escalas" e "Disponib." aparecem, e "Ganhos" não;
      - nenhuma chamada a `lotes.listar` ou `ganhos.meus`.
    - **'gestor percorre escalas sem chamar áreas desligadas':** abre `/escalas` (abas montar, publicadas, presença e avaliações) e nenhuma chamada usa `lotes.listar`, `ganhos.meus`, `almox.listar`, `contratos.listar` ou `infra.listar`.
    - **'sessão que entrou depois na rodada aparece como nova':**
      - cria pelo mock uma sessão no mês de uma rodada aberta;
      - em `/disponibilidade`, ela aparece com a etiqueta "nova".

- [ ] **Step 2: Run them to verify they fail.**

  Run: `npm test -w api -- avaliacoes && npm test -w app -- Fase3`
  Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them to verify they pass.**

  Run: `npm test && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat: avaliações e app da fase 3 (Ganhos só com pagamentos)`

---

### Task 7: Relatórios da escala na planilha

**Files:**
- Rename: `api/src/relatorios/agenda.ts` → `api/src/relatorios/pendentes.ts`. Mantém `marcarAgendaPendente` e `gerarRelatoriosPendentes`.
- Create: `api/src/relatorios/escala.ts`
- Modify:
  - `api/src/nucleo/portas.ts`, `api/src/adaptadores/memoria.ts`, `api/src/adaptadores/gas.ts` (formato opcional da aba)
  - quem marca pendências: `eventos.ts`, `escalas.ts`, `sistema.ts`
- Test: `api/test/relatorios.test.ts`

**Interfaces:**
- Produces:

```ts
// Repositorio: o 4º parâmetro é opcional (índices de linha, a partir de 0)
escreverAbaLivre(p: Planilha, aba: string, linhas: string[][], formato?: { negrito?: number[]; destaque?: number[] }): void;
// relatorios/pendentes.ts — chaves em RELATORIOS_PENDENTES
export function marcarRelatorios(props: Propriedades, chaves: string[]): void; // 'agenda:AAAA-MM' | 'escala:AAAA-MM' | 'trocas'
export const marcarAgendaPendente: (props: Propriedades, meses: string[]) => void; // = marcar 'agenda:'+mês
// relatorios/escala.ts
export function abaEscala(ano: number, mes: number, portas: Portas): { linhas: string[][]; negrito: number[]; destaque: number[] };
export function abaConsulta(ano: number, mes: number, portas: Portas): string[][];
export function abaTrocas(portas: Portas): string[][];
```

**Abas** (spec 11; rascunhos nunca aparecem):

- **`ESCALA <MÊS> <ANO>`**:
  - linha 0: `['NOME', ...uma coluna por sessão ativa: `${DD/MM} ${DIA_CURTO} – ${evento} – ${horarioSessao}`]`;
  - linha 1: `['ESTAR NO CC', ...chegada ou 'a definir']`;
  - depois, os servidores em ordem alfabética, seguidos dos bolsistas numerados (`'1. ANA F.'`) em ordem alfabética, com `nomeCurto`;
  - em cada célula, `'X'` para `publicado` ou `realizado` e `'F'` para `faltou`;
  - `negrito`: as linhas dos experientes; `destaque`: as linhas de `escalarMenos`.
- **`CONSULTA <MÊS> <ANO>`**:
  - cabeçalho `NOME | TIPO | ESCALAS NO MÊS | EVENTOS`;
  - uma linha por pessoa ativa;
  - eventos como `` `${DD/MM} ${evento}` `` separados por quebra de linha;
  - conta só `publicado` e `realizado`.
- **`HISTÓRICO DE TROCAS`**:
  - cabeçalho `DATA/HORA | EVENTO/DATA | SAIU | ENTROU | JUSTIFICATIVA`;
  - da mais recente para a mais antiga;
  - vem do histórico com `entidade: 'troca'`.

**Compatibilidade e marcações:**
- Uma chave antiga só com `AAAA-MM`, da fase 2, vale como `agenda:AAAA-MM`.
- **Quem marca o quê:**

  | Gravação | Marca |
  |---|---|
  | `escalas.publicar`, `confirmarPresenca`, `convocar`, cancelamentos e `eventos.salvar` | `escala:` dos meses afetados |
  | `escalas.trocar` | `escala:` do mês e `trocas` |

- **No Apps Script:**
  - linhas em `negrito` → `setFontWeight('bold')`;
  - linhas em `destaque` → `setBackground('#FFF4C2')`.

- [ ] **Step 1: Write the failing tests** (`relatorios.test.ts`)

```ts
it('publicar marca a escala do mês e o gatilho escreve ESCALA e CONSULTA', ...)
  // abas 'ESCALA DEZEMBRO 2026' e 'CONSULTA DEZEMBRO 2026'; servidor antes dos bolsistas; '1. BOLSISTA'; X na coluna certa; rascunho não aparece
it('experiente em negrito e escalarMenos em destaque', ...)
it('troca entra no HISTÓRICO DE TROCAS com a justificativa', ...)
it('marca antiga da fase 2 ainda gera a AGENDA', ...)            // props RELATORIOS_PENDENTES = '["2026-12"]'
```

  Os testes de AGENDA da fase 2 continuam passando.

- [ ] **Step 2: Run them to verify they fail.**

  Run: `npm test -w api -- relatorios`
  Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run them to verify they pass.**

  Run: `npm test && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat: abas ESCALA, CONSULTA e HISTÓRICO DE TROCAS na planilha`

---

### Task 8: Publicação da fase 3

**Files:**
- Modify:
  - `api/src/versao.ts` (`'0.3.0'`)
  - `api/test/sistema.test.ts`
  - `api/test/implantacao.test.ts`
  - `app/.env.exemplo`
  - `docs/implantacao.md`
  - os arquivos locais `app/.env.teste` e `app/.env.producao`

- [ ] **Step 1: Write the failing tests.**
  - O ping devolve `'0.3.0'`.
  - O guia e o `.env.exemplo` trazem `VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais`.

- [ ] **Step 2: Run them to verify they fail.**

  Run: `npm test -w api -- sistema implantacao`
  Expected: FAIL.

- [ ] **Step 3: Update the version, the `.env` files and the guide.**
  - A tabela de `VITE_RECURSOS` ganha a fase 3.
  - Nova seção 14, "Escalas (fase 3)":
    1. colar o `Code.js`;
    2. rodar `instalar` de novo, para criar as 5 abas;
    3. criar a nova versão da implantação;
    4. publicar o site.

- [ ] **Step 4: Run everything.**

  Run: `npm test && npm run typecheck && npm run build -w api`
  Expected: PASS.

- [ ] **Step 5: Commit** — `chore: fase 3 pronta para publicar (versão 0.3.0)`

- [ ] **Step 6: Publicar com o usuário** (como na fase 2):
  1. O usuário cola o `Code.js` e roda `instalar`.
  2. O usuário cria a nova versão e confere `0.3.0` no `/exec`.
  3. Rodar `npm run deploy:app:producao`.
  4. Teste completo, com uma pessoa fictícia de bolsista:
     - abrir uma rodada;
     - marcar a disponibilidade;
     - montar e publicar;
     - conferir a notificação e "Minhas escalas";
     - fazer uma troca;
     - confirmar a presença;
     - ver as abas ESCALA, CONSULTA e HISTÓRICO DE TROCAS na planilha de Relatórios.
