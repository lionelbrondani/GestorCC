// Empacota a API num único Code.js para o Apps Script.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const raiz = fileURLToPath(new URL('.', import.meta.url));

// O Apps Script só enxerga funções declaradas no topo do arquivo.
const GLOBAIS = ['doPost', 'doGet', 'instalar', 'recuperarAcessoGestor', 'backupDiario', 'gatilhoMinutos'];
const rodape = GLOBAIS.map((f) => `function ${f}(e) { return __gestor.${f}(e); }`).join('\n');

/** Importa arquivos com '?raw' como texto (o manual de uso da busca), como o Vite faz nos testes. */
const textoBruto = {
  name: 'texto-bruto',
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: resolve(a.resolveDir, a.path.replace(/\?raw$/, '')), namespace: 'texto-bruto' }));
    b.onLoad({ filter: /.*/, namespace: 'texto-bruto' }, (a) => ({ contents: readFileSync(a.path, 'utf8'), loader: 'text' }));
  },
};

mkdirSync(`${raiz}dist`, { recursive: true });
await build({
  entryPoints: [`${raiz}src/principal.ts`],
  bundle: true,
  format: 'iife',
  globalName: '__gestor',
  target: 'es2019',
  platform: 'neutral',
  outfile: `${raiz}dist/Code.js`,
  alias: { '@shared': `${raiz}../shared/src` },
  footer: { js: rodape },
  plugins: [textoBruto],
  logLevel: 'warning',
});
copyFileSync(`${raiz}appsscript.json`, `${raiz}dist/appsscript.json`);
