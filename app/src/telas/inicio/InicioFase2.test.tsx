import { screen } from '@testing-library/react';
import { vi, type MockInstance } from 'vitest';
import { renderizar } from '../../teste/renderizar';

const FASE2 = 'pessoas,dadosPessoais,mural,formularios,configuracoes,eventos';
const DESLIGADAS = ['escalas.listar', 'rodadas.listar', 'disponibilidades.listar', 'almox.listar', 'contratos.listar', 'infra.listar'];
const acoesChamadas = (chamar: MockInstance) => chamar.mock.calls.map((c) => c[0] as string);

describe('Início na fase 2', () => {
  it('início do gestor na fase 2 mostra a agenda e não consulta áreas desligadas', async () => {
    let chamar!: MockInstance;
    await renderizar({ rota: '/', recursos: FASE2, aoCriarApi: (api) => (chamar = vi.spyOn(api, 'chamar')) });
    expect(await screen.findByText('Hoje')).toBeInTheDocument();
    expect(screen.getByText('Próximos 7 dias')).toBeInTheDocument();
    expect(acoesChamadas(chamar)).toContain('eventos.listar');
    expect(acoesChamadas(chamar).filter((a) => DESLIGADAS.includes(a))).toEqual([]);
    expect(screen.queryByText(/Contratado em/)).not.toBeInTheDocument();
  });

  it('início do bolsista na fase 2 não consulta escalas nem rodadas', async () => {
    let chamar!: MockInstance;
    await renderizar({ pessoa: 'bolsista', rota: '/', recursos: FASE2, aoCriarApi: (api) => (chamar = vi.spyOn(api, 'chamar')) });
    expect(await screen.findByText(/Olá, /)).toBeInTheDocument();
    expect(acoesChamadas(chamar).filter((a) => DESLIGADAS.includes(a))).toEqual([]);
  });
});
