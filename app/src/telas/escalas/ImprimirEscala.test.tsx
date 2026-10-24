import type { Sessao } from '@shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import { renderizar } from '../../teste/renderizar';

describe('Imprimir escala (formato tradicional)', () => {
  it('pagina 25 sessões em 3 tabelas e marca X em quem está escalado', async () => {
    const { api, router } = await renderizar({ pessoa: 'gestor', rota: '/perfil' });
    const extra: Sessao[] = Array.from({ length: 5 }, (_, i) => ({
      id: '', eventoId: '', data: `2026-10-${String(5 + i).padStart(2, '0')}`, rotulo: `Extra ${i + 1}`,
      chegada: i === 0 ? null : '09:00', inicio: i === 0 ? null : '10:00', fim: i === 0 ? null : '12:00', horarioADefinir: i === 0,
      vagasBolsistas: 4, vagasServidores: 1, diaria: null, minimoExperientes: 0, status: 'ativa', publicadaEm: '2026-10-01T10:00', convocacao: null,
    }));
    await api.chamar('eventos.salvar', {
      evento: { id: '', nome: 'Oficina Extra', tipo: 'Outro', organizador: '', contatoOrganizador: '', pagamento: 'interno', instrumento: 'nenhum', status: 'ativo' },
      sessoes: extra,
    });
    const { sessoes } = await api.chamar('eventos.listar', { de: '2026-10-01', ate: '2026-10-31' });
    const publicadas = sessoes.filter((s) => s.publicadaEm && s.status === 'ativa');
    expect(publicadas).toHaveLength(25);
    const escalas = await api.chamar('escalas.listar', { de: '2026-10-01', ate: '2026-10-31' });
    const marcadas = escalas.filter((e) => publicadas.some((s) => s.id === e.sessaoId) && ['publicado', 'realizado', 'faltou'].includes(e.status));

    await act(() => router.navigate('/escalas/imprimir?mes=2026-10&modelo=legado'));

    await waitFor(() => expect(screen.getAllByRole('table')).toHaveLength(3));
    expect(screen.getAllByText('TABELA DE ESCALA DOS BOLSISTAS')).toHaveLength(3);
    expect(screen.getAllByText('Período de Referência: OUTUBRO/2026')).toHaveLength(3);
    for (const t of screen.getAllByRole('table')) expect(within(t).getByRole('columnheader', { name: 'Nome' })).toBeInTheDocument();

    const linhaChegada = screen.getAllByRole('row').filter((r) => r.textContent?.startsWith('Estar no CC'));
    expect(linhaChegada.some((r) => r.textContent?.includes('a definir'))).toBe(true);
    expect(screen.getAllByText('X')).toHaveLength(marcadas.length);
  });
});
