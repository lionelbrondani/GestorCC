import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderizar } from '../../teste/renderizar';

describe('retirada pelo QR code da porta do almoxarifado', () => {
  it('sem login, com a chave do QR: escolhe os itens, diz o nome e para quê, e registra', async () => {
    await renderizar({ pessoa: null, rota: '/retirada?k=qr-prototipo' });
    expect(await screen.findByRole('heading', { name: 'Retirada de material' })).toBeInTheDocument();
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Registrar retirada' }));
    expect(await screen.findByText('Escreva o seu nome.')).toBeInTheDocument();
    await u.type(screen.getByLabelText('Seu nome'), 'Pessoa Teste');
    await u.type(screen.getByLabelText('Procurar item'), 'fita');
    await u.click(await screen.findByRole('button', { name: 'Incluir Fita crepe 48mm' }));
    const qtd = screen.getByLabelText('Quantidade de Fita crepe 48mm');
    await u.clear(qtd);
    await u.type(qtd, '2');
    await u.type(screen.getByLabelText('Para quê?'), 'Ensaio do coral');
    await u.click(screen.getByRole('button', { name: 'Registrar retirada' }));
    expect(await screen.findByText('Retirada registrada. Obrigado!')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Nova retirada' }));
    expect(screen.getByLabelText('Seu nome')).toHaveValue('Pessoa Teste');
  });

  it('com um QR antigo, avisa e não mostra o formulário', async () => {
    await renderizar({ pessoa: null, rota: '/retirada?k=antiga' });
    expect(await screen.findByText('Este QR code não vale mais. Peça o novo ao almoxarifado.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Seu nome')).not.toBeInTheDocument();
  });

  it('no Almoxarifado, a aba QR da porta mostra o cartaz com o código para imprimir', async () => {
    await renderizar({ rota: '/almox?aba=qr' });
    expect(await screen.findByRole('img', { name: 'QR code da retirada de material' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imprimir cartaz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar QR novo' })).toBeInTheDocument();
  });
});
