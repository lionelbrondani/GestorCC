import { elegiveisParaLote, ErroApi } from '@shared';
import { criarMockCliente } from './mockCliente';

const GESTOR = { email: 'gestor@ufsm.br', senha: '1000000001' };
const BOLSISTA = { email: 'bolsista@acad.ufsm.br', senha: '2026000001' };

async function entrarComo(conta: { email: string; senha: string }) {
  const api = criarMockCliente({ latenciaMs: 0, persistir: false });
  const r = await api.chamar('auth.entrar', conta);
  api.definirToken(r.token);
  return { api, ...r };
}

describe('cliente simulado', () => {
  it('recusa senha errada', async () => {
    const api = criarMockCliente({ latenciaMs: 0, persistir: false });
    await expect(api.chamar('auth.entrar', { email: GESTOR.email, senha: 'x' })).rejects.toMatchObject({ codigo: 'CREDENCIAIS' });
  });

  it('bolsista entra com a matrícula e ainda usa senha inicial', async () => {
    const { senhaInicial, pessoa } = await entrarComo(BOLSISTA);
    expect(senhaInicial).toBe(true);
    expect(pessoa.emailAcademico).toBe(BOLSISTA.email);
  });

  it('bolsista não acessa lotes', async () => {
    const { api } = await entrarComo(BOLSISTA);
    await expect(api.chamar('lotes.listar', null)).rejects.toBeInstanceOf(ErroApi);
    await expect(api.chamar('lotes.listar', null)).rejects.toMatchObject({ codigo: 'SEM_PERMISSAO' });
  });

  it('troca exige justificativa e fica no histórico', async () => {
    const { api } = await entrarComo(GESTOR);
    const escalas = await api.chamar('escalas.listar', { de: '2026-11-01', ate: '2026-11-30' });
    const alvo = escalas.find((e) => e.status === 'publicado' && e.papel === 'bolsista')!;
    await expect(
      api.chamar('escalas.trocar', { sessaoId: alvo.sessaoId, sai: alvo.pessoaId, entra: null, justificativa: '  ' }),
    ).rejects.toMatchObject({ codigo: 'JUSTIFICATIVA' });
    await api.chamar('escalas.trocar', { sessaoId: alvo.sessaoId, sai: alvo.pessoaId, entra: null, justificativa: 'Pediu para sair' });
    const hist = await api.chamar('historico.listar', { entidade: 'sessao', entidadeId: alvo.sessaoId });
    expect(hist.some((h) => h.justificativa === 'Pediu para sair')).toBe(true);
  });

  it('retirada acima do saldo é recusada sem alterar o estoque', async () => {
    const { api } = await entrarComo(GESTOR);
    const { itens } = await api.chamar('almox.listar', null);
    const item = itens.find((i) => i.status === 'Ativo')!;
    await expect(
      api.chamar('almox.retirar', { itens: [{ cod: item.cod, qtd: item.saldo + 1 }], finalidade: 'Teste' }),
    ).rejects.toMatchObject({ codigo: 'ESTOQUE' });
    const depois = await api.chamar('almox.listar', null);
    expect(depois.itens.find((i) => i.cod === item.cod)!.saldo).toBe(item.saldo);
  });

  it('cancelar sessão cancela as escalas e tira do pagamento', async () => {
    const { api } = await entrarComo(GESTOR);
    const de = '2026-10-01';
    const ate = '2026-10-31';
    const escalas = await api.chamar('escalas.listar', { de, ate });
    const realizada = escalas.find((e) => e.status === 'realizado' && !e.loteId)!;
    await api.chamar('sessoes.cancelar', { sessaoId: realizada.sessaoId, justificativa: 'Cancelado pela produção' });

    const depois = await api.chamar('escalas.listar', { de, ate });
    const daSessao = depois.filter((e) => e.sessaoId === realizada.sessaoId);
    expect(daSessao.every((e) => e.status === 'cancelado')).toBe(true);

    const { eventos, sessoes } = await api.chamar('eventos.listar', { de, ate });
    const { lotes } = await api.chamar('lotes.listar', null);
    const elegiveis = elegiveisParaLote({ eventos, sessoes, escalas: depois, lotes });
    expect(elegiveis.some((e) => e.sessaoId === realizada.sessaoId)).toBe(false);
  });
});
