import { ErroApi } from '@shared';
import { criarHttpCliente } from './httpCliente';

function fetchFalso(resposta: unknown, registro: { url?: string; init?: RequestInit }[] = []) {
  return (async (url: string, init?: RequestInit) => {
    registro.push({ url, init });
    return { json: async () => resposta } as Response;
  }) as unknown as typeof fetch;
}

describe('cliente HTTP da API', () => {
  it('envia text/plain com ação, token e idRequisicao', async () => {
    const chamadas: { url?: string; init?: RequestInit }[] = [];
    const api = criarHttpCliente('https://api.exemplo/exec', { fetch: fetchFalso({ ok: true, dados: { versao: '0.1.0' } }, chamadas), novoId: () => 'id-1' });
    api.definirToken('tok-123');
    expect(await api.chamar('sistema.ping', null)).toEqual({ versao: '0.1.0' });
    expect(chamadas[0].url).toBe('https://api.exemplo/exec');
    expect(chamadas[0].init?.method).toBe('POST');
    expect((chamadas[0].init?.headers as Record<string, string>)['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(JSON.parse(String(chamadas[0].init?.body))).toEqual({ acao: 'sistema.ping', token: 'tok-123', idRequisicao: 'id-1', dados: null });
  });

  it('erro da API vira ErroApi com o mesmo código e mensagem', async () => {
    const api = criarHttpCliente('u', { fetch: fetchFalso({ ok: false, erro: { codigo: 'SEM_PERMISSAO', mensagem: 'Sem permissão.' } }) });
    await expect(api.chamar('lotes.listar', null)).rejects.toBeInstanceOf(ErroApi);
    await expect(api.chamar('lotes.listar', null)).rejects.toMatchObject({ codigo: 'SEM_PERMISSAO', message: 'Sem permissão.' });
  });

  it('falha de rede vira mensagem clara', async () => {
    const api = criarHttpCliente('u', {
      fetch: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    });
    await expect(api.chamar('sistema.ping', null)).rejects.toMatchObject({
      codigo: 'REDE',
      message: 'Sem conexão com o servidor. Verifique a internet e tente de novo.',
    });
  });

  it('resposta que não é JSON também vira erro claro', async () => {
    const api = criarHttpCliente('u', {
      fetch: (async () => ({ json: async () => { throw new SyntaxError('x'); } }) as unknown as Response) as unknown as typeof fetch,
    });
    await expect(api.chamar('sistema.ping', null)).rejects.toMatchObject({ codigo: 'REDE' });
  });
});
