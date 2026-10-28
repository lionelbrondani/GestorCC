# GestorCC

Sistema de gestão do Centro de Convenções da UFSM: agenda, escalas dos bolsistas, pagamentos, contratos, fichas técnicas, cortesias, almoxarifado e prédio num lugar só. Desenvolvido por Lionel Brondani, bolsista do setor, de forma gratuita e sem visar benefícios próprios.

- **Site:** <https://gestorcc-ae6f8.web.app> (com login; o manual de uso fica no menu).
- **Custo:** zero. Firebase Hosting no plano gratuito, e Apps Script, Planilhas, Drive e Agenda da conta Google do setor.

## Como está organizado

| Pasta | O que tem |
|---|---|
| `app/` | O site, em React + Vite, publicado no Firebase Hosting |
| `api/` | A API, em TypeScript, empacotada num único `Code.js` para o Apps Script; guarda os dados em planilhas Google |
| `shared/` | Regras e tipos usados pelos dois lados (escalas, pagamentos, contratos, ficha técnica…) |
| `docs/` | Guia de passagem, implantação versão a versão, manual de uso e especificação |

Os dados nunca ficam neste repositório: ficam nas planilhas da conta Google do setor. A pasta `referencias/` (material com dados reais) e os arquivos `.env` ficam fora do git.

## Rodar no computador

```
npm install
npm test        # testes de shared, api e app
npm run dev     # site no modo protótipo, com dados fictícios
```

Sem `VITE_API_URL`, o site roda como protótipo, com dados fictícios na memória do navegador. Contas do protótipo: `gestor@ufsm.br` (senha `1000000001`) e `bolsista@acad.ufsm.br` (senha `2026000001`).

## Publicar

Primeiro a API, depois o site. O passo a passo está no [guia de passagem](docs/guia-de-passagem.md) (seção 6), e o que cada versão pediu na publicação está em [docs/implantacao.md](docs/implantacao.md).

## Contato

Lionel Brondani: lionel.brondani@acad.ufsm.br. Sugestões e erros também podem virar uma *issue* aqui no GitHub.
