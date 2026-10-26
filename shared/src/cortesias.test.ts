import { describe, expect, it } from 'vitest';
import { errosCortesias, limparPessoas, prazoCortesias } from './cortesias';

describe('cortesias: lista de quem recebe', () => {
  it('limpa: corta espaços e textos longos, descarta linhas vazias e o que passa da quantidade', () => {
    const bruto = [{ nome: ' Ana Souza ', matricula: ' 202600001 ' }, { nome: '', matricula: '' }, { nome: 'x'.repeat(200), matricula: '1' }, { nome: 'Sobra', matricula: '2' }, 'lixo'];
    expect(limparPessoas(bruto, 2)).toEqual([
      { nome: 'Ana Souza', matricula: '202600001' },
      { nome: 'x'.repeat(120), matricula: '1' },
    ]);
    expect(limparPessoas(null, 5)).toEqual([]);
  });

  it('cada pessoa precisa de nome; a matrícula só quando o destino pede', () => {
    const pessoas = [{ nome: 'Ana', matricula: '' }, { nome: '', matricula: '123' }];
    expect(errosCortesias(pessoas, true)).toEqual([
      { indice: 0, campo: 'matricula', mensagem: 'Informe a matrícula.' },
      { indice: 1, campo: 'nome', mensagem: 'Informe o nome.' },
    ]);
    expect(errosCortesias(pessoas, false)).toEqual([{ indice: 1, campo: 'nome', mensagem: 'Informe o nome.' }]);
  });

  it('a mesma matrícula não recebe duas vezes', () => {
    expect(errosCortesias([{ nome: 'Ana', matricula: '123' }, { nome: 'Bia', matricula: '124' }], true)).toEqual([]);
    expect(errosCortesias([{ nome: 'Ana', matricula: '123' }, { nome: 'Ana S.', matricula: '0123 ' }], true)).toHaveLength(1);
    expect(errosCortesias([{ nome: 'Ana', matricula: '123' }, { nome: 'Ana S.', matricula: '123' }], true)).toEqual([
      { indice: 1, campo: 'matricula', mensagem: 'Esta matrícula já está na lista.' },
    ]);
  });

  it('o prazo é o dia anterior à primeira sessão', () => {
    expect(prazoCortesias(['2026-12-13', '2026-12-12'])).toBe('2026-12-11');
    expect(prazoCortesias([])).toBe('');
  });
});
