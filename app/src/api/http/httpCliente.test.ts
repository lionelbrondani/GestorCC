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

describe('consultas em lote', () => {
  /** Responde cada pedido com a função dada e guarda os corpos enviados. */
  function fetchLote(responder: (corpo: { token?: string; lote?: { acao: string }[]; acao?: string }) => unknown) {
    const corpos: { token?: string; lote?: { acao: string; dados: unknown }[]; acao?: string }[] = [];
    const f = (async (_u: string, init?: RequestInit) => {
      const corpo = JSON.parse(String(init?.body));
      corpos.push(corpo);
      return { json: async () => responder(corpo) } as Response;
    }) as unknown as typeof fetch;
    return { f, corpos };
  }

  it('consultas feitas juntas vão num pedido só, e cada uma recebe a sua resposta', async () => {
    const { f, corpos } = fetchLote((c) => ({ ok: true, dados: c.lote!.map((x) => ({ ok: true, dados: x.acao })) }));
    const api = criarHttpCliente('u', { fetch: f });
    api.definirToken('tok');
    const [a, b] = await Promise.all([api.consultar!('pessoas.listar', null), api.consultar!('avisos.listar', null)]);
    expect([a, b]).toEqual(['pessoas.listar', 'avisos.listar']);
    expect(corpos).toEqual([{ token: 'tok', lote: [{ acao: 'pessoas.listar', dados: null }, { acao: 'avisos.listar', dados: null }] }]);
  });

  it('consulta sozinha vai como chamada normal', async () => {
    const { f, corpos } = fetchLote(() => ({ ok: true, dados: 1 }));
    const api = criarHttpCliente('u', { fetch: f, novoId: () => 'id-1' });
    expect(await api.consultar!('pessoas.listar', null)).toBe(1);
    expect(corpos).toEqual([{ acao: 'pessoas.listar', token: null, idRequisicao: 'id-1', dados: null }]);
  });

  it('o erro de uma consulta não derruba as outras', async () => {
    const { f } = fetchLote(() => ({ ok: true, dados: [{ ok: true, dados: 'certo' }, { ok: false, erro: { codigo: 'SEM_PERMISSAO', mensagem: 'Sem permissão.' } }] }));
    const api = criarHttpCliente('u', { fetch: f });
    const [a, b] = await Promise.allSettled([api.consultar!('pessoas.listar', null), api.consultar!('lotes.listar', null)]);
    expect(a).toEqual({ status: 'fulfilled', value: 'certo' });
    expect(b).toMatchObject({ status: 'rejected', reason: { codigo: 'SEM_PERMISSAO', message: 'Sem permissão.' } });
  });

  it('sem rede, todas as consultas do lote falham com a mensagem clara', async () => {
    const api = criarHttpCliente('u', { fetch: (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch });
    const r = await Promise.allSettled([api.consultar!('pessoas.listar', null), api.consultar!('avisos.listar', null)]);
    expect(r.map((x) => x.status === 'rejected' && (x.reason as ErroApi).codigo)).toEqual(['REDE', 'REDE']);
  });

  it('mais de 20 consultas juntas viram mais de um pedido', async () => {
    const { f, corpos } = fetchLote((c) => ({ ok: true, dados: c.lote!.map(() => ({ ok: true, dados: null })) }));
    const api = criarHttpCliente('u', { fetch: f });
    await Promise.all(Array.from({ length: 25 }, () => api.consultar!('pessoas.listar', null)));
    expect(corpos.map((c) => c.lote?.length)).toEqual([20, 5]);
  });
});
