import { fireEvent, screen, within } from '@testing-library/react';
import { criarMockCliente } from '../../api/mock/mockCliente';
import { CONTAS, renderizar } from '../../teste/renderizar';

async function destino(quantidade = 3, nome = 'Casa do Estudante', eventoId = 'e20') {
  const api = criarMockCliente({ latenciaMs: 0, persistir: false });
  api.definirToken((await api.chamar('auth.entrar', CONTAS.gestor)).token);
  const d = await api.chamar('cortesias.salvarDestino', { id: '', eventoId, nome, quantidade, pedirMatricula: true });
  return { api, d };
}

describe('cortesias pelo link do destino', () => {
  it('mostra quantas cortesias recebeu e salva nome por nome', async () => {
    const { d } = await destino();
    await renderizar({ pessoa: null, rota: `/cortesias/${d.token}` });
    expect(await screen.findByText(/Você recebeu/)).toHaveTextContent('Você recebeu 3 cortesias para distribuir à Casa do Estudante');
    expect(screen.getByText('0 de 3')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nome 1'), { target: { value: 'Ana Souza' } });
    fireEvent.change(screen.getByLabelText('Matrícula 1'), { target: { value: '202600001' } });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar pessoa/ }));
    fireEvent.change(screen.getByLabelText('Nome 2'), { target: { value: 'Bia Lima' } });
    fireEvent.change(screen.getByLabelText('Matrícula 2'), { target: { value: '202600002' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar lista' }));
    expect(await screen.findByText(/Lista salva/)).toBeInTheDocument();
    expect(screen.getByText('2 de 3')).toBeInTheDocument();
  });

  it('não salva sem a matrícula e não passa da quantidade', async () => {
    const { d } = await destino(1);
    await renderizar({ pessoa: null, rota: `/cortesias/${d.token}` });
    fireEvent.change(await screen.findByLabelText('Nome 1'), { target: { value: 'Ana Souza' } });
    expect(screen.queryByRole('button', { name: /Adicionar pessoa/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar lista' }));
    expect(await screen.findByText('Informe a matrícula.')).toBeInTheDocument();
    expect(screen.queryByText(/Lista salva/)).not.toBeInTheDocument();
  });
});

describe('cortesias na tela do evento', () => {
  it('o gestor cria um destino e ganha o link', async () => {
    await renderizar({ rota: '/agenda/e20' });
    const cartao = (await screen.findByRole('heading', { name: 'Cortesias' })).closest('section')!;
    fireEvent.click(within(cartao).getByRole('button', { name: /Novo destino/ }));
    fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'CEU II' } });
    fireEvent.change(screen.getByLabelText('Quantidade'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar destino' }));
    const linha = (await within(cartao).findByText('CEU II')).closest('tr')!;
    expect(within(linha).getByText('0 de 20')).toBeInTheDocument();
    expect(within(linha).getByRole('button', { name: /Copiar mensagem/ })).toBeInTheDocument();
    expect(within(cartao).getByRole('link', { name: /Imprimir lista/ })).toHaveAttribute('href', '/agenda/e20/cortesias');
  });

  it('a impressão junta todos os destinos em ordem alfabética', async () => {
    // outro evento: os destinos do protótipo ficam em memória entre os testes
    const { api, d } = await destino(5, 'Casa do Estudante', 'e19');
    const outro = await api.chamar('cortesias.salvarDestino', { id: '', eventoId: 'e19', nome: 'PRE', quantidade: 2, pedirMatricula: false });
    await api.chamar('cortesias.salvarPessoas', { id: d.id, pessoas: [{ nome: 'Carla Dias', matricula: '3' }, { nome: 'Ana Souza', matricula: '1' }] });
    await api.chamar('cortesias.salvarPessoas', { id: outro.id, pessoas: [{ nome: 'Bruno Reis', matricula: '' }] });
    await renderizar({ rota: '/agenda/e19/cortesias' });
    const linhas = (await screen.findAllByRole('row')).slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
    expect(linhas.map((l) => l.slice(0, 4))).toEqual([
      ['1', 'Ana Souza', '1', 'Casa do Estudante'],
      ['2', 'Bruno Reis', '—', 'PRE'],
      ['3', 'Carla Dias', '3', 'Casa do Estudante'],
    ]);
  });
});
