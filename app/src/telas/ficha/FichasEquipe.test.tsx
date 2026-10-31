import { fichaVazia, type FichaTecnicaDados } from '@shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { criarMockCliente } from '../../api/mock/mockCliente';
import { CONTAS, renderizar } from '../../teste/renderizar';

/** O produtor do Concerto de Natal (e19) envia a ficha; o evento e20 fica só com o link (rascunho). */
async function prepararFichas() {
  const api = criarMockCliente({ latenciaMs: 0, persistir: false });
  const { token } = await api.chamar('auth.entrar', CONTAS.gestor);
  api.definirToken(token);
  const f = await api.chamar('fichas.link', { eventoId: 'e19', novo: true });
  await api.chamar('fichas.link', { eventoId: 'e20', novo: true });
  const aberta = await api.chamar('ficha.abrir', { token: f.token });
  const sessaoId = aberta.evento.sessoes[0].id;
  const dados: FichaTecnicaDados = {
    ...fichaVazia([{ id: sessaoId, data: '2026-12-12' }]),
    tipo: 'Música', publico: 600, elenco: 40, montagem: '2026-12-12T09:00', desmontagem: '2026-12-12T23:30',
    sessoes: [{ sessaoId, portas: '19:30', inicio: '20:00', fim: '22:00', intervalo: false, intervaloInicio: '', intervaloFim: '' }],
    responsavel: { vinculo: 'Contratante', vinculoOutro: '', nome: 'Produtora Teste', documento: '000.000.000-00', siapeMatricula: '', email: 'produtora@exemplo.com', telefone: '00 99999-0000' },
    descricaoMontagem: 'Só o palco, com painel de LED.', locais: ['Palco'], sessaoFotos: false, leituraIngressos: false, ingressoSolidario: false,
    reservarPoltronas: false, coffeeBreak: false, aceiteRegulamento: true,
  };
  await api.chamar('ficha.salvar', { token: f.token, dados, enviar: true });
}

describe('fichas dos eventos (panorama da equipe)', () => {
  it('o bolsista acha no menu, vê só as fichas enviadas e abre o resumo sem o contato do responsável', async () => {
    await prepararFichas();
    await renderizar({ pessoa: 'bolsista', rota: '/' });
    const u = userEvent.setup();
    await u.click((await screen.findAllByRole('link', { name: /Fichas dos eventos/ }))[0]);

    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByRole('link', { name: 'Concerto de Natal' })).toBeInTheDocument();
    expect(within(tabela).getByText(/600 de público/)).toBeInTheDocument();
    expect(within(tabela).getAllByRole('row')).toHaveLength(2); // cabeçalho + a ficha enviada; o rascunho não aparece

    await u.click(within(tabela).getByRole('link', { name: 'Concerto de Natal' }));
    expect(await screen.findByText('Só o palco, com painel de LED.')).toBeInTheDocument();
    expect(screen.getByText('Produtora Teste')).toBeInTheDocument();
    expect(screen.queryByText('CPF ou CNPJ')).not.toBeInTheDocument();
    expect(screen.queryByText('produtora@exemplo.com')).not.toBeInTheDocument();
    expect(screen.queryByText('00 99999-0000')).not.toBeInTheDocument();
  });

  it('ficha ainda não enviada não abre', async () => {
    await prepararFichas();
    await renderizar({ pessoa: 'bolsista', rota: '/fichas-eventos/e20' });
    expect(await screen.findByText('Ficha ainda não enviada')).toBeInTheDocument();
  });
});
