import { interpretarSimulado } from './interpretarSimulado';

describe('interpretarSimulado', () => {
  it('"quem trabalha sábado?" numa segunda vira a escala do próximo sábado', () => {
    expect(interpretarSimulado('quem trabalha sábado?', '2026-10-26')).toEqual({ nome: 'escalaDoDia', data: '2026-10-31' });
  });
  it('no próprio sábado, "sábado" é hoje', () => {
    expect(interpretarSimulado('quem está escalado sábado?', '2026-10-31')).toEqual({ nome: 'escalaDoDia', data: '2026-10-31' });
  });
  it('saldo de item', () => {
    expect(interpretarSimulado('quanto temos de fita crepe?', '2026-10-24')).toEqual({ nome: 'saldoItem', termo: 'fita crepe' });
  });
  it('outras consultas', () => {
    expect(interpretarSimulado('quais contratos estão com ECAD pendente?', '2026-10-24')).toEqual({ nome: 'contratosPendentes' });
    expect(interpretarSimulado('o que está no estoque crítico?', '2026-10-24')).toEqual({ nome: 'estoqueCritico' });
    expect(interpretarSimulado('quem não respondeu a disponibilidade?', '2026-10-24')).toEqual({ nome: 'naoResponderam' });
    expect(interpretarSimulado('quem trabalha amanhã?', '2026-10-24')).toEqual({ nome: 'escalaDoDia', data: '2026-10-25' });
    expect(interpretarSimulado('quem trabalha 05/12?', '2026-10-24')).toEqual({ nome: 'escalaDoDia', data: '2026-12-05' });
  });
  it('ocorrências de infraestrutura', () => {
    expect(interpretarSimulado('quais vazamentos estão abertos?', '2026-10-24')).toEqual({ nome: 'ocorrenciasAbertas', termo: 'vazamento' });
    expect(interpretarSimulado('tem chamado de infraestrutura atrasado?', '2026-10-24')).toEqual({ nome: 'ocorrenciasAbertas', termo: '' });
  });
  it('perguntas complexas simples viram análise', () => {
    expect(interpretarSimulado('quem mais trabalhou?', '2026-10-24')).toMatchObject({ nome: 'analise', assunto: 'escalas', agrupar: 'pessoa' });
    expect(interpretarSimulado('quantas sessões tivemos por mês?', '2026-10-24')).toMatchObject({ nome: 'analise', assunto: 'sessoes', agrupar: 'mes' });
    expect(interpretarSimulado('quanto foi pago para cada bolsista?', '2026-10-24')).toMatchObject({ nome: 'analise', assunto: 'pagamentos', agrupar: 'pessoa', medida: 'valor' });
  });
  it('sem interpretação', () => {
    expect(interpretarSimulado('bom dia', '2026-10-24')).toBeNull();
  });
});
