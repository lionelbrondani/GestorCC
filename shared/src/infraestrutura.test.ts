import { describe, expect, it } from 'vitest';
import { chamadosAtrasados, diasEmAberto, proximosStatus, validarTransicao } from './infraestrutura';
import type { Ocorrencia } from './tipos';

function ocorrencia(parcial: Partial<Ocorrencia> = {}): Ocorrencia {
  return {
    id: 'o1', numero: 1, titulo: 'Torneira pingando', descricao: '', categoria: 'Hidráulica', local: 'Banheiro do hall', prioridade: 'media',
    status: 'nova', origem: 'app', relatorNome: 'Fulano', criadaEm: '2026-10-10T10:00', foto: null, chamadoNumero: '', chamadoLink: '',
    chamadoAbertoEm: null, resolvidaEm: null, historico: [], ...parcial,
  };
}

describe('fluxo das ocorrências', () => {
  it('próximos status a partir de cada etapa', () => {
    expect(proximosStatus('nova')).toEqual(['analise', 'naoProcede']);
    expect(proximosStatus('analise')).toEqual(['chamado', 'atendimento', 'resolvida', 'naoProcede']);
    expect(proximosStatus('chamado')).toEqual(['atendimento', 'resolvida']);
    expect(proximosStatus('resolvida')).toEqual([]);
  });

  it('abrir chamado exige o número do chamado da UFSM', () => {
    expect(validarTransicao(ocorrencia({ status: 'analise' }), 'chamado', { chamadoNumero: ' ', observacao: '' })).toBe(
      'Informe o número do chamado aberto no sistema da UFSM.',
    );
    expect(validarTransicao(ocorrencia({ status: 'analise' }), 'chamado', { chamadoNumero: '2026/1234', observacao: '' })).toBeNull();
  });

  it('"não procede" exige observação', () => {
    expect(validarTransicao(ocorrencia(), 'naoProcede', { observacao: '' })).toBe('Explique por que a ocorrência não procede.');
  });

  it('transição fora do fluxo é recusada', () => {
    expect(validarTransicao(ocorrencia({ status: 'nova' }), 'resolvida', { observacao: 'ok' })).toBe('Mudança de situação não permitida.');
  });
});

describe('prazos', () => {
  it('dias em aberto contam até hoje ou até a resolução', () => {
    expect(diasEmAberto(ocorrencia({ criadaEm: '2026-10-10T10:00' }), '2026-10-24')).toBe(14);
    expect(diasEmAberto(ocorrencia({ criadaEm: '2026-10-10T10:00', status: 'resolvida', resolvidaEm: '2026-10-12T09:00' }), '2026-10-24')).toBe(2);
  });

  it('chamados abertos há mais do limite são atrasados', () => {
    const lista = [
      ocorrencia({ id: 'a', status: 'chamado', chamadoAbertoEm: '2026-10-10T10:00' }),
      ocorrencia({ id: 'b', status: 'chamado', chamadoAbertoEm: '2026-10-20T10:00' }),
      ocorrencia({ id: 'c', status: 'resolvida', chamadoAbertoEm: '2026-10-01T10:00' }),
    ];
    expect(chamadosAtrasados(lista, '2026-10-24', 7).map((o) => o.id)).toEqual(['a']);
  });
});
