import { screen } from '@testing-library/react';
import { criarMockCliente } from '../../api/mock/mockCliente';
import { CONTAS, renderizar } from '../../teste/renderizar';

async function comoGestor() {
  const api = criarMockCliente({ latenciaMs: 0, persistir: false });
  api.definirToken((await api.chamar('auth.entrar', CONTAS.gestor)).token);
  return api;
}

describe('LGPD nas páginas públicas e em Configurações', () => {
  it('a ficha técnica diz para que servem os dados do responsável e quando são apagados', async () => {
    const f = await (await comoGestor()).chamar('fichas.link', { eventoId: 'e19', novo: true });
    await renderizar({ pessoa: null, rota: `/ficha/${f.token}` });
    expect(await screen.findByText(/Os dados do responsável .* são apagados 180 dias depois do evento/)).toBeInTheDocument();
  });

  it('as cortesias dizem para que servem os nomes e quando são apagados', async () => {
    const d = await (await comoGestor()).chamar('cortesias.salvarDestino', { id: '', eventoId: 'e20', nome: 'Casa do Estudante', quantidade: 3, pedirMatricula: true });
    await renderizar({ pessoa: null, rota: `/cortesias/${d.token}` });
    expect(await screen.findByText(/Os nomes e as matrículas .* são apagados 90 dias depois do evento/)).toBeInTheDocument();
  });

  it('em Configurações dá para mudar os prazos (0 = nunca apagar)', async () => {
    await renderizar({ rota: '/configuracoes' });
    expect(await screen.findByLabelText('Nomes e matrículas das cortesias (dias)')).toHaveValue(90);
    expect(screen.getByLabelText('Dados do responsável da ficha técnica (dias)')).toHaveValue(180);
  });
});
