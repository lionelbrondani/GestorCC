// Empacota a API num único Code.js para o Apps Script.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const raiz = fileURLToPath(new URL('.', import.meta.url));

// O Apps Script só enxerga funções declaradas no topo do arquivo.
const GLOBAIS = ['doPost', 'doGet', 'instalar', 'recuperarAcessoGestor', 'backupDiario', 'gatilhoMinutos'];
const rodape = GLOBAIS.map((f) => `function ${f}(e) { return __gestor.${f}(e); }`).join('\n');

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
  logLevel: 'warning',
});
copyFileSync(`${raiz}appsscript.json`, `${raiz}dist/appsscript.json`);
