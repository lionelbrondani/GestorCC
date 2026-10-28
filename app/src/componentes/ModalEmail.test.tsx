import { fireEvent, screen, within } from '@testing-library/react';
import { vi, type MockInstance } from 'vitest';
import { renderizar } from '../teste/renderizar';

/** Abre a tela espiando a API: dá para ver o que foi (e o que não foi) mandado. */
async function abrir(rota: string) {
  let chamar!: MockInstance;
  await renderizar({ rota, aoCriarApi: (api) => (chamar = vi.spyOn(api, 'chamar')) });
  const enviados = () => chamar.mock.calls.filter((c) => c[0] === 'emails.enviar').map((c) => c[1] as Record<string, unknown>);
  return { enviados };
}

describe('e-mail só quando alguém clica em Enviar', () => {
  it('ficha técnica: mostra o e-mail pronto para conferir; cancelar não manda nada; Enviar manda', async () => {
    const { enviados } = await abrir('/agenda/e19');
    fireEvent.click(await screen.findByRole('button', { name: /Gerar link da ficha técnica/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Enviar por e-mail/ }));
    let janela = await screen.findByRole('dialog', { name: 'Mandar a ficha técnica por e-mail' });
    expect(within(janela).getByLabelText('Assunto')).toHaveValue('Ficha técnica do Centro de Convenções: Concerto de Natal');
    expect((within(janela).getByLabelText('Mensagem') as HTMLTextAreaElement).value).toContain('/ficha/');
    expect(within(janela).getByRole('button', { name: /Enviar e-mail/ })).toBeDisabled();
    fireEvent.change(within(janela).getByLabelText('Para'), { target: { value: 'produtor@exemplo.com' } });
    fireEvent.click(within(janela).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog', { name: 'Mandar a ficha técnica por e-mail' })).not.toBeInTheDocument();
    expect(enviados()).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: /Enviar por e-mail/ }));
    janela = await screen.findByRole('dialog', { name: 'Mandar a ficha técnica por e-mail' });
    fireEvent.change(within(janela).getByLabelText('Para'), { target: { value: 'produtor@exemplo' } });
    expect(within(janela).getByText('E-mail inválido: produtor@exemplo')).toBeInTheDocument();
    fireEvent.change(within(janela).getByLabelText('Para'), { target: { value: 'produtor@exemplo.com' } });
    fireEvent.click(within(janela).getByRole('button', { name: /Enviar e-mail/ }));
    expect(await screen.findByText('E-mail enviado para 1 pessoa.')).toBeInTheDocument();
    expect(enviados()).toEqual([expect.objectContaining({ tipo: 'ficha', para: ['produtor@exemplo.com'], pessoaIds: [], assunto: 'Ficha técnica do Centro de Convenções: Concerto de Natal' })]);
  });

  it('cortesias: o destino recebe a mensagem com o link dele', async () => {
    const { enviados } = await abrir('/agenda/e19');
    fireEvent.click(await screen.findByRole('button', { name: /Novo destino/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Destino' }), { target: { value: 'Casa do Estudante' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantidade' }), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar destino' }));
    fireEvent.click(await screen.findByRole('button', { name: 'E-mail para Casa do Estudante' }));
    const janela = await screen.findByRole('dialog', { name: 'Mandar as cortesias por e-mail' });
    expect((within(janela).getByLabelText('Mensagem') as HTMLTextAreaElement).value).toContain('/cortesias/');
    fireEvent.change(within(janela).getByLabelText('Para'), { target: { value: 'ce@ufsm.br' } });
    fireEvent.click(within(janela).getByRole('button', { name: /Enviar e-mail/ }));
    await screen.findByText('E-mail enviado para 1 pessoa.');
    expect(enviados()).toEqual([expect.objectContaining({ tipo: 'cortesias', para: ['ce@ufsm.br'] })]);
  });

  it('rodada: lembra por e-mail quem não respondeu, e dá para tirar alguém antes de mandar', async () => {
    const { enviados } = await abrir('/escalas?aba=rodadas&mes=2026-12');
    fireEvent.click(await screen.findByRole('button', { name: /Lembrar por e-mail/ }));
    const janela = await screen.findByRole('dialog', { name: 'Lembrar por e-mail quem não respondeu' });
    const tirar = within(janela).getAllByRole('button', { name: /^Tirar / });
    fireEvent.click(tirar[0]);
    fireEvent.click(within(janela).getByRole('button', { name: `Enviar para ${tirar.length - 1} pessoas` }));
    await screen.findByText(`E-mail enviado para ${tirar.length - 1} pessoas.`);
    const [dados] = enviados();
    expect(dados).toMatchObject({ tipo: 'rodada', para: [] });
    expect(dados.pessoaIds).toHaveLength(tirar.length - 1);
    expect(dados.mensagem).toContain('/disponibilidade');
  });

  it('escala publicada: manda para a equipe da sessão, pelo nome', async () => {
    const { enviados } = await abrir('/escalas?aba=publicadas&mes=2026-11');
    fireEvent.click((await screen.findAllByRole('button', { name: /E-mail para a equipe/ }))[0]);
    const janela = await screen.findByRole('dialog', { name: 'Mandar a escala por e-mail' });
    const equipe = within(janela).getAllByRole('button', { name: /^Tirar / }).length;
    expect(equipe).toBeGreaterThan(0);
    fireEvent.click(within(janela).getByRole('button', { name: equipe > 1 ? `Enviar para ${equipe} pessoas` : /Enviar e-mail/ }));
    await screen.findByText(/E-mail enviado para/);
    expect(enviados()[0]).toMatchObject({ tipo: 'escala', para: [] });
    expect(enviados()[0].pessoaIds).toHaveLength(equipe);
  });

  it('FUNDEP: vai formatado, para os destinatários configurados, com os contratos assinados escolhidos', async () => {
    const { enviados } = await abrir('/contratos/fundep');
    fireEvent.click(await screen.findByRole('checkbox', { name: /Contrato 23\/2026/ }));
    fireEvent.click(screen.getByRole('button', { name: /Enviar por e-mail/ }));
    const janela = await screen.findByRole('dialog', { name: 'Pedir as faturas à FUNDEP por e-mail' });
    expect(within(janela).getByLabelText('Para')).toHaveValue('faturamento@fundep.exemplo.com');
    fireEvent.click(within(janela).getByRole('button', { name: /Enviar e-mail/ }));
    await screen.findByText('E-mail enviado para 1 pessoa.');
    expect(enviados()).toEqual([expect.objectContaining({ tipo: 'fundep', para: ['faturamento@fundep.exemplo.com'], contratoIds: ['c4'], html: expect.stringContaining('23/2026') })]);
  });

  it('senha redefinida: o aviso vai para o e-mail da própria pessoa', async () => {
    const { enviados } = await abrir('/pessoas');
    fireEvent.click(await screen.findByText('Amanda Rocha'));
    fireEvent.click(await screen.findByRole('button', { name: 'Redefinir senha para a matrícula' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Redefinir senha' })).getByRole('button', { name: 'Redefinir' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Senha redefinida' })).getByRole('button', { name: /Enviar por e-mail/ }));
    const janela = await screen.findByRole('dialog', { name: 'Mandar o aviso de senha por e-mail' });
    const para = (within(janela).getByLabelText('Para') as HTMLInputElement).value;
    expect(para).toMatch(/@/);
    fireEvent.click(within(janela).getByRole('button', { name: /Enviar e-mail/ }));
    await screen.findByText('E-mail enviado para 1 pessoa.');
    expect(enviados()).toEqual([expect.objectContaining({ tipo: 'acesso', para: [para] })]);
  });
});
