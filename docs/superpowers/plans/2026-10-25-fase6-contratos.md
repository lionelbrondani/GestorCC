# GestorCC — Fase 6: Contratos e documentos (versão inicial) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ligar contratos, contratantes, aditivos, a solicitação de faturas à FUNDEP (só texto), os anexos em PDF, a geração de documentos a partir dos modelos e a aba CONTRATOS (spec 9 e 11).

**Architecture:**
- `api/src/acoes/contratos.ts` segue o padrão das fases anteriores.
- **Contratantes** ficam na planilha **Sigiloso** (spec 9.1).
- **Anexos** (PDF assinado e PDF da fatura) ficam na pasta `Contratos/` do Drive, pela porta `arquivos`, generalizada com o parâmetro `pasta`. O app baixa cada anexo como data URL, porque o arquivo não é compartilhado.
- **Documentos:** uma porta nova, `documentos`.
  - Ela copia o modelo, um Google Doc em `GestorCC/Modelos/`, para `Documentos gerados/AAAA/`.
  - Depois troca os `{{CAMPOS}}` e devolve o link do Doc e um .docx para baixar.

**Spec:** `docs/superpowers/specs/2026-10-24-gestorcc-design.md`, seções 9 e 11.

## Global Constraints

- **Permissões:** `contratos: ver` para listar e baixar anexos; `contratos: editar` para salvar, anexar e gerar documentos.
- **Nenhum e-mail.** A FUNDEP recebe só o texto copiado pela pessoa (spec 9.5).
- **Aba CONTRATOS:** mostra só a razão social do contratante, sem CPF, CNPJ, endereço ou contato (spec 9.1).
- `VITE_RECURSOS` da fase 6 = o da fase 5 + `contratos`.

## Review Focus

1. **Número do contrato.** Em branco, a API sugere o próximo `N/AAAA` do ano do evento. Número repetido é recusado com `NUMERO_REPETIDO`. → teste na Task 1.
2. **Aditivo:** o número é sequencial por contrato. Um aditivo novo de contrato cancelado é recusado. → teste na Task 1.
3. **Contratante sem razão social:** recusado, com a mensagem do protótipo. → teste na Task 1.
4. **Modelo ausente na pasta:** a mensagem diz qual arquivo colocar onde. → teste na Task 2.
5. **Anexo que não é PDF:** recusado. → teste na Task 2.

### Task 1: Contratos na API e aba CONTRATOS

**Tabelas:**

```
contratantes (sigiloso): t razaoSocial, t documento, t inscricaoMunicipal, t inscricaoEstadual, t endereco, t cep, t representanteNome, t email, t contatoFaturaNome, t contatoFaturaEmail, t contatoFaturaTelefone
contratos (dados): t numero, t eventoId, t contratanteId, t processoPen, n valorBase, t itemTabela, t vencimento, j areas, n cortesiasQtd, t ingressoSolidario, t statusContrato, t statusFatura, t numeroFatura, t statusEcad, t statusIss, t statusFundep, t statusCortesias, b fichaTecnicaRecebida, t canceladoMotivo, t observacoes, t pdfAssinadoId, t pdfFaturaId
aditivos (dados): t contratoId, n numero, t data, t descricao, n valorDelta, t novaData, t statusFatura, t numeroFatura
```

**Regras:**
- **`contratos.salvar`:**
  - evento e contratante precisam existir (`NAO_ENCONTRADO`);
  - número em branco recebe o próximo `N/AAAA` do ano da primeira sessão do evento;
  - número repetido → `NUMERO_REPETIDO`, `` `Já existe o contrato ${numero}.` ``;
  - status `Cancelado` exige `canceladoMotivo` → `MOTIVO`, `'Informe o motivo do cancelamento.'`;
  - confere a versão (`CONFLITO`) e registra no histórico;
  - marca `contratos`.
- **`contratos.salvarAditivo`:**
  - aditivo novo recebe `numero` = maior número do contrato + 1;
  - contrato cancelado → `CONTRATO_CANCELADO`.
- **`contratantes.salvar`:** razão social em branco → `RAZAO_SOCIAL`, `'Informe a razão social ou o nome do contratante.'`
- **Aba `CONTRATOS`:** `Nº | EVENTO | DATA | CONTRATANTE | VALOR TOTAL | VENCIMENTO | CONTRATO | FATURA | Nº FATURA | ECAD | ISS | FUNDEP | CORTESIAS | FICHA TÉCNICA`, uma linha por contrato, em ordem de número.
- **App:**
  - a nota de "rascunho no Gmail" da tela FUNDEP sai e no lugar entra: "Anexe ao seu e-mail os PDFs assinados (baixe-os em cada contrato)";
  - teste da fase 6: Contratos sem chamar áreas desligadas.

**Testes** (`api/test/contratos.test.ts`):

```ts
it('cria contrato com número sugerido do ano do evento', ...)
it('número repetido é recusado', ...)
it('cancelar exige motivo', ...)
it('aditivo numerado por contrato; contrato cancelado não recebe aditivo', ...)
it('contratante vai para a planilha Sigiloso e exige razão social', ...)
it('bolsista não vê contratos', ...)
it('aba CONTRATOS sem dados pessoais do contratante', ...)
```

- [ ] Write the tests and run them. Expected: FAIL.
- [ ] Implement, then run `npm test && npm run typecheck`. Expected: PASS.
- [ ] Commit: `feat(api): contratos, aditivos e contratantes`.

### Task 2: Anexos em PDF e geração de documentos

**Portas e contrato:**

```ts
// Arquivos ganha a pasta: salvarImagem(dataUrl, nome, pasta = 'Infraestrutura'), lerImagem(id) segue igual
export interface Documentos {
  /** Copia o modelo (Google Doc em GestorCC/Modelos com esse nome), troca os {{CAMPOS}} e devolve o link e o .docx. */
  gerar(modelo: string, campos: Record<string, string>, nomeArquivo: string): { url: string; docx: string };
}
// contrato:
'contratos.anexar': A<{ contratoId: Id; tipo: 'assinado' | 'fatura'; arquivo: string }, Contrato>;
'contratos.anexo': A<{ contratoId: Id; tipo: 'assinado' | 'fatura' }, string | null>;
'documentos.gerar': A<{ contratoId: Id; tipo: 'contrato' | 'termo' | 'piano' }, { url: string; docx: string }>;
// Contrato ganha: pdfAssinado?: boolean; pdfFatura?: boolean
```

**Modelos:**

| `tipo` | Nome do modelo |
|---|---|
| `contrato` | `Modelo - Contrato` |
| `termo` | `Modelo - Termo de autorização` |
| `piano` | `Modelo - Empréstimo do piano` |

Quando o modelo não existe, a porta lança `MODELO`: `` `Coloque o Google Doc "${nome}" na pasta GestorCC/Modelos.` ``

**Campos:** NUMERO, PROCESSO, EVENTO, DATAS, HORARIOS, CONTRATANTE, DOCUMENTO, ENDERECO, CEP, REPRESENTANTE, EMAIL, VALOR, VALOR_EXTENSO (vazio nesta versão), VENCIMENTO, AREAS, CORTESIAS, INGRESSO_SOLIDARIO, OBSERVACOES e HOJE.

**Testes:**
- anexar um PDF guarda o arquivo e marca `pdfAssinado`; o anexo volta para quem tem `contratos: ver`;
- um anexo que não é `data:application/pdf` → `ARQUIVO`, `'Envie o arquivo em PDF.'`;
- `documentos.gerar` chama o modelo certo com os campos preenchidos (porta em memória);
- modelo ausente → `MODELO`.

**App** (`ContratoDetalhe`):
- os botões "Gerar …" chamam `documentos.gerar`;
- o modal mostra "Abrir no Google Docs" e "Baixar .docx";
- um cartão **Anexos** permite enviar e baixar o PDF assinado e o da fatura.

- [ ] Write the tests and run them. Expected: FAIL.
- [ ] Implement, including `documentosGas`:
  - `DriveApp` acha o modelo pelo nome e o copia;
  - `DocumentApp.openById(...).getBody().replaceText('{{CAMPO}}', valor)`;
  - o .docx vem de `UrlFetchApp` em `https://docs.google.com/document/d/${id}/export?format=docx`, com `ScriptApp.getOAuthToken()`;
  - o manifesto ganha o escopo `https://www.googleapis.com/auth/documents`.

  Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] Commit: `feat: anexos dos contratos e documentos gerados dos modelos`.

### Task 3: Publicação da fase 6

- [ ] Versão `0.6.0`, `.env` e seção 17 do guia:
  - colar o manifesto, que pede a permissão de Documentos;
  - rodar `instalar`;
  - criar a pasta `Modelos` com os três Google Docs e a lista de `{{CAMPOS}}`.
- [ ] Run `npm test && npm run typecheck && npm run build -w api`. Expected: PASS.
- [ ] Commit: `chore: fase 6 pronta (versão 0.6.0)`.
