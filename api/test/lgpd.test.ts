import { describe, expect, it } from 'vitest';
import { handlersCortesias } from '../src/acoes/cortesias';
import { handlersFichas } from '../src/acoes/fichas';
import { handlersSistema } from '../src/acoes/sistema';
import { limparDadosPessoais } from '../src/lgpd';
import { criarAmbiente } from './apoio';
import { linhaEvento, linhaSessao } from './fabricasApi';

type Linha = { id: string; [k: string]: unknown };

function ambiente() {
  const amb = criarAmbiente({ handlers: { ...handlersCortesias, ...handlersFichas, ...handlersSistema } });
  // hoje é 24/10/2026: o evento antigo acabou em 01/03, o de junho em 01/06 e o recente em 01/10
  amb.repo.inserir('eventos', linhaEvento('antigo'));
  amb.repo.inserir('eventos', linhaEvento('junho'));
  amb.repo.inserir('eventos', linhaEvento('recente'));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's1', eventoId: 'antigo', data: '2026-03-01' }));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's2', eventoId: 'junho', data: '2026-06-01' }));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's3', eventoId: 'recente', data: '2026-10-01' }));
  for (const [id, eventoId] of [['d-junho', 'junho'], ['d-recente', 'recente']]) {
    amb.repo.inserir('cortesiasDestinos', { id, eventoId, nome: 'Casa do Estudante', quantidade: 30, pedirMatricula: true, trava: 'auto', atualizadoPeloDestinoEm: '' } as never);
    amb.repo.inserir('cortesiasSigilo', { id, token: `tok-${id}-0123456789abcdef`, pessoas: [{ nome: 'Ana', matricula: '1' }, { nome: 'Bia', matricula: '2' }, { nome: 'Caio', matricula: '3' }] } as never);
  }
  for (const id of ['antigo', 'junho']) {
    amb.repo.inserir('fichas', { id, status: 'enviada', trava: 'auto', enviadaEm: '', agenda: null, dados: { responsavel: { vinculo: 'externo', nome: 'Pessoa Teste', documento: '', siapeMatricula: '123456', email: '', telefone: '' } } } as never);
    amb.repo.inserir('fichasSigilo', { id, token: `tok-${id}-0123456789abcdef`, documento: '000.000.000-00', email: 'p@exemplo.com', telefone: '(55) 0000-0000' } as never);
  }
  const ctx = { portas: amb.portas, eu: null, idRequisicao: '' };
  const linha = (tabela: 'cortesiasDestinos' | 'cortesiasSigilo' | 'fichas' | 'fichasSigilo', id: string) => amb.repo.listar<Linha>(tabela).find((l) => l.id === id)!;
  return { ...amb, ctx, linha };
}

describe('LGPD: limpeza dos dados pessoais depois do evento', () => {
  it('apaga os nomes das cortesias 90 dias depois do evento, mantendo quantos foram distribuídos', () => {
    const amb = ambiente();
    expect(limparDadosPessoais(amb.ctx)).toEqual({ cortesias: 1, fichas: 1 });
    expect(amb.linha('cortesiasSigilo', 'd-junho').pessoas).toEqual([]);
    expect(amb.linha('cortesiasDestinos', 'd-junho')).toMatchObject({ apagadoEm: '2026-10-24', nomesApagados: 3, trava: 'travada' });
    expect(amb.linha('cortesiasSigilo', 'd-recente').pessoas).toHaveLength(3);
    const resumo = amb.chamar('cortesias.resumo', { eventoIds: ['junho'] }, { token: amb.token('p01') });
    expect(resumo).toEqual({ ok: true, dados: [{ eventoId: 'junho', destinos: [{ nome: 'Casa do Estudante', quantidade: 30, lancados: 3 }] }] });
  });

  it('apaga documento, matrícula, e-mail e telefone do responsável 180 dias depois; o nome fica', () => {
    const amb = ambiente();
    limparDadosPessoais(amb.ctx);
    expect(amb.linha('fichasSigilo', 'antigo')).toMatchObject({ documento: '', email: '', telefone: '', token: 'tok-antigo-0123456789abcdef' });
    expect(amb.linha('fichas', 'antigo')).toMatchObject({ dadosApagadosEm: '2026-10-24', dados: { responsavel: { nome: 'Pessoa Teste', siapeMatricula: '' } } });
    expect(amb.linha('fichasSigilo', 'junho')).toMatchObject({ documento: '000.000.000-00' });
  });

  it('registra no histórico uma vez só, e prazo 0 nunca apaga', () => {
    const amb = ambiente();
    limparDadosPessoais(amb.ctx);
    expect(limparDadosPessoais(amb.ctx)).toEqual({ cortesias: 0, fichas: 0 });
    expect(amb.repo.listar<{ id: string; acao: string }>('historico').map((h) => h.acao)).toEqual([
      'apagou os nomes das cortesias (LGPD, 90 dias depois do evento)',
      'apagou os dados pessoais do responsável (LGPD, 180 dias depois do evento)',
    ]);

    const outro = ambiente();
    outro.repo.inserir('config', { id: 'geral', valor: { diasGuardarCortesias: 0, diasGuardarFicha: 0 } } as never);
    expect(limparDadosPessoais(outro.ctx)).toEqual({ cortesias: 0, fichas: 0 });
  });

  it('as páginas públicas recebem o prazo de cada uma, para o aviso de privacidade', () => {
    const amb = ambiente();
    expect(amb.chamar('cortesia.abrir', { token: 'tok-d-recente-0123456789abcdef' })).toMatchObject({ ok: true, dados: { diasGuardarDados: 90 } });
    expect(amb.chamar('ficha.abrir', { token: 'tok-junho-0123456789abcdef' })).toMatchObject({ ok: true, dados: { diasGuardarDados: 180 } });
  });
});
