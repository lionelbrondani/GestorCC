import { screen, waitFor } from '@testing-library/react';
import { vi, type MockInstance } from 'vitest';
import { renderizar } from '../../teste/renderizar';

const FASE3 = 'pessoas,dadosPessoais,mural,formularios,configuracoes,eventos,escalas,escalasPessoais';
const DESLIGADAS = ['lotes.listar', 'ganhos.meus', 'almox.listar', 'contratos.listar', 'infra.listar'];
const chamadasDesligadas = (chamar: MockInstance) => chamar.mock.calls.map((c) => c[0] as string).filter((a) => DESLIGADAS.includes(a));
const destinos = () => screen.queryAllByRole('link').map((l) => l.getAttribute('href'));

describe('App na fase 3', () => {
  it('bolsista na fase 3 tem escalas e disponibilidade, mas não Ganhos', async () => {
    let chamar!: MockInstance;
    await renderizar({ pessoa: 'bolsista', rota: '/', recursos: FASE3, aoCriarApi: (api) => (chamar = vi.spyOn(api, 'chamar')) });
    expect(await screen.findByText(/Olá, /)).toBeInTheDocument();
    expect(destinos()).toEqual(expect.arrayContaining(['/minhas-escalas', '/disponibilidade']));
    expect(destinos()).not.toContain('/ganhos');
    expect(chamadasDesligadas(chamar)).toEqual([]);
  });

  it('gestor percorre escalas sem chamar áreas desligadas', async () => {
    let chamar!: MockInstance;
    const { router } = await renderizar({ rota: '/escalas?aba=rodadas', recursos: FASE3, aoCriarApi: (api) => (chamar = vi.spyOn(api, 'chamar')) });
    for (const aba of ['montar', 'publicadas', 'presenca', 'avaliacoes']) {
      await router.navigate(`/escalas?aba=${aba}&mes=2026-12`);
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    }
    expect(chamadasDesligadas(chamar)).toEqual([]);
  });

  it('sessão que entrou depois na rodada aparece como nova', async () => {
    // começa numa tela que não consulta rodadas, para a lista vir depois do evento criado
    const { api, router } = await renderizar({ rota: '/avisos', recursos: FASE3 });
    await api.chamar('eventos.salvar', {
      evento: { id: '', nome: 'Show Surpresa', tipo: 'Show/Concerto', organizador: 'Produtora', contatoOrganizador: '', pagamento: 'interno', instrumento: 'nenhum', status: 'ativo' },
      sessoes: [{ id: '', eventoId: '', data: '2026-12-20', chegada: '18:30', inicio: '20:00', fim: '22:00', horarioADefinir: false, vagasBolsistas: 8, vagasServidores: 1, diaria: null, minimoExperientes: 1, status: 'ativa', publicadaEm: null, convocacao: null }],
    });
    await router.navigate('/disponibilidade');
    expect((await screen.findAllByText('Show Surpresa', { exact: false })).length).toBeGreaterThan(0);
    expect(screen.getAllByText('nova').length).toBeGreaterThan(0);
    expect(screen.getByText(/Entraram depois da abertura: Show Surpresa/)).toBeInTheDocument();
  });
});
