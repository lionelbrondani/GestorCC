import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
    expect(codigo).toContain('function recuperarAcessoGestor(');
    expect(codigo).toContain('function aoAlterarPlanilha(');
    expect(codigo).not.toMatch(/^import /m);
    expect(codigo).not.toContain('require(');
  });

  it('copia o manifesto com acesso público ao web app', () => {
    const manifesto = JSON.parse(readFileSync(`${raiz}dist/appsscript.json`, 'utf8'));
    expect(manifesto.webapp.access).toBe('ANYONE_ANONYMOUS');
    expect(manifesto.timeZone).toBe('America/Sao_Paulo');
  });

  it('a agenda do setor usa o serviço avançado de Agenda', () => {
    const manifesto = JSON.parse(readFileSync(`${raiz}dist/appsscript.json`, 'utf8'));
    expect(manifesto.oauthScopes).toContain('https://www.googleapis.com/auth/calendar');
    expect(manifesto.oauthScopes).toContain('https://www.googleapis.com/auth/documents');
    expect(manifesto.dependencies.enabledAdvancedServices).toContainEqual({ userSymbol: 'Calendar', serviceId: 'calendar', version: 'v3' });
  });

  it('lê as abas em lote pelo serviço avançado do Sheets', () => {
    const manifesto = JSON.parse(readFileSync(`${raiz}dist/appsscript.json`, 'utf8'));
    expect(manifesto.dependencies.enabledAdvancedServices).toContainEqual({ userSymbol: 'Sheets', serviceId: 'sheets', version: 'v4' });
  });

  it('e-mail só pelo botão Enviar: só a permissão de enviar, MailApp só no adaptador e a porta só na ação emails.enviar', () => {
    const manifesto = JSON.parse(readFileSync(`${raiz}dist/appsscript.json`, 'utf8'));
    expect(manifesto.oauthScopes.filter((s: string) => /mail/i.test(s))).toEqual(['https://www.googleapis.com/auth/script.send_mail']);
    expect(readFileSync(`${raiz}dist/Code.js`, 'utf8')).not.toMatch(/GmailApp/);
    const fontes = (readdirSync(`${raiz}src`, { recursive: true }) as string[]).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\\/g, '/'));
    const usam = (re: RegExp) => fontes.filter((f) => re.test(readFileSync(`${raiz}src/${f}`, 'utf8')));
    expect(usam(/MailApp/)).toEqual(['adaptadores/gas.ts']);
    expect(usam(/\.email\.(enviar|cotaRestante)\(/)).toEqual(['acoes/emails.ts']);
  });
});
