import { MODELOS, type Permissoes } from '@shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PermissoesEditor } from './PermissoesEditor';

function Envolver() {
  const [p, setP] = useState<Permissoes>(MODELOS.eventual);
  return <PermissoesEditor valor={p} aoMudar={setP} />;
}

describe('PermissoesEditor', () => {
  it('aplicar o modelo Operação e depois ajustar um módulo', async () => {
    render(<Envolver />);
    const u = userEvent.setup();
    await u.selectOptions(screen.getByLabelText('Aplicar modelo'), 'operacao');
    expect(screen.getByRole('radio', { name: 'Pagamentos: Nenhum' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Escalas: Editar' })).toBeChecked();

    await u.click(screen.getByRole('radio', { name: 'Pagamentos: Ver' }));
    expect(screen.getByRole('radio', { name: 'Pagamentos: Ver' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Escalas: Editar' })).toBeChecked();
    expect(screen.getByLabelText('Aplicar modelo')).toHaveValue('personalizado');
  });
});
