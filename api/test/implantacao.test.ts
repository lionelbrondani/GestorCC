import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const projeto = fileURLToPath(new URL('../../', import.meta.url));
const ler = (caminho: string) => readFileSync(`${projeto}${caminho}`, 'utf8');

describe('roteiro de publicação', () => {
  it('o passo a passo cita instalação, importação, variáveis e regras de compartilhamento', () => {
    const doc = ler('docs/implantacao.md');
    for (const termo of ['instalar', 'IMPORTAR_PESSOAS', 'VITE_API_URL', 'VITE_RECURSOS', 'leitor', 'Sigiloso']) {
      expect(doc, termo).toContain(termo);
    }
  });

  it('o passo a passo da fase 2 cobre a agenda do setor e liga a Agenda no app', () => {
    const doc = ler('docs/implantacao.md');
    for (const termo of ['Centro de Convenções UFSM', 'URL_APP', 'VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos', 'VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais', 'VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais,pagamentos', 'VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais,pagamentos,almoxEstoque,almoxSaidas,infraestrutura,relatar', 'FORMULARIO_INFRA_ID', 'IMPORTAR_ALMOX']) {
      expect(doc, termo).toContain(termo);
    }
    expect(ler('app/.env.exemplo')).toContain('VITE_RECURSOS=pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais,pagamentos,almoxEstoque,almoxSaidas,infraestrutura,relatar');
  });

  it('o site é uma SPA: toda rota cai no index.html, que nunca fica em cache', () => {
    const config = JSON.parse(ler('firebase.json'));
    const sites = config.hosting as Array<{ target: string; public: string; rewrites: unknown[]; headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> }>;
    expect(sites.map((s) => s.target).sort()).toEqual(['producao', 'teste']);
    for (const site of sites) {
      expect(site.public).toBe('app/dist');
      expect(site.rewrites).toContainEqual({ source: '**', destination: '/index.html' });
      const index = site.headers.find((h) => h.source === '/index.html');
      expect(index?.headers).toContainEqual({ key: 'Cache-Control', value: 'no-cache' });
    }
  });

  it('há exemplos de configuração, e os arquivos reais ficam fora do git', () => {
    expect(existsSync(`${projeto}.firebaserc.exemplo`)).toBe(true);
    expect(ler('app/.env.exemplo')).toContain('VITE_API_URL=');
    const ignorados = ler('.gitignore');
    expect(ignorados).toContain('.firebaserc');
    expect(ignorados).toContain('!.env.exemplo');
  });
});
