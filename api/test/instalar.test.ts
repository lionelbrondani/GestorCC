import { describe, expect, it } from 'vitest';
import { pastasParaApagar } from '../src/backup';
import { planoInstalacao } from '../src/instalar';

describe('plano de instalação', () => {
  const plano = planoInstalacao();
  const abasDe = (p: string) => plano.find((x) => x.planilha === p)!.abas.map((a) => a.nome);

  it('dados sigilosos só na planilha Sigiloso, com a aba de importação', () => {
    expect(abasDe('sigiloso')).toEqual(['dadosPessoais', 'credenciais', 'IMPORTAR_PESSOAS']);
    expect(abasDe('dados')).not.toContain('credenciais');
    expect(abasDe('dados')).not.toContain('dadosPessoais');
    expect(abasDe('dados')).toEqual(expect.arrayContaining(['pessoas', 'permissoes', 'avisos', 'historico', 'config', 'feriados']));
  });

  it('toda tabela começa pela coluna id', () => {
    for (const p of plano) for (const a of p.abas) if (a.nome !== 'IMPORTAR_PESSOAS' && a.nome !== 'LEIA-ME') expect(a.cabecalhos[0]).toBe('id');
  });

  it('a aba de importação tem os cabeçalhos combinados', () => {
    const imp = plano.find((x) => x.planilha === 'sigiloso')!.abas.find((a) => a.nome === 'IMPORTAR_PESSOAS')!;
    expect(imp.cabecalhos).toEqual(['NOME', 'EMAIL', 'MATRICULA', 'TIPO', 'VINCULO', 'CPF', 'BANCO', 'AGENCIA', 'CONTA', 'CAMISETA', 'NASCIMENTO']);
  });

  it('três arquivos com nomes claros', () => {
    expect(plano.map((p) => p.nomeArquivo)).toEqual(['GestorCC - Dados', 'GestorCC - Sigiloso', 'GestorCC - Relatórios']);
  });
});

describe('backup', () => {
  it('apaga só as pastas com mais de 30 dias e ignora nomes fora do padrão', () => {
    const pastas = [{ nome: '2026-09-20' }, { nome: '2026-09-25' }, { nome: '2026-10-20' }, { nome: 'outra coisa' }];
    expect(pastasParaApagar(pastas, '2026-10-24', 30)).toEqual(['2026-09-20']);
  });
});
