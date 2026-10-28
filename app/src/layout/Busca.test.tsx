import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type MockInstance } from 'vitest';
import { renderizar } from '../teste/renderizar';

async function perguntar(resposta: unknown, pergunta: string) {
  let chamar!: MockInstance;
  await renderizar({
    rota: '/',
    aoCriarApi: (api) => {
      const original = api.chamar.bind(api);
      chamar = vi.spyOn(api, 'chamar').mockImplementation((async (acao: string, dados: unknown) =>
        acao === 'busca.interpretar' ? resposta : original(acao as never, dados as never)) as typeof api.chamar);
    },
  });
  const u = userEvent.setup();
  await u.type(await screen.findByRole('searchbox', { name: 'Buscar ou perguntar' }), `${pergunta}{Enter}`);
  return chamar;
}

describe('Busca inteligente', () => {
  it('a consulta vinda da API vira o card de resposta', async () => {
    const chamar = await perguntar({ consulta: { nome: 'estoqueCritico' }, ajuda: null, motivo: null }, 'o que precisamos comprar agora?');
    expect(chamar).toHaveBeenCalledWith('busca.interpretar', { pergunta: 'o que precisamos comprar agora?' });
    expect(await screen.findByText('resposta automática · confira os dados')).toBeInTheDocument();
  });

  it('a ajuda de uso aparece no card', async () => {
    await perguntar({ consulta: null, ajuda: 'Abra Perfil e use Trocar senha.', motivo: null }, 'como eu troco minha senha?');
    expect(await screen.findByText('Abra Perfil e use Trocar senha.')).toBeInTheDocument();
    expect(screen.getByText('resposta automática · confira os dados')).toBeInTheDocument();
  });

  it('sem o Gemini, a pergunta é interpretada por palavras-chave', async () => {
    const chamar = await perguntar({ consulta: null, ajuda: null, motivo: 'indisponivel' }, 'o que precisamos comprar no estoque critico?');
    expect(await screen.findByText('resposta automática · confira os dados')).toBeInTheDocument();
    expect(chamar.mock.calls.map((c) => c[0])).toContain('almox.listar');
  });

  it('pergunta complexa vira tabela, com o total', async () => {
    const analise = { nome: 'analise', assunto: 'sessoes', de: null, ate: null, agrupar: 'mes', medida: 'contar', filtro: '', ordem: 'cronologica', limite: 20 };
    await perguntar({ consulta: analise, consultas: [analise], ajuda: null, motivo: null }, 'quantas sessões tivemos por mês?');
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByRole('columnheader', { name: 'Mês' })).toBeInTheDocument();
    expect(within(tabela).getByRole('rowheader', { name: 'Total' })).toBeInTheDocument();
  });

  it('uma pergunta com várias partes mostra uma resposta para cada', async () => {
    await perguntar(
      { consulta: { nome: 'estoqueCritico' }, consultas: [{ nome: 'estoqueCritico' }, { nome: 'lotesEmAberto' }], ajuda: null, motivo: null },
      'o que falta comprar e quais lotes estão em aberto?',
    );
    expect(await screen.findByText('Itens no estoque mínimo')).toBeInTheDocument();
    expect(await screen.findByText('Lotes aguardando pagamento')).toBeInTheDocument();
    expect(screen.getAllByText('resposta automática · confira os dados')).toHaveLength(1);
  });

  it('os nomes das pessoas vão ao Gemini como código e voltam na resposta', async () => {
    const consulta = { nome: 'escalasDaPessoa', termo: 'PESSOA_1' };
    const chamar = await perguntar({ consulta, consultas: [consulta], ajuda: null, motivo: null }, 'quando a Camila Freitas trabalha?');
    expect(chamar).toHaveBeenCalledWith('busca.interpretar', { pergunta: 'quando a PESSOA_1 trabalha?' });
    expect(await screen.findByText('Próximas escalas de Camila Freitas')).toBeInTheDocument();
  });

  it('nada entendido mostra a mensagem da busca comum', async () => {
    await perguntar({ consulta: null, ajuda: null, motivo: 'limite' }, 'xyzw qwerty asdf zxcv');
    expect(await screen.findByText('Não consegui interpretar agora; veja os resultados da busca.')).toBeInTheDocument();
  });
});
