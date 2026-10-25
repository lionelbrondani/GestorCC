# GestorCC — Fase 4: Pagamentos — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Lotes internos, ficha de indicação, pagamento externo e "Meus ganhos" com dados reais (spec 8.2–8.5, 11).

**Architecture:** Novas ações em `api/src/acoes/pagamentos.ts`, no padrão das fases anteriores. Elas reaproveitam as regras de `shared/pagamentos/*`:
- `valorDaSessao`;
- `emLoteAtivo`;
- `meusGanhos`.

A ficha e a saída para o pagador externo já são montadas no app, a partir de `lotes.listar` e `dadosPessoais.obter`. A aba **PAGAMENTOS – \<LOTE\>** entra no gatilho de relatórios.

**Spec:** `docs/superpowers/specs/2026-10-24-gestorcc-design.md`, seções 8 e 11.

## Global Constraints

- Permissões (protótipo, `mockCliente.ts:100-106`):

  | Ações | Quem pode |
  |---|---|
  | `lotes.listar` | `pagamentos: ver` |
  | `lotes.criar`, `lotes.retirarItem`, `lotes.marcarPago`, `lotes.cancelar`, `externos.registrarEnvio` | `pagamentos: editar` |
  | `ganhos.meus` | qualquer pessoa logada |

- `faltou` e `cancelado` nunca são pagos. Só entram em lote escalas `realizado` de evento **interno**, em sessão ativa e fora de lote ativo (spec 8.1, 8.2 e 8.4).
- **Correções:** só valem enquanto o lote está `enviado`. Cancelar o lote devolve as escalas para outro lote.
- **Nenhum e-mail.** A ficha só é copiada ou baixada. Os avisos às pessoas são notificações no app.
- **Planilha de Relatórios:** a aba de pagamento não tem CPF nem dados bancários (spec 11).
- `VITE_RECURSOS` da fase 4: `pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais,pagamentos`.

## Review Focus

1. **Mesma escala em dois lotes**, por clique duplo ou por duas abas abertas. O segundo é recusado com `NAO_ELEGIVEL`. → teste na Task 1.
2. **Lote pago não pode ser alterado nem cancelado** (`LOTE_FECHADO`). → teste na Task 1.
3. **Lote cancelado devolve as escalas**, que podem entrar num lote novo. → teste na Task 1.
4. **Diária especial da sessão vale no item do lote**; sem diária especial, vale a diária padrão de Configurações. → teste na Task 1.
5. **Presença não pode ser refeita** depois que a escala entrou em lote. Isso já está garantido na fase 3, com `!loteId`. → teste na Task 1.

### Task 1: Lotes, ganhos e envio externo na API

**Files:**
- Create: `api/src/acoes/pagamentos.ts`, `api/test/pagamentos.test.ts`
- Modify:
  - `api/src/nucleo/portas.ts`, `api/src/tabelas/esquema.ts`
  - `api/src/nucleo/regras.ts`, `api/src/principal.ts`

**Tabelas:**

```
lotes:        t titulo, t periodoReferencia, t edital, t iniciativa, b incluirZerados, t status, t pagoEm
loteItens:    t loteId, t escalaId, t pessoaId, n valor             id = `${loteId}:${escalaId}`
envioExterno: t eventoId, d enviadoEm, t enviadoPor, j campos
```

**Regras:**

- **`lotes.criar`:**

  | Situação | Código | Mensagem |
  |---|---|---|
  | lista de escalas vazia | `LOTE_VAZIO` | `'Selecione ao menos uma sessão.'` |
  | título em branco | `VALIDACAO` | `'Informe o título do lote.'` |
  | escala que não é elegível | `NAO_ELEGIVEL` | `'Alguma sessão selecionada não pode ser paga.'` |

  Ao criar:
  - o item recebe `valorDaSessao(sessao, config.diariaPadrao)`;
  - a escala recebe o `loteId`;
  - histórico `` `criou lote com ${n} escala(s)` ``.
- **`lotes.retirarItem`, `lotes.marcarPago` e `lotes.cancelar`:**
  - **Recusas:**

    | Situação | Código | Mensagem |
    |---|---|---|
    | lote não está `enviado` | `LOTE_FECHADO` | as do protótipo |
    | data de pagamento fora de `AAAA-MM-DD` | `VALIDACAO` | `'Informe a data do pagamento.'` |
    | cancelamento sem justificativa | `JUSTIFICATIVA` | `'Informe o motivo do cancelamento do lote.'` |

  - **Ao marcar como pago:** notifica as pessoas do lote com `` `Pagamento do ${titulo} realizado.` ``, link `'/ganhos'`.
- **`ganhos.meus`:** `meusGanhos(eu.id, { eventos, sessoes, escalas, lotes, itens }, config.diariaPadrao)`.
- **`externos.registrarEnvio`:**
  - evento inexistente → `NAO_ENCONTRADO`;
  - evento que não é externo → `VALIDACAO`, `'Este evento não tem pagamento externo.'`;
  - grava `envioExterno` e o histórico.

**Testes:**

```ts
it('cria lote só com escalas realizadas de evento interno, com a diária certa', ...)
it('mesma escala em dois lotes é recusada', ...)          // NAO_ELEGIVEL
it('faltou, cancelado e evento externo não entram', ...)
it('retirar item devolve a escala; lote pago não muda; cancelar devolve todas', ...)
it('marcar pago avisa as pessoas no app', ...)
it('presença não pode ser refeita depois do lote', ...)
it('meus ganhos: previsto, enviado e pago', ...)
it('registra envio ao pagador externo; recusa evento interno', ...)
```

- [ ] Write the tests and run them (`npm test -w api -- pagamentos`). Expected: FAIL.
- [ ] Implement, then run `npm test -w api && npm run typecheck`. Expected: PASS.
- [ ] Commit: `feat(api): lotes, ficha, envio externo e meus ganhos`.

### Task 2: Aba PAGAMENTOS na planilha e app da fase 4

**Files:**
- Create: `api/src/relatorios/pagamentos.ts`
- Modify:
  - `api/src/relatorios/pendentes.ts` (chave `lote:<id>`)
  - `api/src/acoes/pagamentos.ts`
  - `api/test/relatorios.test.ts`
  - `app/src/telas/pagamentos/Fase4.test.tsx`
  - versão `0.4.0`, `.env`, guia (seção 15)

**Aba `PAGAMENTOS – <título>`:**
- **Nome:** o título do lote, com `[]*?:/\` trocados por `-` e cortado em 90 caracteres.
- **Cabeçalho:** `BOLSISTA | QUANTIDADE | VALOR UNITÁRIO | TOTAL`.
  - Uma linha por pessoa, em ordem alfabética.
  - Os valores vêm em reais (`R$ 80,00`).
- **Rodapé:** a linha `TOTAL DO LOTE`, seguida de `SITUAÇÃO: Enviado|Pago em DD/MM/AAAA|Cancelado`.
- **Quando refazer:** `lotes.criar`, `retirarItem`, `marcarPago` e `cancelar` marcam `lote:<id>`.

**Testes:**
- **API:** depois de criar o lote, o gatilho escreve a aba com o total certo e sem CPF.
- **App:** com o `VITE_RECURSOS` da fase 4:
  - o bolsista vê **Ganhos**;
  - o gestor abre Pagamentos e Novo lote sem chamar `almox.listar`, `contratos.listar` ou `infra.listar`.

- [ ] Write the tests and run them. Expected: FAIL.
- [ ] Implement, then run `npm test && npm run typecheck && npm run build -w api`. Expected: PASS.
- [ ] Commit: `feat: aba de pagamentos na planilha e app da fase 4 (versão 0.4.0)`.
