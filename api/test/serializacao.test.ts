import { describe, expect, it } from 'vitest';
import { cabecalhos, ESQUEMA } from '../src/tabelas/esquema';
import { linhaParaObjeto, objetoParaLinha, paraCelula } from '../src/tabelas/serializacao';

describe('esquema', () => {
  it('toda tabela começa com id e tem os carimbos de alteração', () => {
    for (const t of Object.keys(ESQUEMA) as (keyof typeof ESQUEMA)[]) {
      const cab = cabecalhos(t);
      expect(cab[0]).toBe('id');
      expect(cab).toEqual(expect.arrayContaining(['criadoEm', 'atualizadoEm', 'atualizadoPor']));
    }
  });
  it('dados sigilosos ficam só na planilha sigilosa', () => {
    expect(ESQUEMA.dadosPessoais.planilha).toBe('sigiloso');
    expect(ESQUEMA.credenciais.planilha).toBe('sigiloso');
    expect(ESQUEMA.pessoas.planilha).toBe('dados');
  });
});

describe('leitura tolerante', () => {
  const cab = cabecalhos('pessoas');
  const vazia = () => cab.map(() => '' as unknown);
  const linha = (valores: Record<string, unknown>) => {
    const l = vazia();
    for (const [k, v] of Object.entries(valores)) l[cab.indexOf(k)] = v;
    return l;
  };

  it('matrícula digitada como número vira texto sem notação científica', () => {
    const o = linhaParaObjeto('pessoas', cab, linha({ id: 'p1', matricula: 202520732 }));
    expect(o.matricula).toBe('202520732');
  });

  it('booleanos em português, inglês e vazios', () => {
    expect(linhaParaObjeto('pessoas', cab, linha({ id: 'p1', ativo: 'VERDADEIRO' })).ativo).toBe(true);
    expect(linhaParaObjeto('pessoas', cab, linha({ id: 'p1', ativo: 'TRUE' })).ativo).toBe(true);
    expect(linhaParaObjeto('pessoas', cab, linha({ id: 'p1', ativo: true })).ativo).toBe(true);
    expect(linhaParaObjeto('pessoas', cab, linha({ id: 'p1', ativo: '' })).ativo).toBe(false);
  });

  it('célula vazia de texto vira string vazia', () => {
    expect(linhaParaObjeto('pessoas', cab, linha({ id: 'p1' })).emailAlternativo).toBe('');
  });

  it('colunas em outra ordem ainda são lidas pelo nome', () => {
    const embaralhado = [...cab].reverse();
    const l = embaralhado.map((c) => (c === 'id' ? 'p9' : c === 'nome' ? 'Pessoa Teste' : ''));
    const o = linhaParaObjeto('pessoas', embaralhado, l);
    expect(o.id).toBe('p9');
    expect(o.nome).toBe('Pessoa Teste');
  });

  it('data do Sheets vira texto AAAA-MM-DDTHH:MM', () => {
    const c = cabecalhos('notificacoes');
    const l = c.map((x) => (x === 'id' ? 'n1' : x === 'criadoEm' ? new Date(2026, 9, 24, 14, 5) : ''));
    expect(linhaParaObjeto('notificacoes', c, l).criadoEm).toBe('2026-10-24T14:05');
  });

  it('json inválido vira null', () => {
    const c = cabecalhos('avisos');
    const l = c.map((x) => (x === 'id' ? 'a1' : x === 'pessoasIds' ? '[quebrado' : ''));
    expect(linhaParaObjeto('avisos', c, l).pessoasIds).toBeNull();
  });

  it('ida e volta preserva o objeto', () => {
    const c = cabecalhos('avisos');
    const aviso = {
      id: 'a1', titulo: 'Reunião', texto: 'Sala 308', publico: 'pessoas', pessoasIds: ['p1', 'p2'], fixado: true, validoAte: '2026-11-01',
      pedeConfirmacao: false, autorId: 'p1', criadoEm: '2026-10-24T10:00', atualizadoEm: '2026-10-24T10:00', atualizadoPor: 'p1',
    };
    expect(linhaParaObjeto('avisos', c, objetoParaLinha('avisos', c, aviso))).toEqual(aviso);
  });
});

describe('gravação na planilha', () => {
  it('texto vai com apóstrofo, para o Sheets não transformar em fórmula, número ou data', () => {
    expect(paraCelula('+abc/def==')).toBe("'+abc/def==");
    expect(paraCelula('=SOMA(1)')).toBe("'=SOMA(1)");
    expect(paraCelula('01234567890')).toBe("'01234567890");
    expect(paraCelula('2026-10-24T10:00')).toBe("'2026-10-24T10:00");
  });

  it('número, booleano e célula vazia vão como estão', () => {
    expect(paraCelula(2000)).toBe(2000);
    expect(paraCelula(true)).toBe(true);
    expect(paraCelula('')).toBe('');
  });
});
