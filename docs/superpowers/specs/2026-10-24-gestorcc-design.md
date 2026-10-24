# GestorCC — Especificação de design

**Data:** 24/10/2026
**Status:** aguardando revisão
**Escopo:** sistema web de gestão do Centro de Convenções da UFSM (PRE / Coordenadoria de Cultura e Arte)

---

## 1. Objetivo

Substituir as planilhas e scripts avulsos usados hoje (Gerador de Escala 3.0, Almoxarifado CC 1.0, controle de contratos, fichas de pagamento montadas à mão) por um único webapp minimalista, com a identidade visual do CC, que:

- centraliza eventos, escalas de bolsistas, pagamentos, contratos, almoxarifado e avisos;
- permite que bolsistas e servidores lancem disponibilidade e acompanhem as próprias escalas e ganhos pelo celular;
- mantém os dados em Google Sheets numa pasta do Drive do setor, de forma que a equipe acostumada com planilhas continue **visualizando** tudo nelas (somente leitura);
- tem custo zero de operação.

Os scripts existentes servem **apenas como referência do funcionamento do setor**. O GestorCC é escrito do zero, com outra estrutura de dados e outro código.

### 1.1 Usuários e volume

| Grupo | Quantidade | Uso |
|---|---|---|
| Servidores do setor | 5 | diário |
| Bolsistas fixos (2 deles atuam como gestores) | 4 | diário |
| Bolsistas eventuais | ~30 | pico no início do mês (lançar disponibilidade), depois consulta |

Uso diário: ~8 pessoas, ~4 simultâneas. Pico: ~30 pessoas na abertura da disponibilidade.

### 1.2 Fora do escopo desta especificação

- Formulários próprios (solicitação de agenda, registro de problemas, ficha técnica). Eles serão scripts separados no futuro; o GestorCC só terá **links** para eles e, depois, telas de visualização das respostas.
- Assinatura eletrônica de documentos (continua no PEN-SIE).
- Revisão jurídica dos modelos de contrato (o módulo de contratos é uma **versão inicial**, a ser revista com a coordenação).

---

## 2. Arquitetura

```
 Navegador (celular/PC)                 Google (conta institucional do setor)
┌───────────────────────┐   HTTPS    ┌────────────────────────────────────────┐
│ GestorCC — app React  │ ─────────▶ │ API GestorCC — Google Apps Script      │
│ (PWA, Firebase        │ ◀───────── │  • autenticação e permissões           │
│  Hosting, plano Spark)│    JSON    │  • fila de gravação (LockService)      │
└───────────────────────┘            │  • geração de documentos (Docs/Drive)  │
                                     │  • rascunhos de e-mail (Gmail)         │
                                     │  • agenda do setor (Google Agenda)     │
                                     │  • interpretação de perguntas (Gemini) │
                                     └───────┬──────────────┬─────────────┬───┘
                                             ▼              ▼             ▼
                                     📗 GestorCC-Dados  📘 Relatórios  🔒 Sigiloso
```

### 2.1 Componentes

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| **App** (`app/`) | React + TypeScript + Vite, React Router, TanStack Query, CSS Modules com variáveis de design, `vite-plugin-pwa` | Interface de gestores e bolsistas; cache de leituras; impressões |
| **API** (`api/`) | Google Apps Script em TypeScript, empacotado com esbuild, publicado com `clasp` como aplicativo da Web ("executar como: conta do setor", "acesso: qualquer pessoa") | Única porta de entrada para os dados; valida sessão e permissão em toda ação; mantém a agenda Google do setor sincronizada (seção 7.11) |
| **Regras compartilhadas** (`shared/`) | TypeScript puro, sem dependência de Google ou navegador | Regras de escala, alertas, auto-preenchimento, cálculo de pagamento, saldo do almoxarifado, checagem de permissões, tipos |
| **Planilhas** | Google Sheets numa pasta do Drive do setor | Armazenamento |

O mesmo código de `shared/` roda no app (para mostrar alertas e prévias na hora) e na API (para validar de verdade antes de gravar).

### 2.2 Planilhas

| Planilha | Conteúdo | Compartilhamento no Drive |
|---|---|---|
| 📗 **GestorCC-Dados** | Tabelas do sistema (seção 4), uma linha por registro | Conta do sistema: edição. Gestores: leitura. |
| 📘 **GestorCC-Relatórios** | Abas no formato que a equipe já conhece, regeneradas automaticamente (seção 11) | Conta do sistema: edição. Os 9 servidores/bolsistas fixos: leitura. |
| 🔒 **GestorCC-Sigiloso** | CPF, dados bancários, nascimento, camiseta, credenciais, contratantes | **Somente** a conta do sistema. |

Ninguém além da conta do sistema tem permissão de edição em nenhuma planilha. Toda alteração passa pela API.

### 2.3 Custo

Tudo no plano gratuito: Firebase Hosting (Spark, sem cartão), Apps Script (incluído na conta institucional), API do Gemini no nível gratuito. Nenhuma funcionalidade depende de cobrança.

### 2.4 Ambientes

- **Teste:** cópias das três planilhas com dados fictícios, implantação separada da API, site de teste no Firebase.
- **Produção:** planilhas reais.

Toda mudança passa pelo ambiente de teste antes de ir para produção.

### 2.5 Estrutura do repositório

```
app/        front-end React
api/        Apps Script (TypeScript → Code.js)
shared/     regras de negócio e tipos compartilhados
docs/       especificações, planos e manual de uso
referencias/  material de referência (fora do git — dados sigilosos)
```

---

## 3. Contrato da API

- Um único endpoint `POST`, corpo JSON enviado como `text/plain` (evita a verificação prévia de CORS do navegador, que o Apps Script não atende).
- Requisição: `{ acao, token, idRequisicao, dados }`.
  - `acao`: nome da operação (ex.: `escalas.publicar`).
  - `token`: sessão (seção 5.2); ausente apenas em `auth.entrar` e `auth.esqueciSenha`.
  - `idRequisicao`: UUID gerado pelo app em toda gravação. A API guarda os IDs processados nas últimas 24 h e, se receber o mesmo ID de novo, devolve o resultado anterior em vez de gravar duas vezes.
- Resposta de sucesso: `{ ok: true, dados }`.
- Resposta de erro: `{ ok: false, erro: { codigo, mensagem } }`, com `mensagem` sempre em português claro, pronta para mostrar ao usuário.
- Toda ação de escrita:
  1. valida o token;
  2. confere a permissão do módulo (seção 5.3);
  3. adquire a trava global de gravação (`LockService`, espera máxima de 10 s; se não conseguir, devolve `SISTEMA_OCUPADO`);
  4. confere a versão do registro (`atualizadoEm` enviado pelo app); se outro usuário alterou antes, devolve `CONFLITO` com quem alterou e quando;
  5. grava e registra no `historico`.
- Leituras usam `CacheService` por tabela, invalidado em cada gravação daquela tabela.

---

## 4. Modelo de dados

Todas as tabelas têm `id` (texto curto único), `criadoEm`, `atualizadoEm` e `atualizadoPor`, exceto quando indicado. Datas em ISO (`AAAA-MM-DD`), horários em `HH:MM`. Documentos (CPF, matrícula, conta) são sempre **texto**, nunca número.

### 4.1 GestorCC-Dados

**Pessoas e acesso**

| Tabela | Colunas principais |
|---|---|
| `pessoas` | nome, nomeCurto (exibição na escala, ex.: "ISABELA A."), emailAcademico (login), emailAlternativo, matricula, siape, tipo (`servidor`/`bolsista`), vinculo (`fixo`/`eventual`), experiente (bool), escalarMenos (bool), ativo (bool), convitesAgenda (e-mail que recebe os convites do Google Agenda; vazio = desativado) |
| `permissoes` | pessoaId, modulo, nivel (`nenhum`/`ver`/`editar`) |

**Eventos e escalas**

| Tabela | Colunas principais |
|---|---|
| `eventos` | nome, tipo (`Congresso`/`Formatura`/`Show/Concerto`/`Corporativo`/`Outro`), organizador, contatoOrganizador, servidorResponsavelId, publicoEstimado, publicoReal, pagamento (`interno`/`externo`), pagadorExterno, instrumento (`contrato`/`termo`/`nenhum`), status (`ativo`/`cancelado`), observacoes |
| `sessoes` | eventoId, data, rotulo (ex.: "Manhã", "Sessão 2"), chegada, inicio, fim, horarioADefinir (bool), vagasBolsistas (padrão 8), vagasServidores (padrão 1), diaria (vazio = valor padrão), minimoExperientes (padrão 1), status (`ativa`/`cancelada`), publicadaEm, convocacaoAbertaAte, convocacaoVagas, googleEventoId (evento correspondente na agenda do setor) |
| `rodadas` | nome (ex.: "Dezembro/2026"), prazo (data e hora), status (`aberta`/`fechada`) |
| `rodadaSessoes` | rodadaId, sessaoId |
| `disponibilidades` | pessoaId, sessaoId, disponivel (bool), origem (`proprio`/`gestor`/`convocacao`), respondidoEm |
| `escalas` | sessaoId, pessoaId, papel (`bolsista`/`servidor`), status (`rascunho`/`publicado`/`realizado`/`faltou`/`cancelado`), adicaoDireta (bool), loteId |
| `avaliacoes` | pessoaId, mes (`AAAA-MM`), nota (1–5), observacao, autorId |
| `feriados` | data, nome |

**Pagamentos**

| Tabela | Colunas principais |
|---|---|
| `lotes` | titulo, periodoReferencia, edital, iniciativa, incluirZerados (bool), status (`enviado`/`pago`/`cancelado`), pagoEm |
| `loteItens` | loteId, escalaId, pessoaId, valor |
| `envioExterno` | eventoId, enviadoEm, enviadoPor, campos (lista) |

**Contratos e documentos**

| Tabela | Colunas principais |
|---|---|
| `contratos` | numero (`N/AAAA`), eventoId, contratanteId, processoPen, valorBase, itemTabela, vencimento, areas (lista), cortesiasQtd, ingressoSolidario (`Possui`/`Não possui`/`CACC`/`Mesa Brasil`), statusContrato, statusFatura, numeroFatura, statusEcad, statusIss, statusFundep, statusCortesias, fichaTecnicaRecebida (bool), pdfAssinadoId, pdfFaturaId, canceladoMotivo, observacoes |
| `aditivos` | contratoId, numero, data, descricao, valorDelta, novaData, statusFatura, numeroFatura, pdfAssinadoId |
| `documentosGerados` | tipo (`contrato`/`termo`/`piano`/`ficha`), referenciaId, docId, pdfId |

**Almoxarifado**

| Tabela | Colunas principais |
|---|---|
| `almoxItens` | cod (4 dígitos, texto), nomeAlmox, nomeComum, unidade, valor, categoria, qtdMinima, sala, status (`Ativo`/`Inativo`), saldo (calculado e mantido pela API) |
| `almoxMovimentos` | tipo (`entrada`/`saida`/`ajuste`/`recebimento`), cod, qtd (com sinal), valorUnitario, retiradoPorPessoaId, retiradoPorExterno, eventoId, finalidade, pedidoId, motivo |
| `almoxAutorizadosExternos` | nome, ativo |
| `almoxPedidos` | solicitanteId, status (`aberto`/`parcial`/`recebido`/`cancelado`) |
| `almoxPedidoItens` | pedidoId, cod, qtdPedida, qtdRecebida, valorEstimado |

**Comunicação e sistema**

| Tabela | Colunas principais |
|---|---|
| `avisos` | titulo, texto, publico (`todos`/`gestores`/`bolsistas`/`pessoas`), pessoasIds, fixado, validoAte, pedeConfirmacao, autorId |
| `avisosLeituras` | avisoId, pessoaId, lidoEm |
| `notificacoes` | pessoaId, tipo, texto, link, lidaEm |
| `historico` | quando, quemId, entidade, entidadeId, acao, antes, depois, justificativa (sem `atualizadoEm`) |
| `config` | chave, valor |

`config` guarda: agenda Google do setor (id, nome e conta), valor padrão da diária (R$ 80,00), vagas padrão, edital e iniciativa da ficha de pagamento, número do projeto FUNDEP (30055), destinatários da FUNDEP, dados fixos dos modelos de contrato (signatária, processo da tabela de valores), limite diário de perguntas à busca, modelos de permissão, links dos formulários externos.

### 4.2 GestorCC-Sigiloso

| Tabela | Colunas principais |
|---|---|
| `dadosPessoais` | pessoaId, cpf, banco, agencia, conta, nascimento, camiseta |
| `credenciais` | pessoaId, hash, sal, iteracoes, senhaInicial (bool), versaoToken, falhas, bloqueadoAte, resetToken, resetExpira |
| `contratantes` | razaoSocial, documento (CNPJ/CPF), inscricaoMunicipal, inscricaoEstadual, endereco, cep, representanteNome, representanteCpf, email, contatoFaturaNome, contatoFaturaEmail, contatoFaturaTelefone |

### 4.3 Validações de cadastro

- Matrícula: só dígitos, 9 ou 10 caracteres, guardada como texto.
- CPF: normalizado para `000.000.000-00` e validado pelos dígitos verificadores.
- E-mail acadêmico único entre pessoas ativas.
- Agência e conta: texto livre, preservando dígito e zeros à esquerda.

---

## 5. Autenticação e permissões

### 5.1 Login

- Usuário: e-mail acadêmico. Senha inicial: matrícula (só dígitos).
- Senhas guardadas como hash PBKDF2-HMAC-SHA256 com sal individual (`Utilities.computeHmacSha256Signature`).
- No primeiro acesso aparece um aviso sugerindo trocar a senha, que pode ser dispensado e reaparece a cada login até a troca. **Exceção:** quem tem o nível `editar` em **Dados pessoais** é obrigado a trocar a senha no primeiro acesso, porque a matrícula não é um segredo e essa permissão expõe CPF e dados bancários de todos.
- 5 tentativas erradas seguidas bloqueiam o login daquela conta por 15 min.
- **Esqueci a senha:** envia ao e-mail acadêmico um link de redefinição válido por 1 h (MailApp). Gestores com permissão em Pessoas também podem redefinir a senha para a matrícula.

### 5.2 Sessão

- Token assinado (HMAC com segredo guardado nas propriedades do script) contendo pessoaId, versaoToken e expiração de 7 dias.
- Trocar a senha, redefini-la ou desativar a pessoa incrementa `versaoToken`, invalidando as sessões abertas.
- Sessão expirada: o app volta para o login e, depois de entrar, retorna à tela em que a pessoa estava.

### 5.3 Módulos e níveis

Cada pessoa tem um nível por módulo: `nenhum`, `ver` ou `editar`. A API confere a permissão em **toda** ação, não apenas escondendo o menu.

| Módulo | Gestor | Operação | Eventual |
|---|---|---|---|
| Eventos e agenda | editar | editar | nenhum |
| Escalas | editar | editar | nenhum |
| Pagamentos | editar | nenhum | nenhum |
| Contratos | editar | nenhum | nenhum |
| Almoxarifado — estoque | editar | editar | nenhum |
| Almoxarifado — saídas | editar | editar | nenhum |
| Mural de avisos | editar | editar | ver |
| Busca inteligente | editar | editar | nenhum |
| Formulários (links) | ver | ver | nenhum |
| Pessoas e acessos | editar | nenhum | nenhum |
| Dados pessoais (CPF/banco) | editar | nenhum | nenhum |
| Configurações | editar | nenhum | nenhum |

- Gestor, Operação e Eventual são **modelos**. Ao cadastrar alguém, escolhe-se um modelo e depois se ajusta módulo a módulo.
- Independentemente das permissões, toda pessoa ativa acessa: Início, Minhas escalas, Minha disponibilidade, Meus ganhos (se bolsista), Avisos e Perfil.
- Toda alteração de permissão vai para o `historico`.

---

## 6. Interface

### 6.1 Identidade visual

Baseada no folder, no logo e na agenda mensal do CC.

| Elemento | Definição |
|---|---|
| Fundo | cinza-gelo `#F4F4F2` |
| Navegação lateral | grafite `#232323`, texto claro |
| Destaque | amarelo CC `#F5C518` (gradiente para `#D4AD00` só em grandes áreas): botão principal, item ativo, alertas |
| Texto | `#1A1A1A` / secundário `#5C5C5C` |
| Estados | sucesso, aviso e erro em tons sóbrios que não competem com o amarelo |
| Títulos | Montserrat (negrito), como na agenda mensal |
| Texto corrido | sans humanista legível, próxima do Zapf Humanist do folder (ex.: Source Sans 3) |
| Ornamento | losangos geométricos só na tela de login, em estados vazios e nos cantos de documentos impressos |

**Login:** no desktop, faixa amarela vertical com o logo à esquerda e foto de palco em preto e branco à direita (como a capa do folder). No celular, só a faixa com o logo e o formulário.

Somente tema claro nesta versão.

### 6.2 Estrutura

- **Desktop:** menu lateral grafite com os módulos que a pessoa pode acessar, barra superior com a busca inteligente, o sininho de notificações e o menu do usuário.
- **Celular:** barra inferior com Escalas · Disponibilidade · Ganhos · Menu (para gestores, os módulos aparecem no Menu).
- PWA instalável na tela inicial.

### 6.3 Telas

| Tela | Conteúdo |
|---|---|
| **Início (gestor)** | Eventos de hoje e da semana; pendências: confirmar presença, rodada aberta ("18 de 30 responderam"), sessões com vagas faltando, estoque crítico, alertas de contrato; valor contratado no ano e quanto já foi pago; avisos fixados |
| **Início (bolsista)** | Próxima escala com horário de chegada; destaque de rodada aberta ou convocação extra; avisos |
| **Agenda** | Calendário e lista do mês; cadastro de evento e sessões; imprimir agenda do mês; estatísticas |
| **Escalas** | Rodadas; montador; publicação; convocação extra; trocas; confirmar presença; impressões; textos de WhatsApp; avaliações |
| **Pagamentos** | Lotes; novo lote; ficha de indicação; pagamentos externos |
| **Contratos** | Lista com etiquetas de situação; contrato; contratantes; aditivos; solicitar faturas à FUNDEP; gerar documentos |
| **Almoxarifado** | Estoque; saída; pedidos; recebimento; painel; etiquetas QR |
| **Mural** | Avisos; criar e editar; leituras |
| **Pessoas** | Cadastro; modelo e permissões; dados pessoais; redefinir senha; desativar |
| **Configurações** | Diária, vagas padrão, feriados, edital/iniciativa, FUNDEP, signatários, links de formulários, limite da busca |
| **Minhas escalas** | Próximas primeiro; colegas da sessão; botão "Adicionar ao Google Agenda" (link de modelo de evento, sem integração) |
| **Minha disponibilidade** | Sessões da rodada agrupadas por dia, Sim/Não em cada uma, salvamento automático, prazo visível |
| **Meus ganhos** | Previsto, enviado, pago, externos (seção 8.4) |
| **Perfil** | Trocar senha; ver e corrigir os próprios dados pessoais |

---

## 7. Eventos e escalas

### 7.1 Eventos e sessões

- Um evento tem uma ou mais sessões. Cada sessão é escalada e paga separadamente (uma diária por sessão).
- Uma sessão pode ter o horário "a definir". Quando o horário é preenchido, quem está escalado recebe notificação.
- Feriados vêm da tabela `feriados` e aparecem na agenda e na impressão mensal.

### 7.2 Rodada de disponibilidade

1. O gestor cria a rodada, escolhe as sessões e define o prazo. Ela fica visível para todos os bolsistas e servidores ativos.
2. Cada pessoa marca Sim ou Não por sessão. Sem resposta conta como indisponível.
3. Sessão criada com a rodada aberta e dentro do período entra automaticamente, com o selo "nova".
4. Depois do prazo, a rodada trava. O gestor pode reabrir ou marcar a disponibilidade por alguém (`origem = gestor`, registrado no histórico).
5. O gestor vê quem respondeu e quem falta, com o texto de lembrete pronto para o WhatsApp.

### 7.3 Montagem (rascunho)

- Rascunhos são visíveis só para quem tem acesso ao módulo Escalas.
- **Visões:** grade (pessoas × sessões do período) e foco sessão a sessão com meta de vagas e barra de progresso.
- **Auto-preencher** (uma sessão ou o período inteiro, em ordem cronológica). Critérios, em ordem:
  1. disponível e sem conflito de horário;
  2. menos escalas no mês (equilíbrio);
  3. pessoas com `escalarMenos` por último;
  4. garantir `minimoExperientes` por sessão;
  5. empate: ordem alfabética.
- **Alertas:**
  - 🔴 conflito de horário (sessões que se sobrepõem): **bloqueia**;
  - 🟡 dias seguidos: aviso;
  - ⚪ duas sessões no mesmo dia sem sobreposição: informação.
- **Escalar alguém indisponível:** permitido com confirmação; a escala fica com `adicaoDireta = true` e vai para o histórico.
- **Sugestões de equilíbrio:** pares "tirar X / colocar Y" que reduzem a diferença de escalas entre pessoas e reduzem as escalas de quem tem `escalarMenos`, aplicáveis com um clique.
- Servidor ocupa somente vaga de servidor; bolsista, somente vaga de bolsista.

### 7.4 Publicação

- O gestor publica um conjunto de sessões (normalmente o mês). As escalas passam de `rascunho` a `publicado` e ficam visíveis aos escalados, que veem também os colegas da sessão.
- Notificação no app para cada escalado; e-mail opcional (caixa marcada no momento de publicar).
- Gera os textos de WhatsApp: um por sessão (grupo) e um por pessoa (escala individual), com link `wa.me`.
- Disponibiliza a impressão no formato tradicional (seção 7.8).
- Marca as abas de relatório para regeneração.

### 7.5 Alterações depois de publicada

- Toda mudança é uma **troca** (sai/entra, só entra, só sai) com **justificativa obrigatória**, registrada no histórico. As pessoas afetadas recebem notificação.
- **Cancelar sessão ou evento:** todas as escalas viram `cancelado`, os escalados são notificados e o fato vai para o histórico. **Escala cancelada nunca entra em pagamento.**

### 7.6 Convocação extra

1. Numa sessão publicada, o gestor informa quantas vagas a mais e até quando ("+3 até hoje 18h").
2. Os escalados permanecem. A sessão volta a aceitar disponibilidade só de quem ainda não está nela (`origem = convocacao`).
3. Os bolsistas recebem destaque no app; o sistema gera o texto de WhatsApp para o grupo; e-mail opcional.
4. O gestor escala os novos (fluxo normal de troca, justificativa "convocação extra" preenchida automaticamente). Os novos escalados são notificados.

### 7.7 Presença

- Ao fim da sessão, ela aparece em "Confirmar presença" com todos marcados como presentes. O gestor desmarca quem faltou e confirma.
- Presente → `realizado`. Ausente → `faltou` (não é pago; registrado no histórico da pessoa).

### 7.8 Impressões

| Impressão | Formato |
|---|---|
| **Escala — formato tradicional** | Título "TABELA DE ESCALA DOS BOLSISTAS" e "Período de Referência"; uma coluna por sessão (data, dia da semana, evento, horário); linha "Estar no CC" com o horário de chegada; uma linha por pessoa com **X** onde está escalada. A4 paisagem, quebra de página automática pelo número de colunas. |
| **Agenda do mês** | Título "MÊS/ANO"; uma linha por dia do mês (inclusive vazios); colunas DIA, EVENTO, RESPONSÁVEL (organizador e contato), RESP. NUGAC (servidor responsável), HORÁRIO; feriados marcados como "FERIADO". |

Ambas usam CSS de impressão e podem ser salvas em PDF pelo navegador.

### 7.9 Avaliações

Nota mensal de 1 a 5 e observação por bolsista, visíveis só para quem tem acesso ao módulo Escalas.

### 7.10 Estatísticas de eventos

Total de eventos, público total e média, filtráveis por período e por tipo de evento.

### 7.11 Integração com o Google Agenda

**A) Agenda do setor, sempre sincronizada.** A conta do sistema (a do CC) mantém uma agenda Google "Centro de Convenções UFSM". A API, com o serviço de agenda do Apps Script, mantém um evento por sessão:

- criar ou alterar sessão (data, horários, "a definir" → definido) cria ou atualiza o evento;
- cancelar sessão ou evento marca o evento como cancelado (título prefixado com "CANCELADO –") e notifica os convidados;
- descrição do evento: organizador, servidor responsável, horário de chegada e link para o evento no GestorCC (sem dados pessoais);
- a equipe só assina essa agenda (leitura), sem login no GestorCC.

A sincronização acontece na mesma gravação; se o Google falhar, a gravação no GestorCC vale mesmo assim e o evento é marcado para nova tentativa pelo gatilho de 5 minutos.

**B) Convites para o bolsista (opcional).** No Perfil, a pessoa ativa "Receber minhas escalas no Google Agenda" e escolhe o e-mail (acadêmico ou alternativo). Com isso:

- ao **publicar** a escala, ela é adicionada como convidada no evento da sessão na agenda do setor e o evento aparece no Google Agenda dela;
- **trocas**, **horário definido** e **cancelamentos** se refletem na hora (convidado incluído ou removido, evento atualizado);
- os convidados **não veem os e-mails uns dos outros** (opção de privacidade do evento, via serviço avançado de Agenda);
- quem não ativa continua com o botão "Adicionar ao Google Agenda" (cópia única) em Minhas escalas.

Sincronização nos dois sentidos (eventos criados no Google entrando no GestorCC) **não** faz parte do escopo: o GestorCC é a fonte única da agenda.

---

## 8. Pagamentos

### 8.1 Situações da escala

`publicado` → `realizado` (presença confirmada) → `enviado para pagamento` (está em lote `enviado`) → `pago` (lote `pago`).
`faltou` e `cancelado` nunca são pagos.

### 8.2 Lote interno

1. **Novo lote:** lista as escalas `realizado` de sessões de eventos com pagamento `interno` que não estão em nenhum lote ativo, agrupadas por evento, com filtro por data.
2. O gestor marca livremente as sessões que entram (não há regra automática de datas).
3. Prévia: por pessoa, quantidade de sessões × diária (respeitando diárias especiais) e total do lote.
4. Cabeçalho preenchido e editável: período de referência (calculado pelas datas escolhidas, ex.: "OUTUBRO/2026 – eventos de 16/09/2026 até 15/10/2026"), edital e iniciativa (de Configurações).
5. Ao confirmar: lote `enviado`, itens gravados.
6. **Correções** enquanto o lote não está pago: incluir ou retirar sessões, ou cancelar o lote (as escalas voltam a ficar disponíveis para outro lote). Tudo no histórico.
7. **Marcar como pago**, com data.

### 8.3 Ficha de indicação (e-mail ao setor de pagamento)

Gerada a partir do lote, no formato usado hoje:

- Título "FICHA DE INDICAÇÃO DE BOLSISTAS", período de referência, iniciativa e edital.
- Tabela: nº, NOME, MATRÍCULA, CPF, BANCO, AGÊNCIA, CONTA, VALOR (R$); linha de TOTAL.
- Por padrão lista todos os bolsistas ativos, inclusive os de R$ 0,00 (`incluirZerados`); pode ser desmarcado.
- Texto de encaminhamento e discriminação: para cada bolsista, os eventos em que atuou com as datas.
- Observação da fonte do recurso e fechamento.
- Saídas: **copiar formatado** (para colar no Gmail) e **baixar .docx/PDF**.
- CPF e dados bancários aparecem somente para quem tem permissão em Dados pessoais; para os demais, mascarados (`***.***.850-**`).

### 8.4 Pagamento externo

- Eventos com pagamento `externo` (com o nome do pagador) nunca entram em lotes.
- Após a presença confirmada: "Gerar dados para o pagador", com escolha dos campos (nome, matrícula, função, data e horário; CPF e banco só com permissão em Dados pessoais). Saída em planilha (.xlsx) ou PDF.
- O sistema registra apenas que os dados foram enviados e quando (`envioExterno`). Não acompanha o pagamento.

### 8.5 Meus ganhos

| Bloco | Conteúdo |
|---|---|
| **Previsto (≈)** | Escalas `publicado` (futuras ou aguardando confirmação de presença) + `realizado` fora de lote, de eventos internos, × diária |
| **Enviado para pagamento** | Por lote: título, data, eventos e valor |
| **Pago** | Histórico por lote |
| **Pagamentos externos** | Separado e fora do total previsto: evento, data e quem paga |

---

## 9. Contratos e documentos (versão inicial)

> Este módulo será revisto com a coordenação. A estrutura abaixo segue a planilha de controle e os modelos atuais.

### 9.1 Contratantes

Cadastro reaproveitável (tabela `contratantes`, planilha sigilosa). Os relatórios mostram apenas razão social e e-mail.

### 9.2 Contrato

- Número sequencial no ano, sugerido automaticamente e editável; processo PEN-SIE; evento vinculado (datas vêm das sessões).
- Valor base, item da tabela de preços, vencimento da fatura.
- Áreas cedidas: Hall de entrada, Mezanino, Plateia, Palco, Camarins, outras (texto).
- Cortesias (quantidade) e ingresso solidário.
- Aditivos com data, descrição, mudança de valor e/ou data; valor total = base + aditivos.
- Cancelamento com motivo; fatura de multa registrável.
- Upload do PDF assinado e do PDF da fatura (salvos na pasta do Drive).

### 9.3 Situações

| Item | Opções |
|---|---|
| Contrato | Não enviado · Enviado · Enviado ao PEN-SIE · Assinado · Cancelado |
| Fatura | Não enviada p/ emissão · Enviada p/ emissão · Não paga · Paga · Isento |
| ECAD | Não enviado · Enviado p/ processamento · Não pago · Pago · Isento |
| ISS | Não enviado · Enviado p/ processamento · Não pago · Pago · Isento |
| FUNDEP | Não enviado · Enviado · Ok |
| Cortesias | Não recebidas · Recebidas · Distribuídas |
| Ficha técnica | Recebida · Não recebida |

### 9.4 Alertas (pendências no Início)

- Fatura vencendo em até 7 dias, ou vencida sem pagamento.
- ECAD ou ISS sem `Pago`/`Isento` com o evento a 5 dias ou menos.
- Contrato não assinado com o evento a menos de 10 dias.
- Cortesias não recebidas na véspera do evento.

### 9.5 Solicitação de faturas à FUNDEP

1. "Solicitar faturas à FUNDEP": seleciona contratos (ou aditivos) assinados com fatura `Não enviada p/ emissão`.
2. Monta o e-mail no formato atual:
   - assunto `[<nº do projeto>] Cadastramento dos contratos/clientes para emissão de fatura`;
   - destinatários da FUNDEP vindos de Configurações;
   - texto de abertura pedindo a emissão das faturas da taxa de locação e o envio ao interessado com cópia para o CC;
   - um bloco por contrato: **CONTRATO Nº N/AAAA** (ou **ADITIVO Nº X AO CONTRATO Nº N/AAAA**), CNPJ/CPF e razão social, inscrição municipal, inscrição estadual, endereço completo com CEP, pessoa de contato para a fatura, e-mail com cópia para o CC, telefone, **valor** e **vencimento**;
   - assinatura padrão do CC (de Configurações).
3. Se a conta do sistema for a do CC, cria um **rascunho no Gmail** com os PDFs assinados anexados, para revisão e envio manual. Caso contrário, oferece "copiar formatado" e "baixar anexos".
4. Ao confirmar o envio, a fatura passa a `Enviada p/ emissão`. Quando a FUNDEP responde, o gestor registra o número da fatura e anexa o PDF.

### 9.6 Geração de documentos

- Modelos são Google Docs numa pasta `Modelos/` do Drive, com campos `{{CAMPO}}`.
- "Gerar" copia o modelo para `Documentos gerados/AAAA/`, substitui os campos e devolve o link do Google Doc e a exportação .docx/PDF.
- Cláusulas são editadas diretamente no modelo, sem mudar o sistema.
- Modelos iniciais (criados a partir dos arquivos de referência):
  1. **Contrato de permissão indenizada de uso de espaço público**;
  2. **Termo de autorização de uso de espaço físico** (eventos internos e de professores), com campo de texto livre para cláusulas específicas;
  3. **Formulário de empréstimo do piano**.

---

## 10. Almoxarifado, mural e busca

### 10.1 Almoxarifado

- **Movimentos:** toda alteração de estoque é um registro em `almoxMovimentos` (entrada, saída, ajuste com motivo, recebimento). O `saldo` de cada item é atualizado pela API na mesma gravação e pode ser recalculado a partir dos movimentos.
- **Estoque:** busca, filtros (categoria, sala, status), destaque para saldo ≤ mínimo; ajuste de catálogo; impressão de etiquetas com QR do código do item.
- **Saída:** carrinho; leitura de QR ou código de barras pela câmera; quem retira (pessoa do sistema ou autorizado externo ativo); finalidade; evento vinculado (opcional). **Não permite saldo negativo**: avisa e impede a retirada acima do saldo.
- **Pedidos:** sugestão para itens com saldo ≤ mínimo, quantidade sugerida `max(1, 2 × mínimo − saldo)` (editável); lista de compras para imprimir; recebimento total ou parcial, que gera movimentos de `recebimento`.
- **Painel:** valor em estoque por categoria, consumo por mês, itens mais retirados, consumo por evento.

### 10.2 Mural de avisos

- Título, texto, público (todos, gestores, bolsistas ou pessoas específicas), fixar, validade (some após a data), "confirmar leitura" opcional com lista de quem leu.
- Avisos automáticos do sistema (publicação de escala, convocação extra, troca, horário definido) vão para `notificacoes` (sininho), não para o mural.

### 10.3 Busca inteligente

Na barra superior, para quem tem o módulo. Sem marca de "IA" na interface; as respostas trazem a marcação discreta "resposta automática · confira os dados".

1. **Busca comum (sem IA):** enquanto a pessoa digita, mostra pessoas, eventos, itens e contratos que combinam, respeitando as permissões.
2. **Pergunta:** a pergunta é enviada ao Gemini (nível gratuito) junto com a lista de consultas disponíveis. O Gemini devolve **apenas a consulta e os parâmetros** (chamada de função). A API executa a consulta com as permissões de quem perguntou e o app monta a resposta em card, com links.
3. **Os dados do sistema nunca são enviados ao Gemini.** Só a pergunta digitada.
4. Perguntas sobre como usar o sistema são respondidas com base em um manual de uso sem dados reais (`docs/manual/`), enviado como contexto.
5. Limite configurável de perguntas por pessoa por dia. Se o limite do nível gratuito for atingido ou o Gemini falhar, a barra continua funcionando como busca comum, com a mensagem "Não consegui interpretar agora; veja os resultados da busca".

**Consultas iniciais:** escala de um dia ou sessão; escalas de uma pessoa; próximos eventos; sessões com vagas faltando; quem não respondeu a rodada; saldo de um item; itens em estoque crítico; contratos com pendência; lotes em aberto.

---

## 11. Relatórios na planilha (visualização da equipe)

A planilha **GestorCC-Relatórios** é regenerada por um gatilho a cada 5 minutos, que só refaz as abas marcadas como desatualizadas pelas gravações:

| Aba | Conteúdo |
|---|---|
| ESCALA `<MÊS>` | Grade do mês: cabeçalho de sessões, servidores primeiro, bolsistas numerados, experientes em negrito, `escalarMenos` destacado |
| CONSULTA INDIVIDUAL | Total de escalas por pessoa no mês e lista de eventos de cada um |
| HISTÓRICO DE TROCAS | Data/hora, evento/data, quem saiu, quem entrou, justificativa |
| PAGAMENTOS – `<LOTE>` | Bolsista, quantidade, valor unitário, total, total do lote (sem CPF e banco) |
| CONTRATOS | As mesmas colunas da planilha de controle atual |
| ESTOQUE | Itens ativos com saldo, mínimo e situação |
| AGENDA `<MÊS>` | Mesma estrutura da impressão mensal |

---

## 12. Erros, auditoria e cópias de segurança

- Mensagens de erro em português claro.
- Gravação duplicada evitada por `idRequisicao` (seção 3).
- Edição simultânea detectada por versão (`CONFLITO`, com quem e quando alterou).
- Trava de gravação com espera máxima de 10 s (`SISTEMA_OCUPADO`); o app mantém o formulário preenchido e permite tentar de novo.
- O app aplica as mudanças na tela imediatamente e desfaz com aviso se a API recusar.
- `historico` registra toda gravação (quem, quando, entidade, antes, depois, justificativa).
- Gatilho diário copia as três planilhas para `Backups/AAAA-MM-DD/` e apaga cópias com mais de 30 dias.

---

## 13. Migração

Executada uma vez, por scripts de importação, no ambiente de teste primeiro:

1. **Pessoas e dados pessoais:** a partir da planilha de dados dos bolsistas e das listas de servidores, com normalização de matrícula, CPF, agência e conta. Inconsistências viram uma lista para correção manual, não são descartadas.
2. **Almoxarifado:** itens, autorizados externos, pedidos e retiradas do `BD_Almox`. As retiradas viram movimentos de `saida`; o saldo atual de cada item vira um movimento de `ajuste` inicial.
3. **Contratos:** linhas da planilha de controle atual.

Os scripts antigos podem continuar funcionando em paralelo até a equipe validar o GestorCC.

---

## 14. Testes

- **Regras (`shared/`):** testes automatizados (Vitest) escritos antes do código: auto-preencher, alertas, conflito de horário, equilíbrio, convocação extra, cálculo de lote e de "Meus ganhos", saldo do almoxarifado, checagem de permissões, validações de CPF e matrícula, montagem da ficha e do e-mail da FUNDEP.
- **API:** testes das ações com um adaptador de planilha em memória (as ações recebem um repositório abstrato, não chamam `SpreadsheetApp` diretamente).
- **App:** testes de componentes nos fluxos críticos (Testing Library).
- **Ponta a ponta:** Playwright contra o ambiente de teste: login, lançar disponibilidade, montar e publicar escala, convocação extra, confirmar presença, gerar lote, registrar retirada.

---

## 15. Ordem de entrega

| Fase | Entrega |
|---|---|
| **0. Protótipo navegável** | Todas as telas principais com dados fictícios, identidade visual, perfis gestor e bolsista, celular e desktop. Para validação com a equipe antes de ligar a API. |
| **1. Fundação** | Planilhas, API, login, troca e redefinição de senha, pessoas e permissões, mural, notificações, backup |
| **2. Eventos e agenda** | Eventos, sessões, feriados, impressão da agenda, estatísticas, agenda Google do setor e convites aos bolsistas (7.11) |
| **3. Disponibilidade e escalas** | Rodadas, montador, publicação, convocação extra, trocas, presença, impressões, WhatsApp, avaliações, relatórios |
| **4. Pagamentos** | Lotes, ficha de indicação, pagamento externo, Meus ganhos |
| **5. Almoxarifado** | Módulo completo e importação do `BD_Almox` |
| **6. Contratos e documentos** | Contratos, contratantes, aditivos, FUNDEP, modelos (versão inicial) |
| **7. Busca inteligente** | Busca comum e perguntas via Gemini |
| **Depois** | Formulários: links e visualização das respostas |

Ao fim da fase 3, o GestorCC substitui o Gerador de Escala no dia a dia.

---

## 16. Limitações conhecidas

- Cada chamada ao Apps Script leva de 0,5 a 2 s; o app compensa com cache e atualização otimista, mas não é instantâneo.
- O Apps Script aceita até 30 execuções simultâneas por script; o pico previsto (~30 pessoas lançando disponibilidade) fica dentro do limite porque cada chamada dura frações de segundo, mas é o primeiro ponto a observar se o uso crescer.
- O nível gratuito do Gemini tem limites de requisições por minuto e por dia; a busca comum é o plano B.
- A senha inicial (matrícula) não é secreta; a troca é sugerida para todos e obrigatória apenas para quem tem acesso a Dados pessoais.
- A API precisa ser publicada com acesso "qualquer pessoa", porque o login é próprio do GestorCC e não da conta Google. Se a administração do Google Workspace da UFSM bloquear essa opção, o plano alternativo é servir o app pelo próprio Apps Script (`HtmlService`, mesmo código React empacotado), mantendo login, API e planilhas como especificado. Isso deve ser verificado no início da fase 1, antes de qualquer outra integração.
