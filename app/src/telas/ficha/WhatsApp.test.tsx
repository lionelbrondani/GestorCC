import { fireEvent, screen } from '@testing-library/react';
import { renderizar } from '../../teste/renderizar';

const texto = (link: HTMLElement) => decodeURIComponent(link.getAttribute('href') ?? '');

describe('mensagens prontas para o WhatsApp', () => {
  it('a ficha técnica e cada destino de cortesias abrem o WhatsApp com a mensagem e o link', async () => {
    await renderizar({ rota: '/agenda/e19' });
    fireEvent.click(await screen.findByRole('button', { name: /Gerar link da ficha técnica/ }));
    const ficha = await screen.findByRole('link', { name: /Abrir no WhatsApp/ });
    expect(ficha.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(texto(ficha)).toContain('/ficha/');

    fireEvent.click(screen.getByRole('button', { name: /Novo destino/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Destino' }), { target: { value: 'Casa do Estudante' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantidade' }), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar destino' }));
    const cortesias = await screen.findByRole('link', { name: 'WhatsApp para Casa do Estudante' });
    expect(texto(cortesias)).toContain('/cortesias/');
  });
});
