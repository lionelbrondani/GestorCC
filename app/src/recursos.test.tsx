import { screen } from '@testing-library/react';
import { lerRecursos } from './recursos';
import { renderizar } from './teste/renderizar';

const FASE_1 = 'pessoas,dadosPessoais,mural,formularios,configuracoes';

describe('módulos por fase', () => {
  it('lê a lista do ambiente', () => {
    const r = lerRecursos('pessoas, mural');
    expect(r.has('pessoas')).toBe(true);
    expect(r.has('mural')).toBe(true);
    expect(r.has('escalas')).toBe(false);
  });

  it('sem lista, tudo fica ativo (protótipo)', () => {
    expect(lerRecursos('').has('escalas')).toBe(true);
    expect(lerRecursos(undefined).has('relatar')).toBe(true);
  });

  it('na fase 1 o gestor não vê Escalas e a rota avisa que chega depois', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/escalas', recursos: FASE_1 });
    expect(await screen.findByText('Esta área chega numa próxima etapa.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Escalas' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Pessoas' }).length).toBeGreaterThan(0);
  });

  it('na fase 1, Pessoas funciona', async () => {
    await renderizar({ pessoa: 'gestor', rota: '/pessoas', recursos: FASE_1 });
    expect(await screen.findByRole('heading', { name: 'Pessoas e acessos' })).toBeInTheDocument();
  });

  it('na fase 1, o início não depende de eventos', async () => {
    await renderizar({ pessoa: 'bolsista', rota: '/', recursos: FASE_1 });
    expect(await screen.findByRole('heading', { name: /Olá, Amanda/ })).toBeInTheDocument();
    expect(screen.queryByText('Próxima escala')).not.toBeInTheDocument();
  });
});
