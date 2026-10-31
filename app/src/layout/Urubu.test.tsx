import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type MockInstance } from 'vitest';
import { renderizar } from '../teste/renderizar';

async function abrir(respostas: unknown[], pessoa: 'gestor' | 'bolsista' = 'gestor') {
  let chamar!: MockInstance;
  let n = 0;
  await renderizar({
    pessoa,
    rota: '/',
    aoCriarApi: (api) => {
      const original = api.chamar.bind(api);
      chamar = vi.spyOn(api, 'chamar').mockImplementation((async (acao: string, dados: unknown) =>
        acao === 'busca.interpretar' ? respostas[n++] : original(acao as never, dados as never)) as typeof api.chamar);
    },
  });
  return chamar;
}

describe('assistente (Urubu)', () => {
  it('abre pelo botão, cumprimenta e conversa; a conversa vai ao Gemini sem os nomes das pessoas', async () => {
    const consulta = { nome: 'escalasDaPessoa', termo: 'PESSOA_1' };
    const chamar = await abrir([
      { consulta: null, consultas: [], ajuda: 'Abra Perfil e use Trocar senha.', motivo: null },
      { consulta, consultas: [consulta], ajuda: null, motivo: null },
    ]);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Falar com o Assistente' }));
    const painel = await screen.findByRole('dialog', { name: 'Assistente' });
    expect(within(painel).getByText(/Eu sou o assistente do GestorCC/)).toBeInTheDocument();

    await u.type(within(painel).getByLabelText('Mensagem para o Assistente'), 'como troco minha senha?{Enter}');
    expect(await within(painel).findByText('Abra Perfil e use Trocar senha.')).toBeInTheDocument();
    expect(chamar).toHaveBeenCalledWith('busca.interpretar', { pergunta: 'como troco minha senha?', persona: 'urubu' });

    await u.type(within(painel).getByLabelText('Mensagem para o Assistente'), 'e quando a Renata Bortoli trabalha?{Enter}');
    expect(await within(painel).findByText('Próximas escalas de Renata Bortoli')).toBeInTheDocument();
    expect(chamar).toHaveBeenCalledWith('busca.interpretar', {
      pergunta: 'e quando a PESSOA_1 trabalha?',
      persona: 'urubu',
      historico: [{ pergunta: 'como troco minha senha?', resposta: 'Abra Perfil e use Trocar senha.' }],
    });
  });

  it('no limite do dia, avisa com bom humor', async () => {
    const limite = { consulta: null, consultas: [], ajuda: null, motivo: 'limite' };
    await abrir([limite, limite]);
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Falar com o Assistente' }));
    const painel = await screen.findByRole('dialog', { name: 'Assistente' });
    await u.click(within(painel).getByRole('button', { name: 'Quantas sessões tivemos por mês?' }));
    // sem o Gemini, as perguntas comuns ainda saem pelas palavras-chave
    expect(await within(painel).findByRole('table')).toBeInTheDocument();
    await u.type(within(painel).getByLabelText('Mensagem para o Assistente'), 'xyzw qwerty asdf zxcv{Enter}');
    expect(await within(painel).findByText('Por hoje chega de perguntas: o limite do dia acabou. Amanhã eu volto.')).toBeInTheDocument();
  });

  it('quem não tem a busca não vê o assistente', async () => {
    await abrir([], 'bolsista');
    await screen.findByRole('heading', { name: /Olá/ });
    expect(screen.queryByRole('button', { name: 'Falar com o Assistente' })).not.toBeInTheDocument();
  });
});
