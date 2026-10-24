import { MODELOS, type Pessoa } from '@shared';
import { itensVisiveis } from './menu';

function pessoa(modelo: keyof typeof MODELOS, tipo: Pessoa['tipo'] = 'bolsista'): Pessoa {
  return {
    id: 'p', nome: 'Teste', nomeCurto: 'TESTE', emailAcademico: 't@acad.ufsm.br', matricula: '202600000',
    tipo, vinculo: 'eventual', experiente: false, escalarMenos: false, ativo: true, permissoes: MODELOS[modelo],
  };
}

describe('itensVisiveis', () => {
  it('bolsista eventual não vê itens de gestão', () => {
    expect(itensVisiveis(pessoa('eventual')).gestao).toEqual([]);
  });

  it('operação não vê pagamentos, contratos, pessoas nem configurações', () => {
    const rotulos = itensVisiveis(pessoa('operacao')).gestao.map((i) => i.rotulo);
    expect(rotulos).toContain('Escalas');
    for (const proibido of ['Pagamentos', 'Contratos', 'Pessoas', 'Configurações']) expect(rotulos).not.toContain(proibido);
  });

  it('servidor não tem "Ganhos", bolsista tem', () => {
    expect(itensVisiveis(pessoa('gestor', 'servidor')).pessoais.map((i) => i.rotulo)).not.toContain('Ganhos');
    expect(itensVisiveis(pessoa('eventual')).pessoais.map((i) => i.rotulo)).toContain('Ganhos');
  });
});
