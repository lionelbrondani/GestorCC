import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('Achados e perdidos', () => {
  it('mostra os guardados com os dias e o prazo; o mais antigo vem primeiro, com o prazo vencido', async () => {
    await renderizar({ rota: '/achados' });
    const itens = await screen.findAllByRole('button', { name: /^#\d+/ });
    expect(itens[0]).toHaveTextContent('#2 Guarda-chuva preto');
    expect(itens[0]).toHaveTextContent('guardado há 104 dias · prazo vencido, pode descartar');
    expect(screen.getByRole('button', { name: /#5 Fone de ouvido sem fio/ })).toHaveTextContent('guardado há 6 dias · pode descartar em 84 dias');
    expect(screen.getByText('1 item com o prazo vencido: já pode ser descartado.')).toBeInTheDocument();
  });

  it('registra um achado', async () => {
    await renderizar({ rota: '/achados' });
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Registrar achado' }));
    const modal = await screen.findByRole('dialog', { name: 'Registrar achado' });
    await u.click(within(modal).getByRole('button', { name: 'Salvar' }));
    expect(await within(modal).findByText('Descreva o item (ex.: guarda-chuva preto).')).toBeInTheDocument();
    await u.type(within(modal).getByLabelText('Descrição'), 'Mochila azul');
    await u.selectOptions(within(modal).getByLabelText('Local'), 'Hall de entrada');
    await u.type(within(modal).getByLabelText('Onde está guardado'), 'Armário da secretaria');
    await u.click(within(modal).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('button', { name: /#6 Mochila azul/ })).toHaveTextContent('guardado desde hoje · pode descartar em 90 dias');
  });

  it('devolver ao dono pede quem retirou e leva o item para Devolvidos', async () => {
    await renderizar({ rota: '/achados' });
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /#3 Casaco de lã cinza/ }));
    const modal = await screen.findByRole('dialog', { name: '#3 Casaco de lã cinza' });
    await u.click(within(modal).getByRole('button', { name: 'Devolver ao dono' }));
    await u.click(within(modal).getByRole('button', { name: 'Confirmar devolução' }));
    expect(await within(modal).findByText('Informe quem retirou o item.')).toBeInTheDocument();
    await u.type(within(modal).getByLabelText('Quem retirou'), 'Pessoa Teste');
    await u.click(within(modal).getByRole('button', { name: 'Confirmar devolução' }));
    await u.click(await screen.findByRole('tab', { name: /Devolvidos/ }));
    expect(await screen.findByRole('button', { name: /#3 Casaco de lã cinza/ })).toHaveTextContent('Devolvido em 24/10/2026 para Pessoa Teste');
  });

  it('o link da busca abre o item', async () => {
    await renderizar({ rota: '/achados?item=ac-exemplo-5' });
    expect(await screen.findByRole('dialog', { name: '#5 Fone de ouvido sem fio branco' })).toBeInTheDocument();
  });
});
