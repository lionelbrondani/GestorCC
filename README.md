# GestorCC

Sistema de gestão para um centro de eventos ou teatro: agenda, escalas da equipe, pagamentos, contratos, fichas técnicas, cortesias, pedidos de data, almoxarifado e prédio num lugar só.

- **Custo:** zero. O site fica no Firebase Hosting (plano gratuito); a API, no Apps Script, com os dados em Planilhas, Drive e Agenda de uma conta Google.
- **Dados:** nunca ficam neste repositório. Ficam nas planilhas da conta Google de quem usa o sistema.

## Como está organizado

| Pasta | O que tem |
|---|---|
| `app/` | O site, em React + Vite |
| `api/` | A API, em TypeScript, empacotada num único `Code.js` para o Apps Script |
| `shared/` | Regras e tipos usados pelos dois lados (escalas, pagamentos, contratos, ficha técnica…) |
| `docs/` | Roteiro de implantação versão a versão e manual de uso |

## Rodar no computador

```
npm install
npm test        # testes de shared, api e app
npm run dev     # site no modo protótipo, com dados fictícios
```

Sem `VITE_API_URL`, o site roda como protótipo, com dados fictícios na memória do navegador. Contas do protótipo: `gestor@exemplo.edu.br` (senha `1000000001`) e `bolsista@aluno.exemplo.edu.br` (senha `2026000001`).

## Os dados do seu setor

O repositório traz só um exemplo genérico ("Centro de Eventos"). Para usar com o seu setor, crie a pasta `setor/` na raiz (ela fica fora do git):

- `setor/setor.json`: nome do setor, instituição, e-mail, assinatura dos e-mails, fundação que emite as faturas, lotação, planta das poltronas, textos do assistente e crédito. Os campos e o exemplo estão em [`shared/src/setor.ts`](shared/src/setor.ts); o que faltar no arquivo vale o do exemplo.
- `setor/publico/`: arquivos que substituem os genéricos de `app/public/` no site publicado (`logo.png`, `logo-branco.png`, `logo-escuro.png`, os favicons e ícones, `placas/camarim.jpg`, prints do manual).

Os builds do site e da API leem essa pasta. Nos testes e no protótipo vale sempre o exemplo.

## Publicar

Crie o `app/.env.producao` e o `.firebaserc` a partir dos arquivos `.exemplo`. Primeiro a API (`npm run build -w api` e cole `api/dist/Code.js` no Apps Script), depois o site (`npm run deploy:app:producao`). O que cada versão pediu na publicação está em [docs/implantacao.md](docs/implantacao.md).
