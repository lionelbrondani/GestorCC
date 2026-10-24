import { MODELOS, type Pessoa } from '@shared';
import { describe, expect, it } from 'vitest';
import { prepararImportacao } from '../src/importarPessoas';

const existente: Pessoa = {
  id: 'p02', nome: 'Pessoa Existente', nomeCurto: 'PESSOA', emailAcademico: 'existente@acad.ufsm.br', matricula: '202600002',
  tipo: 'bolsista', vinculo: 'eventual', experiente: false, escalarMenos: false, ativo: true, permissoes: MODELOS.eventual,
};

describe('prepararImportacao', () => {
  it('separa novas, atualizações e problemas com o número da linha', () => {
    const r = prepararImportacao(
      [
        { NOME: ' Ana Fictícia ', EMAIL: 'ana.ficticia@acad.ufsm.br', MATRICULA: 202600011, CPF: '12345678909', BANCO: 'Banco X', AGENCIA: '0001', CONTA: '11-1', CAMISETA: 'M' },
        { NOME: 'Pessoa Existente', MATRICULA: '202600002', CPF: '', BANCO: 'Banco Y', AGENCIA: '0002', CONTA: '22-2' },
        { NOME: 'Linha Ruim', EMAIL: 'ruim@acad.ufsm.br', MATRICULA: '2.02520732E8', CPF: '123.456.789-00' },
      ],
      [existente],
    );
    expect(r.novas).toHaveLength(1);
    expect(r.novas[0].pessoa).toMatchObject({ nome: 'Ana Fictícia', nomeCurto: 'ANA', matricula: '202600011', tipo: 'bolsista', vinculo: 'eventual', ativo: true });
    expect(r.novas[0].dados.cpf).toBe('123.456.789-09');
    expect(r.atualizacoes).toEqual([{ pessoaId: 'p02', dados: { cpf: '', banco: 'Banco Y', agencia: '0002', conta: '22-2', camiseta: '', nascimento: '' } }]);
    expect(r.problemas.map((p) => p.linha)).toEqual([4, 4]);
    expect(r.problemas.map((p) => p.mensagem).join(' ')).toMatch(/Matrícula ilegível/);
  });

  it('nome em branco vira problema; cabeçalhos com espaços e minúsculas são aceitos', () => {
    const r = prepararImportacao([{ ' nome ': '', email: 'x@acad.ufsm.br', matricula: '202600012' }], []);
    expect(r.novas).toHaveLength(0);
    expect(r.problemas).toEqual([{ linha: 2, mensagem: 'Nome em branco.' }]);
  });
});
