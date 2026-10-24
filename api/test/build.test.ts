import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const raiz = fileURLToPath(new URL('..', import.meta.url));

describe('build para o Apps Script', () => {
  beforeAll(() => {
    execFileSync(process.execPath, ['build.mjs'], { cwd: raiz, stdio: 'pipe' });
  });

  it('gera um único Code.js com as funções globais e sem módulos', () => {
    const arquivo = `${raiz}dist/Code.js`;
    expect(existsSync(arquivo)).toBe(true);
    const codigo = readFileSync(arquivo, 'utf8');
    expect(codigo).toContain('function doPost(');
    expect(codigo).toContain('function instalar(');
    expect(codigo).not.toMatch(/^import /m);
    expect(codigo).not.toContain('require(');
  });

  it('copia o manifesto com acesso público ao web app', () => {
    const manifesto = JSON.parse(readFileSync(`${raiz}dist/appsscript.json`, 'utf8'));
    expect(manifesto.webapp.access).toBe('ANYONE_ANONYMOUS');
    expect(manifesto.timeZone).toBe('America/Sao_Paulo');
  });
});
