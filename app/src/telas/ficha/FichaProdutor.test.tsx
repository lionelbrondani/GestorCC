import { fichaVazia, type FichaTecnicaDados } from '@shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { criarMockCliente } from '../../api/mock/mockCliente';
import { CONTAS, renderizar } from '../../teste/renderizar';

/** Gera o link da ficha do evento e19 (Concerto de Natal) como o gestor faria. */
async function prepararLink() {
  const api = criarMockCliente({ latenciaMs: 0, persistir: false });
  const { token } = await api.chamar('auth.entrar', CONTAS.gestor);
  api.definirToken(token);
  const f = await api.chamar('fichas.link', { eventoId: 'e19', novo: true });
  const aberta = await api.chamar('ficha.abrir', { token: f.token });
  return { api, token: f.token, sessaoId: aberta.evento.sessoes[0].id };
}

function completa(sessaoId: string): FichaTecnicaDados {
  return {
    ...fichaVazia([{ id: sessaoId, data: '2026-12-12' }]),
    tipo: 'Música', publico: 600, elenco: 40, montagem: '2026-12-12T09:00', desmontagem: '2026-12-12T23:30',
    sessoes: [{ sessaoId, portas: '19:30', inicio: '20:00', fim: '22:00', intervalo: false, intervaloInicio: '', intervaloFim: '' }],
    responsavel: { vinculo: 'Contratante', vinculoOutro: '', nome: 'Produtora Teste', documento: '000.000.000-00', siapeMatricula: '', email: 'produtora@exemplo.com', telefone: '55 99999-0000' },
    descricaoMontagem: 'Só o palco.', locais: ['Palco'], sessaoFotos: false, leituraIngressos: false, ingressoSolidario: false,
    reservarPoltronas: false, coffeeBreak: false, aceiteRegulamento: true,
  };
}

describe('ficha técnica pelo link do produtor', () => {
  it('abre sem login, não avança com a etapa incompleta e traz os horários do evento', async () => {
    const { token } = await prepararLink();
    await renderizar({ pessoa: null, rota: `/ficha/${token}` });
    expect(await screen.findByRole('heading', { name: 'Concerto de Natal' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'O evento' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Salvar e continuar/ }));
    expect(await screen.findByText('Escolha o tipo do evento.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'O evento' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Tipo do evento' })).getByRole('radio', { name: 'Música' }));
    fireEvent.change(screen.getByLabelText('Estimativa de público'), { target: { value: '600' } });
    fireEvent.change(screen.getByLabelText('Pessoas no elenco'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar e continuar/ }));
    expect(await screen.findByRole('heading', { name: 'Horários' })).toBeInTheDocument();
    expect(screen.getByLabelText('Início')).toHaveValue('20:00');
    expect(screen.getByLabelText('Término')).toHaveValue('22:00');
  });

  it('ficha enviada mostra o resumo e deixa corrigir até o prazo', async () => {
    const { api, token, sessaoId } = await prepararLink();
    await api.chamar('ficha.salvar', { token, dados: completa(sessaoId), enviar: true });
    await renderizar({ pessoa: null, rota: `/ficha/${token}` });
    expect(await screen.findByText(/Ficha enviada em/)).toBeInTheDocument();
    expect(screen.getByText(/até 10\/12\/2026/)).toBeInTheDocument();
    expect(screen.getByText('Produtora Teste')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir a ficha' }));
    expect(await screen.findByRole('heading', { name: 'O evento' })).toBeInTheDocument();
  });

  it('link que não vale mais mostra o aviso', async () => {
    await renderizar({ pessoa: null, rota: '/ficha/link-que-nao-existe' });
    expect(await screen.findByText('Este link não vale mais. Peça um novo ao Centro de Convenções.')).toBeInTheDocument();
  });
});

describe('ficha técnica na tela do evento', () => {
  it('o gestor gera o link e vê o estado da ficha', async () => {
    await renderizar({ rota: '/agenda/e20' });
    fireEvent.click(await screen.findByRole('button', { name: /Gerar link da ficha técnica/ }));
    const link = (await screen.findByLabelText('Link da ficha técnica')) as HTMLInputElement;
    expect(link.value).toMatch(/\/ficha\/ficha-e20-/);
    expect(screen.getByText('Ainda não enviada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Imprimir resumo/ })).toHaveAttribute('href', '/agenda/e20/ficha');
  });

  it('bolsista não vê o cartão da ficha', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/agenda/e20' });
    await screen.findByText(/^Sessões \(/).catch(() => null);
    expect(screen.queryByText('Ficha técnica')).not.toBeInTheDocument();
  });
});

describe('ficha técnica na agenda do CC', () => {
  it('o gestor lança montagem, passagem de som e desmontagem na agenda', async () => {
    const { api, token, sessaoId } = await prepararLink();
    await api.chamar('ficha.salvar', { token, dados: { ...completa(sessaoId), passagemSom: true, passagemInicio: '2026-12-12T16:00', passagemFim: '2026-12-12T17:00' }, enviar: true });
    await renderizar({ rota: '/agenda/e19' });
    fireEvent.click(await screen.findByRole('button', { name: /Lançar montagem e desmontagem na agenda do CC/ }));
    expect(await screen.findByText('Na agenda do CC: montagem, passagem de som, desmontagem.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Atualizar na agenda do CC/ })).toBeInTheDocument();
  });
});
