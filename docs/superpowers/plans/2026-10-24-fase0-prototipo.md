# GestorCC — Fase 0: Protótipo navegável — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o front-end completo do GestorCC navegável com dados fictícios (perfis gestor e bolsista, celular e desktop), já estruturado para trocar o cliente simulado pela API real na fase 1.

**Architecture:** Repositório com workspaces npm: `shared/` (regras de negócio e tipos em TypeScript puro, testados com Vitest) e `app/` (React + Vite). O app só fala com os dados por um `ApiCliente` tipado por ações (`chamar(acao, dados)`); nesta fase a implementação é um cliente simulado em memória que usa as regras de `shared/`. Na fase 1, um cliente HTTP para o Apps Script implementa a mesma interface.

**Tech Stack:** TypeScript 5.6, React 18.3, Vite 5.4, React Router 6, TanStack Query 5, Vitest 2 + Testing Library, lucide-react, @fontsource (Montserrat, Source Sans 3), html5-qrcode, qrcode, docx, vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-10-24-gestorcc-design.md`

## Global Constraints

- Todo texto de interface em português do Brasil.
- **Dados fictícios apenas.** Nenhum nome, CPF, matrícula, conta ou e-mail real das referências pode aparecer em fixtures, testes ou commits. A pasta `referencias/` nunca é lida pelo código nem versionada.
- Cores (spec 6.1): fundo `#F4F4F2`, navegação `#232323`, destaque `#F5C518` (gradiente para `#D4AD00` só em grandes áreas), texto `#1A1A1A`, secundário `#5C5C5C`. Títulos em Montserrat negrito; texto em Source Sans 3. Só tema claro.
- Losangos apenas no login, em estados vazios e em documentos impressos.
- A busca não usa a palavra "IA", nem ícones de brilho/robô; respostas a perguntas trazem a marcação "resposta automática · confira os dados".
- Identidade de pessoas sempre por `id`, nunca por nome. Ordenação de nomes com `localeCompare(…, 'pt-BR', { sensitivity: 'base' })`.
- Datas como texto ISO `AAAA-MM-DD`, horários `HH:MM`; exibição `dd/mm/aaaa`. Sem biblioteca de datas.
- Valores monetários em centavos (inteiros) dentro de `shared/`; formatação `R$ 1.234,56` só na exibição.
- Dependências fixadas em versão exata (`npm install --save-exact`).
- Layout funciona a partir de 360 px de largura sem rolagem horizontal da página (tabelas largas rolam dentro do próprio contêiner).
- Valores padrão do spec: diária R$ 80,00; 8 vagas de bolsistas; 1 vaga de servidor; mínimo de 1 experiente por sessão.

## Review Focus

1. **Sessão com horário "a definir"** (`chegada`/`inicio` nulos): não pode quebrar alertas, auto-preencher nem impressões; não gera conflito; aparece como "a definir". → teste em Task 3 e Task 12.
2. **Pessoa sem nenhuma escala / mês vazio**: "Meus ganhos" mostra R$ 0,00 e estados vazios, nunca `NaN` ou tela em branco. → teste em Task 4 e Task 9.
3. **Mês com muitas sessões (25+) na impressão tradicional**: quebra em páginas com no máximo 12 colunas de sessão cada, repetindo a coluna de nomes. → teste em Task 12.
4. **Acesso direto por URL a módulo sem permissão**: mostra "Você não tem acesso a esta área" em vez da tela. → teste em Task 8.
5. **Nomes acentuados e nomes curtos iguais** (ex.: duas "ISABELA"): ordenação correta em pt-BR e nenhuma confusão de pessoa. → teste em Task 3.

---

## Estrutura de arquivos

```
package.json                 workspaces ["shared", "app"], scripts test/build/dev
tsconfig.base.json
shared/
  package.json  tsconfig.json  vitest.config.ts
  src/index.ts               reexporta tudo
  src/tipos.ts               tipos de domínio
  src/permissoes.ts          módulos, níveis, modelos, pode()
  src/datas.ts               utilitários de data/hora e formatação
  src/dinheiro.ts            centavos ↔ texto
  src/escala/alertas.ts      intervalo de sessão, conflito, dias seguidos, mesmo dia
  src/escala/contagem.ts     escalas por pessoa no mês
  src/escala/autoPreencher.ts
  src/escala/sugestoes.ts
  src/escala/whatsapp.ts
  src/pagamentos/lotes.ts    elegíveis, prévia, período de referência
  src/pagamentos/ganhos.ts   Meus ganhos
  src/pagamentos/ficha.ts    ficha de indicação (estrutura) e máscara de CPF
  src/almox.ts               saldo, sugestão de pedido, retirada
  src/validacoes.ts          CPF, matrícula
  src/contratos.ts           alertas de contrato, e-mail FUNDEP
  src/api/acoes.ts           mapa tipado de ações da API
  src/**/*.test.ts
app/
  package.json  tsconfig.json  vite.config.ts  index.html
  public/logo-cc.png  public/icone-192.png  public/icone-512.png
  src/main.tsx  src/App.tsx  src/rotas.tsx
  src/estilo/tokens.css  base.css  impressao.css
  src/componentes/           Botao, Campo, Cartao, Etiqueta, Modal, Tabela, Abas, EstadoVazio, Losango, Carregando
  src/layout/                Shell, MenuLateral, BarraInferior, BarraSuperior, menu.ts
  src/auth/                  SessaoContexto, RotaProtegida, AvisoSenha
  src/api/cliente.ts         interface ApiCliente + contexto React
  src/api/mock/              fixtures.ts, armazenamento.ts, mockCliente.ts
  src/api/hooks.ts           useAcao / useMutacao sobre TanStack Query
  src/telas/                 uma pasta por módulo
  src/teste/                 setup.ts, renderizar.tsx (providers para testes)
```

---

### Task 1: Esqueleto do repositório

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `shared/package.json`, `shared/tsconfig.json`, `shared/vitest.config.ts`, `shared/src/index.ts`, `shared/src/sanidade.test.ts`, `app/package.json`, `app/tsconfig.json`, `app/vite.config.ts`, `app/index.html`, `app/src/main.tsx`, `app/src/App.tsx`, `app/src/teste/setup.ts`, `app/src/App.test.tsx`

**Interfaces:**
- Produces: alias `@shared` (app → `../shared/src`); scripts raiz `npm test`, `npm run build`, `npm run dev`.

- [ ] **Step 1: Criar workspaces e instalar dependências exatas**

Raiz: `{"private": true, "workspaces": ["shared", "app"], "scripts": {"test": "npm run test -w shared && npm run test -w app", "build": "npm run build -w app", "dev": "npm run dev -w app", "typecheck": "tsc -p shared && tsc -p app --noEmit"}}`.
`shared`: devDeps `typescript@5.6.3 vitest@2.1.8`; script `test: vitest run`.
`app`: deps `react@18.3.1 react-dom@18.3.1 react-router-dom@6.28.0 @tanstack/react-query@5.62.7 lucide-react@0.468.0 @fontsource/montserrat@5.1.0 @fontsource/source-sans-3@5.1.0 html5-qrcode@2.3.8 qrcode@1.5.4 docx@9.1.0`; devDeps `vite@5.4.11 @vitejs/plugin-react@4.3.4 typescript@5.6.3 vitest@2.1.8 jsdom@25.0.1 @testing-library/react@16.1.0 @testing-library/user-event@14.5.2 @testing-library/jest-dom@6.6.3 @types/react@18.3.12 @types/react-dom@18.3.1 @types/qrcode@1.5.5 vite-plugin-pwa@0.21.1`; scripts `dev: vite`, `build: tsc --noEmit && vite build`, `test: vitest run`.
TS `strict: true`, `target ES2022`, `moduleResolution bundler`. Vite e tsconfig com alias `@shared` → `../shared/src`. Vitest do app: `environment: 'jsdom'`, `setupFiles: ['src/teste/setup.ts']` (importa `@testing-library/jest-dom/vitest`).

- [ ] **Step 2: Testes de sanidade**

`shared/src/sanidade.test.ts`: `expect(VERSAO).toBe('0.0.0')` com `export const VERSAO = '0.0.0'` em `shared/src/index.ts`.
`app/src/App.test.tsx`: renderiza `<App />` e espera `getByText('GestorCC')`.

- [ ] **Step 3: Rodar**

Run: `npm install && npm test && npm run build`
Expected: 2 testes passando, build gera `app/dist/`.

- [ ] **Step 4: Commit** — `chore: esqueleto do repositório (workspaces shared e app)`

---

### Task 2: Tipos de domínio, permissões, datas, dinheiro e validações

**Files:**
- Create: `shared/src/tipos.ts`, `shared/src/permissoes.ts`, `shared/src/datas.ts`, `shared/src/dinheiro.ts`, `shared/src/validacoes.ts`
- Test: `shared/src/permissoes.test.ts`, `shared/src/datas.test.ts`, `shared/src/dinheiro.test.ts`, `shared/src/validacoes.test.ts`

**Interfaces:**
- Produces (todos reexportados por `shared/src/index.ts`):

```ts
// tipos.ts
export type Id = string;
export type DataISO = string;   // 'AAAA-MM-DD'
export type Hora = string;      // 'HH:MM'
export type Centavos = number;

export interface Pessoa { id: Id; nome: string; nomeCurto: string; emailAcademico: string; emailAlternativo?: string;
  matricula: string; siape?: string; tipo: 'servidor' | 'bolsista'; vinculo: 'fixo' | 'eventual';
  experiente: boolean; escalarMenos: boolean; ativo: boolean; permissoes: Permissoes; }
export interface DadosPessoais { pessoaId: Id; cpf: string; banco: string; agencia: string; conta: string; nascimento?: DataISO; camiseta?: string; }
export type TipoEvento = 'Congresso' | 'Formatura' | 'Show/Concerto' | 'Corporativo' | 'Outro';
export interface Evento { id: Id; nome: string; tipo: TipoEvento; organizador: string; contatoOrganizador: string;
  servidorResponsavelId?: Id; publicoEstimado?: number; publicoReal?: number; pagamento: 'interno' | 'externo';
  pagadorExterno?: string; instrumento: 'contrato' | 'termo' | 'nenhum'; status: 'ativo' | 'cancelado'; observacoes?: string; }
export interface Sessao { id: Id; eventoId: Id; data: DataISO; rotulo?: string; chegada: Hora | null; inicio: Hora | null;
  fim: Hora | null; horarioADefinir: boolean; vagasBolsistas: number; vagasServidores: number; diaria: Centavos | null;
  minimoExperientes: number; status: 'ativa' | 'cancelada'; publicadaEm: string | null;
  convocacao: { abertaAte: string; vagas: number } | null; }
export interface Rodada { id: Id; nome: string; prazo: string; status: 'aberta' | 'fechada'; sessaoIds: Id[]; }
export interface Disponibilidade { pessoaId: Id; sessaoId: Id; disponivel: boolean; origem: 'proprio' | 'gestor' | 'convocacao'; }
export type StatusEscala = 'rascunho' | 'publicado' | 'realizado' | 'faltou' | 'cancelado';
export interface Escala { id: Id; sessaoId: Id; pessoaId: Id; papel: 'bolsista' | 'servidor'; status: StatusEscala; adicaoDireta: boolean; loteId: Id | null; }
export interface Avaliacao { pessoaId: Id; mes: string; nota: 1 | 2 | 3 | 4 | 5; observacao: string; }
export interface Feriado { data: DataISO; nome: string; }
export interface Lote { id: Id; titulo: string; periodoReferencia: string; edital: string; iniciativa: string;
  incluirZerados: boolean; status: 'enviado' | 'pago' | 'cancelado'; criadoEm: string; pagoEm: DataISO | null; }
export interface LoteItem { loteId: Id; escalaId: Id; pessoaId: Id; valor: Centavos; }
export interface Contratante { id: Id; razaoSocial: string; documento: string; inscricaoMunicipal: string; inscricaoEstadual: string;
  endereco: string; cep: string; representanteNome: string; email: string; contatoFaturaNome: string;
  contatoFaturaEmail: string; contatoFaturaTelefone: string; }
export interface Contrato { id: Id; numero: string; eventoId: Id; contratanteId: Id; processoPen: string; valorBase: Centavos;
  itemTabela: string; vencimento: DataISO; areas: string[]; cortesiasQtd: number;
  ingressoSolidario: 'Possui' | 'Não possui' | 'CACC' | 'Mesa Brasil';
  statusContrato: string; statusFatura: string; numeroFatura: string; statusEcad: string; statusIss: string;
  statusFundep: string; statusCortesias: string; fichaTecnicaRecebida: boolean; canceladoMotivo: string; observacoes: string; }
export interface Aditivo { id: Id; contratoId: Id; numero: number; data: DataISO; descricao: string; valorDelta: Centavos; novaData: DataISO | null; statusFatura: string; }
export interface AlmoxItem { cod: string; nomeAlmox: string; nomeComum: string; unidade: string; valor: Centavos;
  categoria: string; qtdMinima: number; sala: string; status: 'Ativo' | 'Inativo'; saldo: number; }
export interface AlmoxMovimento { id: Id; quando: string; tipo: 'entrada' | 'saida' | 'ajuste' | 'recebimento'; cod: string;
  qtd: number; valorUnitario: Centavos; retiradoPorPessoaId?: Id; retiradoPorExterno?: string; eventoId?: Id;
  finalidade?: string; pedidoId?: Id; motivo?: string; }
export interface AlmoxPedido { id: Id; criadoEm: string; solicitanteId: Id; status: 'aberto' | 'parcial' | 'recebido' | 'cancelado';
  itens: { cod: string; qtdPedida: number; qtdRecebida: number; valorEstimado: Centavos }[]; }
export interface Aviso { id: Id; titulo: string; texto: string; publico: 'todos' | 'gestores' | 'bolsistas' | 'pessoas';
  pessoasIds: Id[]; fixado: boolean; validoAte: DataISO | null; pedeConfirmacao: boolean; autorId: Id; criadoEm: string; leituras: Id[]; }
export interface Notificacao { id: Id; pessoaId: Id; texto: string; link: string; criadaEm: string; lida: boolean; }
export interface RegistroHistorico { id: Id; quando: string; quemId: Id; entidade: string; entidadeId: Id; acao: string; justificativa: string; }
export interface Config { diariaPadrao: Centavos; vagasBolsistasPadrao: number; vagasServidoresPadrao: number;
  minimoExperientesPadrao: number; edital: string; iniciativa: string; projetoFundep: string; destinatariosFundep: string[];
  assinaturaEmail: string; limitePerguntasDia: number; linksFormularios: { nome: string; url: string }[]; }

// permissoes.ts
export type Modulo = 'eventos' | 'escalas' | 'pagamentos' | 'contratos' | 'almoxEstoque' | 'almoxSaidas' | 'mural'
  | 'busca' | 'formularios' | 'pessoas' | 'dadosPessoais' | 'configuracoes';
export type Nivel = 'nenhum' | 'ver' | 'editar';
export type Permissoes = Record<Modulo, Nivel>;
export type ModeloPermissao = 'gestor' | 'operacao' | 'eventual';
export const MODULOS: { id: Modulo; nome: string }[];
export const MODELOS: Record<ModeloPermissao, Permissoes>;   // valores da tabela do spec 5.3
export function pode(p: Permissoes, m: Modulo, nivel: 'ver' | 'editar'): boolean;
export function ehGestor(p: Permissoes): boolean;            // algum módulo de gestão além de mural/formulários ≥ 'ver'

// datas.ts
export function formatarData(d: DataISO): string;             // 'dd/mm/aaaa'
export function diaDaSemana(d: DataISO): string;              // 'sexta-feira'
export function diaDaSemanaCurto(d: DataISO): string;         // 'SEX'
export function somarDias(d: DataISO, n: number): DataISO;
export function diferencaDias(a: DataISO, b: DataISO): number; // b − a
export function mesExtenso(mes: number): string;              // 1 → 'JANEIRO'
export function diasDoMes(ano: number, mes: number): DataISO[];
export function horaParaMinutos(h: Hora): number;
export function mesDe(d: DataISO): string;                    // 'AAAA-MM'

// dinheiro.ts
export function formatarReais(c: Centavos): string;           // 8000 → 'R$ 80,00'; 608000 → 'R$ 6.080,00'

// validacoes.ts
export function normalizarCpf(s: string): string | null;      // só dígitos válidos → '000.000.000-00'
export function cpfValido(s: string): boolean;                // dígitos verificadores
export function normalizarMatricula(s: string): string | null; // só dígitos, 9 ou 10 caracteres
```

- [ ] **Step 1: Testes que falham**

- `pode(MODELOS.operacao, 'pagamentos', 'ver')` → `false`; `pode(MODELOS.gestor, 'contratos', 'editar')` → `true`; `pode(MODELOS.eventual, 'mural', 'ver')` → `true`, `'editar'` → `false`; `ehGestor(MODELOS.eventual)` → `false`, `ehGestor(MODELOS.operacao)` → `true`.
- `formatarData('2026-10-09')` → `'09/10/2026'`; `diaDaSemana('2026-11-06')` → `'sexta-feira'`; `diaDaSemanaCurto('2026-11-07')` → `'SÁB'`; `diferencaDias('2026-10-31','2026-11-01')` → `1`; `diasDoMes(2026, 2).length` → `28`; `horaParaMinutos('19:30')` → `1170`.
- `formatarReais(8000)` → `'R$ 80,00'`; `formatarReais(608000)` → `'R$ 6.080,00'`; `formatarReais(0)` → `'R$ 0,00'`.
- `normalizarCpf('12345678909')` → `'123.456.789-09'`; `normalizarCpf('123.456.789- 09')` → `'123.456.789-09'`; `cpfValido('123.456.789-00')` → `false`; `normalizarMatricula('2.02520732E8')` → `null`; `normalizarMatricula(' 202520732 ')` → `'202520732'`; `normalizarMatricula('2023520506')` → `'2023520506'`.

- [ ] **Step 2: Rodar e ver falhar** — `npm test -w shared` → FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar** os arquivos com as assinaturas acima. Datas calculadas em UTC (`Date.UTC`) para não depender do fuso.
- [ ] **Step 4: Rodar e ver passar** — `npm test -w shared` → PASS.
- [ ] **Step 5: Commit** — `feat(shared): tipos de domínio, permissões, datas, dinheiro e validações`

---

### Task 3: Regras da escala — alertas, contagem, auto-preencher, sugestões, WhatsApp

**Files:**
- Create: `shared/src/escala/alertas.ts`, `contagem.ts`, `autoPreencher.ts`, `sugestoes.ts`, `whatsapp.ts`
- Test: os respectivos `*.test.ts`

**Interfaces:**
- Consumes: tipos e `datas` da Task 2.
- Produces:

```ts
// alertas.ts
export type TipoAlerta = 'conflito' | 'diasSeguidos' | 'mesmoDia';
export function intervaloSessao(s: Sessao): { inicio: number; fim: number } | null;
  // minutos absolutos desde 1970 (dia*1440 + hora); começa em chegada ?? inicio; termina em fim ?? (inicio ?? chegada) + 180; null se horarioADefinir ou sem horários
export function alertasDaEscala(alvo: Sessao, outrasDaPessoa: Sessao[]): TipoAlerta[];
  // conflito: intervalos se sobrepõem; mesmoDia: mesma data sem sobreposição (ou sem horário); diasSeguidos: alguma outra a ±1 dia

// contagem.ts
export const STATUS_QUE_CONTAM: StatusEscala[];   // ['rascunho','publicado','realizado']
export function contarNoMes(escalas: Escala[], sessoes: Sessao[], mes: string): Map<Id, number>;

// autoPreencher.ts
export interface ContextoEscala { pessoas: Pessoa[]; sessoes: Sessao[]; escalas: Escala[]; disponibilidades: Disponibilidade[]; }
export function candidatos(sessao: Sessao, ctx: ContextoEscala): Pessoa[];
  // bolsistas ativos, disponíveis na sessão, ainda não escalados nela, sem conflito com as próprias escalas que contam;
  // ordem: escalarMenos=false primeiro, menos escalas no mês, nome (pt-BR)
export function autoPreencherSessao(sessao: Sessao, ctx: ContextoEscala): Id[];   // ids a incluir como bolsista
export function autoPreencherPeriodo(sessaoIds: Id[], ctx: ContextoEscala): { sessaoId: Id; pessoaId: Id }[];

// sugestoes.ts
export interface Sugestao { sessaoId: Id; tirar: Id; colocar: Id; motivo: 'escalarMenos' | 'equilibrio'; diferenca: number; }
export function sugestoesEquilibrio(sessaoIds: Id[], ctx: ContextoEscala): Sugestao[];

// whatsapp.ts
export function textoWhatsappSessao(evento: Evento, sessao: Sessao, servidores: string[], bolsistas: string[]): string;
export function textoWhatsappIndividual(nome: string, itens: { evento: Evento; sessao: Sessao }[]): string;
export function textoConvocacao(evento: Evento, sessao: Sessao, vagas: number, abertaAte: string): string;
export function textoLembreteRodada(rodada: Rodada, faltam: string[]): string;
export function linkWhatsapp(texto: string): string;   // 'https://wa.me/?text=' + encodeURIComponent
```

Algoritmo de `autoPreencherSessao` (o teste não determina sozinho):
1. `faltam = vagasBolsistas − bolsistas já na sessão (status que contam)`; se ≤ 0, retorna `[]`.
2. `lista = candidatos(sessao, ctx)`.
3. `deficit = max(0, minimoExperientes − experientes já na sessão)`. Escolhe primeiro os `min(deficit, faltam)` melhores de `lista` com `experiente`, depois completa com os melhores restantes na ordem de `lista`.

`autoPreencherPeriodo` percorre as sessões em ordem cronológica (data, chegada) aplicando `autoPreencherSessao` e acrescentando as escolhas ao contexto como `rascunho` antes da sessão seguinte (assim a contagem e os conflitos consideram as escolhas anteriores).

`sugestoesEquilibrio`: para cada sessão e cada bolsista X escalado nela, para cada candidato Y da sessão (função `candidatos`):
- se X tem `escalarMenos` e Y não, e `cont[Y] ≤ cont[X] + 3` → motivo `escalarMenos`;
- senão, se nenhum dos dois tem `escalarMenos` e `cont[X] > cont[Y] + 1` → motivo `equilibrio`;
- descartar se tirar X deixar a sessão abaixo de `minimoExperientes` e Y não for experiente.
`diferenca = cont[X] − cont[Y]`. Ordenar `escalarMenos` antes, depois `diferenca` decrescente; no máximo 6 por motivo.

Textos de WhatsApp (copy fixa):
- Sessão: `Olá pessoal, segue a escala do dia {dd/mm/aaaa} ({dia da semana}) - {evento}{ – rótulo}\n\nServidor(es) responsável(is):\n- {nome}\n\nBolsistas escalados:\n- {nome}\n\nVocês deverão comparecer ao Centro de Convenções às {chegada}.` (sem bloco de servidores se vazio; `- (Nenhum bolsista escalado)` se vazio; `horário a definir` se sem chegada).
- Individual: `Olá *{nome}*, segue a sua escala de eventos:\n\n📌 *{evento}*\n🗓️ Data: {dd/mm/aaaa} ({dia})\n⏰ Chegada CC: {chegada}\n\n…Por favor, confirme o recebimento desta mensagem! ✅`.
- Convocação: `Precisamos de mais {n} bolsista(s) para *{evento}* em {dd/mm/aaaa} ({dia}), chegada às {chegada}. Quem puder, marque disponibilidade no GestorCC até {abertaAte formatado}.`
- Lembrete: `Lembrete: a disponibilidade de *{rodada}* fecha em {prazo formatado}. Ainda faltam responder: {nomes separados por vírgula}.`

- [ ] **Step 1: Testes que falham** (sessões fictícias montadas por uma função `sessao(parcial)` no próprio teste)
- `intervaloSessao` com `horarioADefinir: true` → `null`.
- duas sessões em `2026-10-29` (08:00–13:00 e 12:45–18:00) → `alertasDaEscala` contém `'conflito'`.
- `2026-10-29` 08:00–13:00 e 14:00–18:00 → `['mesmoDia']`.
- `2026-10-29` e `2026-10-30` → contém `'diasSeguidos'`.
- sessão "a definir" e outra no mesmo dia → `['mesmoDia']` (nunca `'conflito'`).
- `contarNoMes` ignora `faltou` e `cancelado`.
- `candidatos`: exclui indisponível, já escalado, servidor, inativo e quem tem conflito; ordena `escalarMenos` por último; com "Heloísa" e "Helena" empatados, Helena vem antes; duas pessoas com `nomeCurto: 'ISABELA'` e ids diferentes aparecem ambas.
- `autoPreencherSessao` com 8 vagas e 3 candidatos → 3 ids; com `minimoExperientes: 1` e o experiente em 3º na ordem → ele é incluído mesmo com `faltam = 1`.
- `autoPreencherPeriodo` em duas sessões com conflito entre si e a mesma única candidata → ela aparece só na primeira.
- `sugestoesEquilibrio` sugere tirar quem tem `escalarMenos` e colocar disponível com até +3 escalas; não sugere troca que zere os experientes.
- `textoWhatsappSessao` com sessão sem bolsistas contém `'- (Nenhum bolsista escalado)'`; com `chegada: null` contém `'horário a definir'`.
- [ ] **Step 2: Rodar e ver falhar** — `npm test -w shared`
- [ ] **Step 3: Implementar** conforme assinaturas e algoritmos acima.
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(shared): regras de escala (alertas, auto-preencher, sugestões, WhatsApp)`

---

### Task 4: Regras de pagamento — lotes, ganhos e ficha de indicação

**Files:**
- Create: `shared/src/pagamentos/lotes.ts`, `ganhos.ts`, `ficha.ts`
- Test: os respectivos `*.test.ts`

**Interfaces:**
- Consumes: tipos, `datas`, `dinheiro`.
- Produces:

```ts
// lotes.ts
export interface BasePagamentos { eventos: Evento[]; sessoes: Sessao[]; escalas: Escala[]; lotes: Lote[]; }
export function valorDaSessao(s: Sessao, diariaPadrao: Centavos): Centavos;           // s.diaria ?? diariaPadrao
export function emLoteAtivo(e: Escala, lotes: Lote[]): boolean;                        // loteId de lote não cancelado
export function elegiveisParaLote(b: BasePagamentos): Escala[];
  // status 'realizado', papel 'bolsista', sessão 'ativa', evento 'interno' e 'ativo', fora de lote ativo
export interface PreviaLote { porPessoa: { pessoaId: Id; escalaIds: Id[]; qtd: number; valor: Centavos }[]; total: Centavos; }
export function previaLote(escalaIds: Id[], b: BasePagamentos, diariaPadrao: Centavos): PreviaLote;
export function periodoReferencia(datas: DataISO[]): string;
  // mês/ano da maior data: 'OUTUBRO/2026 – eventos de 16/09/2026 até 15/10/2026'

// ganhos.ts
export interface ResumoLoteGanhos { loteId: Id; titulo: string; data: string; valor: Centavos; eventos: { nome: string; data: DataISO }[]; }
export interface MeusGanhos { previsto: { qtd: number; valor: Centavos }; enviados: ResumoLoteGanhos[]; pagos: ResumoLoteGanhos[];
  externos: { eventoNome: string; data: DataISO; pagador: string }[]; }
export function meusGanhos(pessoaId: Id, b: BasePagamentos & { itens: LoteItem[] }, diariaPadrao: Centavos): MeusGanhos;
  // previsto: escalas 'publicado' ou 'realizado' fora de lote ativo, evento interno, sessão ativa
  // externos: escalas 'publicado'/'realizado' de eventos externos

// ficha.ts
export function mascararCpf(cpf: string): string;    // '123.456.789-09' → '***.***.789-**'
export interface LinhaFicha { ordem: number; nome: string; matricula: string; cpf: string; banco: string; agencia: string; conta: string; valor: Centavos; }
export interface Ficha { titulo: 'FICHA DE INDICAÇÃO DE BOLSISTAS'; periodoReferencia: string; iniciativaEdital: string;
  linhas: LinhaFicha[]; total: Centavos; textoEncaminhamento: string; discriminacao: { nome: string; eventos: string }[]; observacao: string; }
export function montarFicha(params: { lote: Lote; itens: LoteItem[]; pessoas: Pessoa[]; dados: DadosPessoais[];
  base: BasePagamentos; mascarar: boolean }): Ficha;
  // linhas: bolsistas ativos em ordem alfabética (todos se lote.incluirZerados, senão só com valor > 0); dados ausentes → campos ''
  // discriminacao: 'EVENTO (dd/mm/aaaa), EVENTO 2 (dd/mm/aaaa)' em ordem de data; vazio para quem não tem itens
```

Copy da ficha: `textoEncaminhamento = 'Segue em anexo a ficha de indicação referente ao pagamento dos bolsistas que atuaram nos eventos do CC no período de {período} - {edital} - PRE.'`; `observacao = 'O recurso sairá da {iniciativa}.'`; `iniciativaEdital = 'Iniciativa: {iniciativa} - {edital}.'`.

- [ ] **Step 1: Testes que falham**
- `elegiveisParaLote` exclui: `faltou`, `cancelado`, evento externo, sessão cancelada, escala em lote `enviado`; inclui escala cujo lote foi `cancelado`.
- `previaLote` com 3 escalas de uma pessoa (uma com `diaria: 12000`) e padrão 8000 → valor `28000`, total correto.
- `periodoReferencia(['2026-09-16','2026-10-15','2026-08-22'])` → `'OUTUBRO/2026 – eventos de 22/08/2026 até 15/10/2026'`.
- `meusGanhos` de pessoa sem escalas → `previsto: { qtd: 0, valor: 0 }` e listas vazias.
- `meusGanhos` separa externos do previsto e põe lote `pago` em `pagos`.
- `mascararCpf('123.456.789-09')` → `'***.***.789-**'`.
- `montarFicha` com `incluirZerados: true` inclui bolsista com R$ 0 e discriminação vazia; com `mascarar: true` o CPF sai mascarado; total = soma.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(shared): regras de pagamento (lotes, meus ganhos, ficha)`

---

### Task 5: Regras de almoxarifado e contratos

**Files:**
- Create: `shared/src/almox.ts`, `shared/src/contratos.ts`
- Test: `shared/src/almox.test.ts`, `shared/src/contratos.test.ts`

**Interfaces:**
- Produces:

```ts
// almox.ts
export function saldoDosMovimentos(movs: AlmoxMovimento[], cod: string): number;
export function estoqueCritico(i: AlmoxItem): boolean;                 // Ativo e saldo ≤ qtdMinima
export function quantidadeSugerida(i: AlmoxItem): number;              // max(1, 2 × qtdMinima − saldo)
export function validarRetirada(itens: { cod: string; qtd: number }[], estoque: AlmoxItem[]): { cod: string; erro: string }[];
  // erros: 'Quantidade deve ser maior que zero', 'Item inativo', 'Saldo insuficiente (disponível: N)', 'Item não encontrado'
export function formatarCod(cod: string | number): string;             // '41' → '0041'

// contratos.ts
export const OPCOES_STATUS: Record<'contrato' | 'fatura' | 'ecad' | 'iss' | 'fundep' | 'cortesias', string[]>;   // tabela do spec 9.3
export function valorTotalContrato(c: Contrato, aditivos: Aditivo[]): Centavos;
export type AlertaContrato = 'faturaVencendo' | 'faturaVencida' | 'ecadIssPendente' | 'naoAssinado' | 'cortesiasPendentes';
export function alertasContrato(c: Contrato, primeiraData: DataISO, hoje: DataISO): AlertaContrato[];
  // regras do spec 9.4; contrato com statusContrato 'Cancelado' → []
export interface EmailFundep { assunto: string; destinatarios: string[]; corpoTexto: string; corpoHtml: string; }
export function montarEmailFundep(itens: { contrato: Contrato; contratante: Contratante; aditivo?: Aditivo }[], config: Config): EmailFundep;
```

Copy do e-mail FUNDEP (spec 9.5): assunto `[{projetoFundep}] Cadastramento dos contratos/clientes para emissão de fatura`; abertura `Prezadas, bom dia!\n\nSolicitamos o cadastramento dos contratos/clientes abaixo para a emissão das faturas da taxa de locação do Centro de Convenções da UFSM.\n\nSeguem os dados abaixo. Favor emitir as referidas faturas assim que possível, e enviar ao e-mail do interessado com cópia para centrodeconvencoes@ufsm.br.`; bloco por item: `CONTRATO Nº {numero}:` (ou `ADITIVO Nº {n} AO CONTRATO Nº {numero}:`), `CNPJ: {documento} - {razaoSocial}` (rótulo `CPF` se 11 dígitos), `Se CNPJ, Inscrição Municipal: {…}`, `Se CNPJ, Inscrição Estadual: {…}`, `Endereço completo com CEP: {endereco} - CEP: {cep}.`, `Pessoa de contato para envio da Fatura: {contatoFaturaNome}`, `E-mail: {contatoFaturaEmail}, com cópia para centrodeconvencoes@ufsm.br`, `Telefone: {contatoFaturaTelefone}`, `Valor: {R$} com vencimento para dia {dd/mm/aaaa}.`; fechamento `Atenciosamente,\n\n{assinaturaEmail}`. No HTML, número do contrato sublinhado e negrito, valor e vencimento em negrito.

- [ ] **Step 1: Testes que falham**
- `saldoDosMovimentos` com ajuste +10, saída −3, recebimento +5 → `12`.
- `quantidadeSugerida({ qtdMinima: 4, saldo: 1 })` → `7`; `({ qtdMinima: 0, saldo: 0 })` → `1`.
- `validarRetirada([{cod:'0041',qtd:5}], [{…saldo:3}])` → `[{ cod: '0041', erro: 'Saldo insuficiente (disponível: 3)' }]`.
- `alertasContrato` com evento em 4 dias e ECAD `'Não enviado'` → contém `'ecadIssPendente'`; com ECAD e ISS `'Isento'` → não contém; contrato cancelado → `[]`.
- `valorTotalContrato` com base 680000 e aditivo +340000 → `1020000`.
- `montarEmailFundep` com 2 contratos fictícios → assunto `'[30055] Cadastramento dos contratos/clientes para emissão de fatura'`, texto contém `'CONTRATO Nº 30/2026:'` e `'Valor: R$ 5.000,00 com vencimento para dia 05/10/2026.'`.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(shared): regras de almoxarifado e contratos`

---

### Task 6: Contrato da API e cliente simulado

**Files:**
- Create: `shared/src/api/acoes.ts`, `app/src/api/cliente.ts`, `app/src/api/hooks.ts`, `app/src/api/mock/fixtures.ts`, `app/src/api/mock/armazenamento.ts`, `app/src/api/mock/mockCliente.ts`
- Test: `app/src/api/mock/mockCliente.test.ts`

**Interfaces:**
- Consumes: tudo de `shared/`.
- Produces:

```ts
// shared/src/api/acoes.ts — mapa ação → { entrada; saida }
export interface Acoes {
  'auth.entrar': { entrada: { email: string; senha: string }; saida: { token: string; pessoa: Pessoa; senhaInicial: boolean } };
  'auth.trocarSenha': { entrada: { atual: string; nova: string }; saida: null };
  'pessoas.listar': { entrada: null; saida: Pessoa[] };
  'pessoas.salvar': { entrada: Pessoa; saida: Pessoa };
  'dadosPessoais.obter': { entrada: { pessoaId: Id }; saida: DadosPessoais | null };
  'dadosPessoais.salvar': { entrada: DadosPessoais; saida: DadosPessoais };
  'eventos.listar': { entrada: { de: DataISO; ate: DataISO }; saida: { eventos: Evento[]; sessoes: Sessao[] } };
  'eventos.salvar': { entrada: { evento: Evento; sessoes: Sessao[] }; saida: { evento: Evento; sessoes: Sessao[] } };
  'eventos.cancelar': { entrada: { eventoId: Id; justificativa: string }; saida: null };
  'sessoes.cancelar': { entrada: { sessaoId: Id; justificativa: string }; saida: null };
  'feriados.listar': { entrada: { ano: number }; saida: Feriado[] };
  'rodadas.listar': { entrada: null; saida: Rodada[] };
  'rodadas.salvar': { entrada: Rodada; saida: Rodada };
  'disponibilidades.listar': { entrada: { sessaoIds: Id[] }; saida: Disponibilidade[] };
  'disponibilidades.marcar': { entrada: { sessaoId: Id; disponivel: boolean; pessoaId?: Id }; saida: Disponibilidade };
  'escalas.listar': { entrada: { de: DataISO; ate: DataISO }; saida: Escala[] };
  'escalas.salvarRascunho': { entrada: { sessaoId: Id; itens: { pessoaId: Id; papel: 'bolsista' | 'servidor'; adicaoDireta: boolean }[] }; saida: Escala[] };
  'escalas.publicar': { entrada: { sessaoIds: Id[]; enviarEmail: boolean }; saida: null };
  'escalas.trocar': { entrada: { sessaoId: Id; sai: Id | null; entra: Id | null; justificativa: string }; saida: Escala[] };
  'escalas.convocar': { entrada: { sessaoId: Id; vagas: number; abertaAte: string }; saida: Sessao };
  'escalas.confirmarPresenca': { entrada: { sessaoId: Id; faltaram: Id[] }; saida: Escala[] };
  'avaliacoes.listar': { entrada: { mes: string }; saida: Avaliacao[] };
  'avaliacoes.salvar': { entrada: Avaliacao; saida: Avaliacao };
  'lotes.listar': { entrada: null; saida: { lotes: Lote[]; itens: LoteItem[] } };
  'lotes.criar': { entrada: { escalaIds: Id[]; titulo: string; periodoReferencia: string; edital: string; iniciativa: string; incluirZerados: boolean }; saida: Lote };
  'lotes.marcarPago': { entrada: { loteId: Id; data: DataISO }; saida: Lote };
  'lotes.cancelar': { entrada: { loteId: Id; justificativa: string }; saida: Lote };
  'externos.registrarEnvio': { entrada: { eventoId: Id; campos: string[] }; saida: null };
  'contratos.listar': { entrada: null; saida: { contratos: Contrato[]; aditivos: Aditivo[]; contratantes: Contratante[] } };
  'contratos.salvar': { entrada: Contrato; saida: Contrato };
  'almox.listar': { entrada: null; saida: { itens: AlmoxItem[]; autorizadosExternos: string[] } };
  'almox.movimentos': { entrada: { cod?: string }; saida: AlmoxMovimento[] };
  'almox.retirar': { entrada: { itens: { cod: string; qtd: number }[]; retiradoPorPessoaId?: Id; retiradoPorExterno?: string; finalidade: string; eventoId?: Id }; saida: AlmoxMovimento[] };
  'almox.pedidos': { entrada: null; saida: AlmoxPedido[] };
  'almox.criarPedido': { entrada: { itens: { cod: string; qtdPedida: number; valorEstimado: Centavos }[] }; saida: AlmoxPedido };
  'almox.receber': { entrada: { pedidoId: Id; itens: { cod: string; qtd: number }[] }; saida: AlmoxPedido };
  'avisos.listar': { entrada: null; saida: Aviso[] };
  'avisos.salvar': { entrada: Aviso; saida: Aviso };
  'avisos.confirmarLeitura': { entrada: { avisoId: Id }; saida: null };
  'notificacoes.listar': { entrada: null; saida: Notificacao[] };
  'notificacoes.marcarLidas': { entrada: null; saida: null };
  'historico.listar': { entrada: { entidade?: string; entidadeId?: Id }; saida: RegistroHistorico[] };
  'config.obter': { entrada: null; saida: Config };
  'config.salvar': { entrada: Config; saida: Config };
}
export type Acao = keyof Acoes;
export class ErroApi extends Error { constructor(public codigo: string, mensagem: string); }

// app/src/api/cliente.ts
export interface ApiCliente { chamar<A extends Acao>(acao: A, dados: Acoes[A]['entrada']): Promise<Acoes[A]['saida']>; definirToken(t: string | null): void; }
export const ApiContexto: React.Context<ApiCliente>; export function useApi(): ApiCliente;

// app/src/api/hooks.ts
export function useConsulta<A extends Acao>(acao: A, dados: Acoes[A]['entrada']): UseQueryResult<Acoes[A]['saida']>;   // queryKey [acao, dados]
export function useMutacao<A extends Acao>(acao: A, invalidar: Acao[]): UseMutationResult<Acoes[A]['saida'], ErroApi, Acoes[A]['entrada']>;

// app/src/api/mock/mockCliente.ts
export function criarMockCliente(opcoes?: { latenciaMs?: number; hoje?: DataISO }): ApiCliente;   // latência padrão 250, hoje padrão '2026-10-24'
```

Cliente simulado:
- `armazenamento.ts` guarda as coleções em memória, inicializadas por `fixtures.ts`, e persiste em `localStorage` (chave `gestorcc-prototipo`, com `try/catch`) para o protótipo sobreviver ao recarregar; botão "Restaurar dados de exemplo" em Configurações chama `restaurar()`.
- Cada ação valida a sessão (token → pessoa) e a permissão com `pode()`; sem permissão lança `ErroApi('SEM_PERMISSAO', 'Você não tem permissão para esta ação.')`. Exceções: ações do próprio usuário (`disponibilidades.marcar` sem `pessoaId`, `dadosPessoais` do próprio id, `auth.*`, `avisos.listar`, `notificacoes.*`).
- Gravações registram em `historico`; `escalas.trocar` exige `justificativa` não vazia (`ErroApi('JUSTIFICATIVA', 'Informe a justificativa da troca.')`); `almox.retirar` usa `validarRetirada`; `escalas.publicar` cria notificações para os escalados; `sessoes.cancelar`/`eventos.cancelar` põem escalas em `cancelado` e notificam.
- Senhas do protótipo: todas as pessoas entram com a própria matrícula fictícia; `senhaInicial: true` até `auth.trocarSenha`.

Fixtures (todos fictícios): 4 servidores, 4 bolsistas fixos (2 com modelo gestor, 2 operação), 22 bolsistas eventuais com nomes inventados (incluir dois com `nomeCurto` "ISABELA" e nomes acentuados como "Heloá", "Kauã"); contas de entrada documentadas: `gestor@ufsm.br` / `1000000001` (Gestor) e `bolsista@acad.ufsm.br` / `2026000001` (Eventual). Eventos de outubro a dezembro/2026 com: um evento de 6 sessões em 2 dias (manhã/tarde/noite), um com 2 sessões no mesmo dia, um externo, um cancelado, uma sessão "a definir"; rodada "Dezembro/2026" aberta; escalas publicadas/realizadas em outubro; um lote pago e um enviado; 6 contratos com situações variadas; 40 itens de almoxarifado (alguns críticos) com movimentos; 3 avisos (um fixado, um com confirmação); feriados nacionais de 2026; `Config` com os padrões do spec, `projetoFundep: '30055'`.

- [ ] **Step 1: Testes que falham** (`mockCliente.test.ts`, `latenciaMs: 0`)
- `auth.entrar` com senha errada rejeita com código `'CREDENCIAIS'`; com `bolsista@acad.ufsm.br`/`2026000001` retorna `senhaInicial: true`.
- bolsista chamando `lotes.listar` rejeita com `'SEM_PERMISSAO'`.
- `escalas.trocar` sem justificativa rejeita com `'JUSTIFICATIVA'`; com justificativa cria registro em `historico.listar`.
- `almox.retirar` acima do saldo rejeita e não altera o saldo.
- `sessoes.cancelar` deixa as escalas da sessão como `cancelado` e elas não aparecem em `elegiveisParaLote`.
- [ ] **Step 2: Rodar e ver falhar** — `npm test -w app`
- [ ] **Step 3: Implementar** `acoes.ts`, `cliente.ts`, `hooks.ts`, `armazenamento.ts`, `fixtures.ts`, `mockCliente.ts`.
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat: contrato da API e cliente simulado com dados fictícios`

---

### Task 7: Identidade visual, componentes base e layout

**Files:**
- Create: `app/src/estilo/tokens.css`, `base.css`, `impressao.css`; `app/src/componentes/{Botao,Campo,Cartao,Etiqueta,Modal,Tabela,Abas,EstadoVazio,Losango,Carregando}.tsx` (+ `.module.css`); `app/src/layout/{Shell,MenuLateral,BarraInferior,BarraSuperior}.tsx`, `app/src/layout/menu.ts`; `app/public/logo-cc.png`
- Test: `app/src/layout/menu.test.ts`, `app/src/componentes/Etiqueta.test.tsx`

**Interfaces:**
- Produces:

```ts
// menu.ts
export interface ItemMenu { rota: string; rotulo: string; icone: LucideIcon; modulo?: Modulo; }   // sem módulo = sempre visível
export const ITENS_GESTAO: ItemMenu[];   // Início, Agenda(eventos), Escalas, Pagamentos, Contratos, Almoxarifado(almoxEstoque), Mural, Pessoas, Configurações, Formulários
export const ITENS_PESSOAIS: ItemMenu[]; // Minhas escalas, Disponibilidade, Ganhos (só bolsista), Avisos, Perfil
export function itensVisiveis(p: Pessoa): { gestao: ItemMenu[]; pessoais: ItemMenu[] };
// componentes
<Botao variante="primario" | "secundario" | "perigo" | "fantasma" carregando? />
<Etiqueta tom="neutro" | "sucesso" | "aviso" | "erro" | "destaque">texto</Etiqueta>
<Tabela colunas={{ chave: string; titulo: string; render?: (linha) => ReactNode }[]} linhas={T[]} chaveLinha={(l) => string} />  // contêiner com overflow-x: auto
<Modal aberto titulo aoFechar>…</Modal>; <Abas abas={{ id; rotulo }[]} ativa aoMudar />; <EstadoVazio titulo texto acao? /> (com Losango)
```

Tokens em `tokens.css` (`:root`): `--cor-fundo #F4F4F2`, `--cor-nav #232323`, `--cor-destaque #F5C518`, `--cor-destaque-escuro #D4AD00`, `--cor-texto #1A1A1A`, `--cor-texto-2 #5C5C5C`, `--cor-superficie #FFFFFF`, `--cor-borda #E2E2DE`, `--cor-sucesso #2E7D4F`, `--cor-aviso #B7791F`, `--cor-erro #B3261E`, `--fonte-titulo 'Montserrat'`, `--fonte-texto 'Source Sans 3'`, raios 6/10 px, espaçamentos 4/8/12/16/24/32. `body` com `background: var(--cor-fundo)`.
Shell: ≥ 900 px menu lateral fixo de 240 px; < 900 px barra inferior com Escalas · Disponibilidade · Ganhos · Menu (Menu abre gaveta com os demais itens). Barra superior: campo de busca (placeholder `Buscar ou perguntar… ex.: quem está escalado sábado?`, só com módulo `busca`), sininho com contador, menu do usuário (Perfil, Sair). Logo do CC copiado de `referencias/Logo CC.png` para `app/public/logo-cc.png` (o logo é público; nenhum outro arquivo da pasta é copiado).

- [ ] **Step 1: Testes que falham**
- `itensVisiveis` de pessoa com `MODELOS.eventual` não tem nenhum item de gestão; com `MODELOS.operacao` não tem Pagamentos, Contratos, Pessoas nem Configurações; servidor não tem "Ganhos".
- `<Etiqueta tom="erro">Vencida</Etiqueta>` renderiza o texto com a classe do tom.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar** tokens, componentes, layout.
- [ ] **Step 4: Rodar e ver passar** — e conferir visualmente com `npm run dev` em 360 px e 1280 px.
- [ ] **Step 5: Commit** — `feat(app): identidade visual, componentes base e layout`

---

### Task 8: Login, sessão, rotas e proteção por permissão

**Files:**
- Create: `app/src/auth/SessaoContexto.tsx`, `RotaProtegida.tsx`, `AvisoSenha.tsx`; `app/src/telas/login/Login.tsx` (+ css); `app/src/rotas.tsx`; `app/src/teste/renderizar.tsx`
- Modify: `app/src/App.tsx`, `app/src/main.tsx`
- Test: `app/src/telas/login/Login.test.tsx`, `app/src/auth/RotaProtegida.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface SessaoUsuario { pessoa: Pessoa; senhaInicial: boolean; }
export function useSessao(): { sessao: SessaoUsuario | null; entrar(email: string, senha: string): Promise<void>; sair(): void; marcarSenhaTrocada(): void; };
<RotaProtegida modulo?: Modulo nivel?: 'ver' | 'editar'>  // sem sessão → /entrar?voltar=<rota>; sem permissão → tela "Você não tem acesso a esta área"
export function renderizar(ui: ReactElement, opcoes?: { pessoa?: 'gestor' | 'bolsista'; rota?: string }): RenderResult;  // providers + mock (latência 0) + sessão já iniciada
```

Rotas: `/entrar`, `/` (Início), `/agenda`, `/agenda/:eventoId`, `/escalas`, `/escalas/montar`, `/escalas/presenca`, `/escalas/imprimir`, `/pagamentos`, `/pagamentos/novo`, `/pagamentos/:loteId`, `/contratos`, `/contratos/:id`, `/contratos/fundep`, `/almox`, `/almox/saida`, `/almox/pedidos`, `/mural`, `/pessoas`, `/pessoas/:id`, `/configuracoes`, `/formularios`, `/minhas-escalas`, `/disponibilidade`, `/ganhos`, `/avisos`, `/perfil`, `/agenda/imprimir`. Telas ainda não implementadas renderizam um `EstadoVazio` "Em construção" até as tasks seguintes.
Login (spec 6.1): desktop com faixa amarela vertical (logo, "Centro de Convenções · PRE | UFSM") e área à direita em preto com losangos geométricos em tons de cinza (sem foto real nesta fase); celular só faixa e formulário. Campos "E-mail acadêmico" e "Senha"; texto de ajuda "No primeiro acesso, a senha é a sua matrícula."; link "Esqueci minha senha" abre modal informando que o link chega por e-mail (simulado). Erro `CREDENCIAIS` → "E-mail ou senha incorretos.". Sessão guardada em `sessionStorage` com `try/catch`.
`AvisoSenha`: faixa no topo "Você ainda usa a senha inicial. Recomendamos trocá-la." com "Trocar agora" (→ /perfil) e "Agora não" (some até o próximo login). Para quem tem `pode(p, 'dadosPessoais', 'editar')`, em vez da faixa abre modal obrigatório de troca de senha (spec 5.1).

- [ ] **Step 1: Testes que falham**
- Login com `bolsista@acad.ufsm.br`/`2026000001` navega para `/` e mostra o aviso de senha inicial; senha errada mostra "E-mail ou senha incorretos.".
- Bolsista acessando `/pagamentos` vê "Você não tem acesso a esta área".
- Sem sessão, `/escalas` redireciona para `/entrar?voltar=%2Fescalas`.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(app): login, sessão e rotas protegidas por permissão`

---

### Task 9: Área do bolsista — Início, Minhas escalas, Disponibilidade, Ganhos, Avisos, Perfil

**Files:**
- Create: `app/src/telas/inicio/InicioBolsista.tsx`, `app/src/telas/pessoal/{MinhasEscalas,MinhaDisponibilidade,MeusGanhos,Avisos,Perfil}.tsx` (+ css)
- Test: `app/src/telas/pessoal/MinhaDisponibilidade.test.tsx`, `MeusGanhos.test.tsx`

**Interfaces:**
- Consumes: `useConsulta`, `useMutacao` (Task 6), `meusGanhos` (Task 4), `formatarData`, `diaDaSemana`.

Requisitos (spec 6.3, 7.2, 8.5):
- **Início:** cartão "Próxima escala" (evento, data, dia, "Chegar às HH:MM" ou "Horário a definir"); destaque amarelo se há rodada aberta ("Disponibilidade de Dezembro/2026 aberta até dd/mm às HH:MM → Responder") ou convocação extra; avisos fixados.
- **Minhas escalas:** abas Próximas / Anteriores; cada item com colegas da sessão e link "Adicionar ao Google Agenda" (`https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…&details=…`). Estado vazio "Você ainda não tem escalas publicadas.".
- **Disponibilidade:** sessões da rodada aberta agrupadas por dia; cada sessão com evento, rótulo, horários e alternância Sim/Não; selo "nova" quando a sessão entrou depois da abertura; salvamento automático com indicação "Salvo"; prazo no topo; após o prazo, somente leitura com "Prazo encerrado em …"; convocações extras abertas aparecem no topo.
- **Ganhos:** quatro blocos do spec 8.5; previsto com "≈"; externos com o nome do pagador e a frase "Pago diretamente pela organização do evento".
- **Avisos:** lista; botão "Confirmar leitura" quando o aviso pede.
- **Perfil:** trocar senha (atual, nova, confirmação, mínimo 8 caracteres); ver e editar os próprios dados pessoais (CPF validado com `cpfValido`, banco, agência, conta) com aviso "Ao alterar dados bancários, os gestores serão avisados.".

- [ ] **Step 1: Testes que falham**
- Disponibilidade: clicar "Sim" numa sessão chama `disponibilidades.marcar` e mostra "Salvo"; rodada com prazo vencido (mock com `hoje` posterior) mostra "Prazo encerrado" e botões desabilitados.
- Ganhos de pessoa sem escalas mostra `R$ 0,00` e nenhum `NaN` no documento.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(app): área do bolsista`

---

### Task 10: Início do gestor e Agenda (eventos, sessões, impressão mensal, estatísticas)

**Files:**
- Create: `app/src/telas/inicio/InicioGestor.tsx`, `app/src/telas/inicio/pendencias.ts`, `app/src/telas/agenda/{Agenda,EventoForm,EventoDetalhe,ImprimirAgenda,Estatisticas}.tsx` (+ css)
- Test: `app/src/telas/inicio/pendencias.test.ts`, `app/src/telas/agenda/ImprimirAgenda.test.tsx`

**Interfaces:**
- Produces:

```ts
// pendencias.ts
export type Pendencia = { tipo: 'presenca' | 'rodada' | 'vagas' | 'estoque' | 'contrato'; texto: string; link: string };
export function calcularPendencias(dados: { sessoes: Sessao[]; escalas: Escala[]; eventos: Evento[]; rodadas: Rodada[];
  disponibilidades: Disponibilidade[]; pessoas: Pessoa[]; itens: AlmoxItem[]; contratos: Contrato[]; hoje: DataISO; permissoes: Permissoes }): Pendencia[];
  // presença: sessão publicada com data < hoje e escalas ainda 'publicado'; rodada: 'Dezembro/2026: 18 de 30 responderam';
  // vagas: sessão publicada futura com bolsistas < vagas; estoque: nº de itens críticos; contrato: alertasContrato. Filtra por permissão.
```

Requisitos (spec 6.3, 7.1, 7.8, 7.10):
- **Início do gestor:** "Hoje", "Esta semana", Pendências (lista clicável), "Contratado em 2026 / já pago" (se tem contratos), avisos fixados.
- **Agenda:** alternância Mês (grade de calendário, feriados marcados) / Lista; filtro por tipo; botão "Novo evento".
- **EventoForm:** campos do `Evento` e lista editável de sessões (data, rótulo, chegada, início, fim, "horário a definir", vagas, diária especial); padrões vindos de `config.obter`.
- **EventoDetalhe:** dados, sessões com status de escala (x/8), botões "Cancelar sessão"/"Cancelar evento" (modal com justificativa obrigatória e aviso "Os escalados serão avisados e não receberão por esta sessão.").
- **ImprimirAgenda** (`/agenda/imprimir?mes=AAAA-MM`): título `NOVEMBRO/2026`; uma linha por dia (`Domingo, 01`); colunas DIA, EVENTO, RESPONSÁVEL, RESP NUGAC, HORÁRIO; feriado → célula "FERIADO" mesclada; botão "Imprimir" (`window.print()`), CSS `@page { size: A4 portrait }`.
- **Estatísticas:** total de eventos, público total, média (por período e tipo), tabela por tipo.

- [ ] **Step 1: Testes que falham**
- `calcularPendencias` com uma sessão de ontem ainda `publicado` gera `{ tipo: 'presenca' }`; para permissões `eventual` retorna `[]`.
- `ImprimirAgenda` para `2026-11` renderiza 30 linhas, a linha de `02/11` contém "FERIADO" e a de um dia com evento mostra o horário "a definir" quando aplicável.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(app): início do gestor e agenda`

---

### Task 11: Escalas — rodadas, montador, publicação, trocas, convocação, presença, avaliações

**Files:**
- Create: `app/src/telas/escalas/{Escalas,Rodadas,Montador,MontadorGrade,MontadorFoco,ModalTroca,ModalConvocacao,Presenca,Publicar,Avaliacoes}.tsx` (+ css), `app/src/telas/escalas/estadoMontador.ts`
- Test: `app/src/telas/escalas/estadoMontador.test.ts`, `app/src/telas/escalas/Montador.test.tsx`

**Interfaces:**
- Consumes: Task 3 (alertas, candidatos, autoPreencher, sugestões, WhatsApp), Task 6.
- Produces:

```ts
// estadoMontador.ts — redutor puro do rascunho em edição
export interface EstadoMontador { escalas: Escala[]; alterado: boolean; }
export type AcaoMontador =
  | { tipo: 'incluir'; sessaoId: Id; pessoaId: Id; papel: 'bolsista' | 'servidor'; adicaoDireta: boolean }
  | { tipo: 'remover'; sessaoId: Id; pessoaId: Id }
  | { tipo: 'autoPreencher'; sessaoIds: Id[]; ctx: ContextoEscala }
  | { tipo: 'aplicarSugestao'; sugestao: Sugestao }
  | { tipo: 'limpar'; sessaoId: Id };
export function reduzirMontador(e: EstadoMontador, a: AcaoMontador): EstadoMontador;
export function bloqueioInclusao(sessao: Sessao, pessoa: Pessoa, ctx: ContextoEscala): 'conflito' | 'papel' | null;
```

Requisitos (spec 7.2–7.9):
- **Escalas (página):** abas Rodadas · Montar · Publicadas · Presença · Avaliações; seletor de mês.
- **Rodadas:** criar (nome, prazo, sessões do período marcadas por padrão), ver quem respondeu/faltam com botão "Copiar lembrete" (`textoLembreteRodada`) e "Abrir no WhatsApp"; reabrir; marcar por alguém.
- **Montador:** visão Grade (linhas = pessoas ordenadas por tipo/nome; colunas = sessões; célula: ✓ escalado, disponível, indisponível; clique alterna) e visão Foco (uma sessão: barra de progresso `x / vagas`, listas Servidores e Bolsistas, candidatos ordenados com contagem `Nx`, etiquetas de alerta 🔴 Conflito / 🟡 Dias seguidos / ⚪ Mesmo dia, negrito para experiente, etiqueta "escalar menos"); botões "Auto-preencher sessão", "Auto-preencher mês", "Sugestões" (modal com `sugestoesEquilibrio`, botão "Aplicar"), "Limpar"; incluir indisponível pede confirmação "Esta pessoa marcou indisponível. Escalar mesmo assim?"; conflito bloqueia com mensagem; painel lateral com totais por pessoa (cores: 0 cinza, 1–2 verde, 3–4 amarelo, 5+ vermelho); "Salvar rascunho" (`escalas.salvarRascunho` por sessão alterada).
- **Publicar:** escolher sessões (rascunhos do mês), caixa "Enviar também por e-mail", confirmação; depois mostra textos de WhatsApp por sessão e por pessoa com "Copiar" e "Abrir no WhatsApp", e botão "Imprimir escala (formato tradicional)".
- **Publicadas:** por sessão, botões "Trocar" (`ModalTroca`: sai, entra — só candidatos do mesmo papel —, justificativa obrigatória), "Pedir mais bolsistas" (`ModalConvocacao`: vagas extras, prazo; mostra `textoConvocacao`), "Cancelar sessão".
- **Presença:** sessões passadas pendentes, todos marcados presentes; desmarcar quem faltou; "Confirmar presença".
- **Avaliações:** por mês, nota 1–5 (estrelas) e observação por bolsista.

- [ ] **Step 1: Testes que falham**
- `reduzirMontador` `incluir` + `remover` volta ao estado original de escalas e marca `alterado`.
- `bloqueioInclusao` de servidor em vaga de bolsista → `'papel'`; de pessoa com sessão sobreposta → `'conflito'`.
- `Montador` (Foco): clicar "Auto-preencher sessão" numa sessão com 8 vagas e 5 disponíveis mostra `5 / 8`.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(app): escalas (rodadas, montador, publicação, trocas, convocação, presença)`

---

### Task 12: Impressão da escala no formato tradicional

**Files:**
- Create: `app/src/telas/escalas/ImprimirEscala.tsx` (+ css), `app/src/telas/escalas/paginarColunas.ts`
- Test: `app/src/telas/escalas/paginarColunas.test.ts`, `app/src/telas/escalas/ImprimirEscala.test.tsx`

**Interfaces:**
- Produces: `export function paginarColunas<T>(colunas: T[], porPagina: number): T[][]` (porPagina = 12).

Requisitos (spec 7.8): rota `/escalas/imprimir?mes=AAAA-MM`; título "TABELA DE ESCALA DOS BOLSISTAS"; "Período de Referência: NOVEMBRO/2026"; por página: primeira coluna "Nome", depois uma coluna por sessão publicada com data `dd/mm`, dia da semana, nome do evento (e rótulo) e horário de início; linha "Estar no CC" com a chegada (ou "a definir"); linhas por pessoa (servidores primeiro, depois bolsistas, ordem alfabética pt-BR) com "X" nas sessões em que está escalada; só pessoas com ao menos uma escala no mês; `@page { size: A4 landscape }`; losangos discretos nos cantos; botão "Imprimir" oculto na impressão.

- [ ] **Step 1: Testes que falham**
- `paginarColunas` de 25 itens com 12 → páginas de 12, 12, 1.
- `ImprimirEscala` com 25 sessões publicadas renderiza 3 tabelas, cada uma com a coluna "Nome"; sessão "a definir" mostra "a definir" na linha "Estar no CC"; pessoa escalada mostra "X" na coluna certa.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(app): impressão da escala no formato tradicional`

---

### Task 13: Pagamentos — lotes, ficha de indicação, pagamento externo

**Files:**
- Create: `app/src/telas/pagamentos/{Pagamentos,NovoLote,LoteDetalhe,FichaIndicacao,DadosExterno}.tsx` (+ css), `app/src/telas/pagamentos/fichaDocx.ts`
- Test: `app/src/telas/pagamentos/NovoLote.test.tsx`

**Interfaces:**
- Consumes: Task 4 (`elegiveisParaLote`, `previaLote`, `periodoReferencia`, `montarFicha`, `mascararCpf`), Task 6.
- Produces: `export async function gerarFichaDocx(f: Ficha): Promise<Blob>` (biblioteca `docx`).

Requisitos (spec 8.2–8.4):
- **Pagamentos:** lista de lotes com etiqueta (Enviado = aviso, Pago = sucesso, Cancelado = neutro), total e período; aba "Pagamento externo" com eventos externos realizados.
- **NovoLote:** elegíveis agrupados por evento com caixas de marcar (por evento e por sessão), filtro de datas; prévia por pessoa e total; campos editáveis período (pré-preenchido com `periodoReferencia`), edital, iniciativa, "Incluir bolsistas sem valor" (marcado); "Criar lote".
- **LoteDetalhe:** itens, "Ver ficha", "Marcar como pago" (data), "Cancelar lote" (justificativa), "Retirar sessão" enquanto `enviado`.
- **FichaIndicacao:** renderiza `Ficha` em HTML no formato do e-mail atual; CPF/banco mascarados sem permissão `dadosPessoais`; botões "Copiar para o e-mail" (`navigator.clipboard.write` com `text/html` e `text/plain`) e "Baixar .docx"; "Imprimir / PDF".
- **DadosExterno:** escolher campos (Nome, Matrícula, Função, Data e horário; CPF e Banco só com permissão), tabela e "Copiar" / "Imprimir"; "Marcar como enviado" → `externos.registrarEnvio`.

- [ ] **Step 1: Teste que falha** — NovoLote: marcar duas sessões de um evento atualiza o total da prévia para o valor esperado das fixtures e "Criar lote" navega para o detalhe com etiqueta "Enviado".
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(app): pagamentos (lotes, ficha de indicação, externo)`

---

### Task 14: Contratos — lista, detalhe e e-mail FUNDEP

**Files:**
- Create: `app/src/telas/contratos/{Contratos,ContratoDetalhe,SolicitarFundep}.tsx` (+ css)
- Test: `app/src/telas/contratos/Contratos.test.tsx`

Requisitos (spec 9, versão inicial): lista com colunas Evento, Nº, Data, Valor total, etiquetas Contrato/Fatura/ECAD/ISS/FUNDEP/Cortesias (cores: pago/assinado/ok/distribuídas = sucesso; isento = neutro; não enviado/não pago = aviso; vencida/cancelado = erro), filtro "Só com pendências" (`alertasContrato`); detalhe com edição dos campos e selects com `OPCOES_STATUS`, lista de aditivos, áreas cedidas (caixas), botões "Gerar contrato" / "Gerar termo" / "Formulário do piano" que nesta fase mostram modal "Disponível na fase 6: o documento será gerado a partir do modelo no Google Docs."; **SolicitarFundep:** seleção de contratos assinados com fatura "Não enviada p/ emissão", prévia do e-mail (`montarEmailFundep`) com "Copiar formatado" e "Marcar como enviado" (fatura → "Enviada p/ emissão"). Banner no topo do módulo: "Versão inicial — campos e modelos serão revistos com a coordenação."

- [ ] **Step 1: Teste que falha** — filtro "Só com pendências" esconde contrato sem alertas e mantém contrato com ECAD pendente a 3 dias do evento.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(app): contratos e solicitação de faturas à FUNDEP`

---

### Task 15: Almoxarifado — estoque, saída com câmera, pedidos, painel, etiquetas

**Files:**
- Create: `app/src/telas/almox/{Almox,Estoque,Saida,LeitorCodigo,Pedidos,Receber,PainelAlmox,Etiquetas}.tsx` (+ css)
- Test: `app/src/telas/almox/Saida.test.tsx`

Requisitos (spec 10.1): **Estoque** com busca (código ou nome), filtros categoria/sala/status, etiqueta "Crítico", edição de catálogo (modal) e "Ajuste de estoque" com motivo obrigatório; **Saída** com seleção de quem retira (pessoas do sistema + autorizados externos), finalidade, evento opcional, carrinho (busca por código/nome ou `LeitorCodigo` com `html5-qrcode`, câmera traseira), erros de `validarRetirada` exibidos na linha e botão "Registrar retirada" desabilitado enquanto houver erro; **Pedidos** com sugestão (`estoqueCritico` + `quantidadeSugerida`, editável), "Imprimir lista de compras", "Registrar pedido", **Receber** parcial por item; **Painel** com valor em estoque por categoria (barras horizontais em CSS), consumo por mês, mais retirados; **Etiquetas** gera QR (`qrcode`) do código dos itens selecionados em grade A4 para impressão.

- [ ] **Step 1: Teste que falha** — adicionar ao carrinho quantidade maior que o saldo mostra "Saldo insuficiente (disponível: N)" e mantém "Registrar retirada" desabilitado.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(app): almoxarifado`

---

### Task 16: Mural, notificações, Pessoas e acessos, Configurações, Formulários

**Files:**
- Create: `app/src/telas/mural/{Mural,AvisoForm}.tsx`, `app/src/layout/Notificacoes.tsx`, `app/src/telas/pessoas/{Pessoas,PessoaForm,PermissoesEditor}.tsx`, `app/src/telas/configuracoes/Configuracoes.tsx`, `app/src/telas/formularios/Formularios.tsx` (+ css)
- Test: `app/src/telas/pessoas/PermissoesEditor.test.tsx`

Requisitos: **Mural** (spec 10.2) com fixados primeiro, filtro de público, formulário (título, texto, público, pessoas específicas, fixar, validade, pede confirmação) e lista de quem leu; **Notificações** no sininho (lista, "Marcar todas como lidas"); **Pessoas** (spec 5) com lista filtrável (tipo, vínculo, ativo), formulário com validações (`normalizarMatricula`, e-mail único), escolha de modelo + `PermissoesEditor` (tabela módulo × Nenhum/Ver/Editar), seção "Dados pessoais" só com permissão, "Redefinir senha para a matrícula" (confirmação) e "Desativar"; **Configurações** com os campos de `Config`, feriados do ano e botão "Restaurar dados de exemplo"; **Formulários** com os links de `config.linksFormularios` (abre em nova aba).

- [ ] **Step 1: Teste que falha** — em `PermissoesEditor`, escolher o modelo "Operação" define Pagamentos como "Nenhum" e Escalas como "Editar"; alterar um módulo depois mantém os demais.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar e ver passar**
- [ ] **Step 5: Commit** — `feat(app): mural, notificações, pessoas, configurações e formulários`

---

### Task 17: Busca inteligente (simulada), PWA e verificação final

**Files:**
- Create: `app/src/layout/Busca.tsx` (+ css), `app/src/busca/buscaComum.ts`, `app/src/busca/interpretarSimulado.ts`, `app/public/icone-192.png`, `app/public/icone-512.png`
- Modify: `app/vite.config.ts` (PWA), `app/src/layout/BarraSuperior.tsx`
- Test: `app/src/busca/buscaComum.test.ts`, `app/src/busca/interpretarSimulado.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ResultadoBusca { tipo: 'pessoa' | 'evento' | 'item' | 'contrato'; titulo: string; subtitulo: string; link: string; }
export function buscaComum(termo: string, dados: { pessoas: Pessoa[]; eventos: Evento[]; itens: AlmoxItem[]; contratos: Contrato[] }, p: Permissoes): ResultadoBusca[];
  // sem acento e sem caixa; máximo 8; só módulos permitidos
export type Consulta = { nome: 'escalaDoDia'; data: DataISO } | { nome: 'escalasDaPessoa'; termo: string } | { nome: 'proximosEventos' }
  | { nome: 'vagasFaltando' } | { nome: 'naoResponderam' } | { nome: 'saldoItem'; termo: string } | { nome: 'estoqueCritico' }
  | { nome: 'contratosPendentes' } | { nome: 'lotesEmAberto' };
export function interpretarSimulado(pergunta: string, hoje: DataISO): Consulta | null;
  // substitui o Gemini nesta fase: regras por palavras-chave ('sábado' → o próprio dia se hoje for sábado, senão o próximo; 'quem trabalha|escalad' → escalaDoDia; 'quanto temos|saldo' → saldoItem; …)
```

Requisitos (spec 10.3): ao digitar, lista de `buscaComum`; ao pressionar Enter com frase interrogativa ou ≥ 4 palavras, `interpretarSimulado` → executa a consulta nos dados do cliente simulado → card de resposta com links e a linha discreta "resposta automática · confira os dados"; sem interpretação → "Não consegui interpretar agora; veja os resultados da busca". Nenhum ícone de brilho/robô, nenhuma palavra "IA". PWA: manifest `name: 'GestorCC'`, `short_name: 'GestorCC'`, `theme_color: '#232323'`, `background_color: '#F4F4F2'`, ícones a partir do logo (fundo grafite).

- [ ] **Step 1: Testes que falham**
- `buscaComum('helo', …)` encontra "Heloá" (sem acento); para permissões `eventual` não retorna contratos nem itens.
- `interpretarSimulado('quem trabalha sábado?', '2026-10-26')` → `{ nome: 'escalaDoDia', data: '2026-10-31' }`; `'quanto temos de fita crepe?'` → `{ nome: 'saldoItem', termo: 'fita crepe' }`; `'bom dia'` → `null`.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Verificação final**

Run: `npm test && npm run typecheck && npm run build`
Expected: todos os testes passam, sem erros de tipo, build gerado com `manifest.webmanifest`.
Conferir manualmente com `npm run dev` (gestor e bolsista; 360 px e 1280 px): login, disponibilidade, montar → publicar → imprimir escala, lote → ficha, saída do almox, busca.

- [ ] **Step 5: Commit** — `feat(app): busca simulada, PWA e ajustes finais da fase 0`
