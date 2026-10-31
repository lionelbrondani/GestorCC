import { consultarCep, consultarCnpj, feriadosNacionais } from './brasilapi';

/** Resposta de mentira no formato da BrasilAPI (dados inventados). */
const responder = (corpo: unknown, status = 200) => async () => new Response(JSON.stringify(corpo), { status });

describe('BrasilAPI (CNPJ, CEP e feriados)', () => {
  it('CNPJ vira razão social, endereço montado, CEP formatado, e-mail e situação', async () => {
    const buscar = responder({
      razao_social: 'UNIVERSIDADE EXEMPLO', descricao_tipo_de_logradouro: 'AVENIDA', logradouro: 'EXEMPLO', numero: '100',
      complemento: 'CIDADE UNIVERSITARIA', bairro: 'CENTRO', municipio: 'CIDADE EXEMPLO', uf: 'RS', cep: '01001000', email: null, descricao_situacao_cadastral: 'ATIVA',
    });
    expect(await consultarCnpj('95.591.764/0001-05', buscar)).toEqual({
      razaoSocial: 'UNIVERSIDADE EXEMPLO',
      endereco: 'AVENIDA EXEMPLO, 100 - CIDADE UNIVERSITARIA - CENTRO, CIDADE EXEMPLO/RS',
      cep: '01001-000',
      email: '',
      situacao: 'ATIVA',
    });
  });

  it('CPF, CNPJ incompleto ou não encontrado não consultam nada útil', async () => {
    let chamadas = 0;
    const contar = async () => {
      chamadas++;
      return new Response('{}', { status: 404 });
    };
    expect(await consultarCnpj('000.000.000-00', contar)).toBeNull();
    expect(chamadas).toBe(0);
    expect(await consultarCnpj('11.222.333/0001-81', contar)).toBeNull();
  });

  it('CEP vira o endereço sem o número', async () => {
    const buscar = responder({ cep: '01001000', state: 'RS', city: 'Cidade Exemplo', neighborhood: 'Centro', street: 'Avenida Exemplo' });
    expect(await consultarCep('01001-000', buscar)).toEqual({ endereco: 'Avenida Exemplo, Centro, Cidade Exemplo/RS', cep: '01001-000' });
    expect(await consultarCep('9710', buscar)).toBeNull();
  });

  it('feriados nacionais do ano, com data e nome', async () => {
    const buscar = responder([
      { date: '2026-01-01', name: 'Confraternização mundial', type: 'national' },
      { date: '2026-04-21', name: 'Tiradentes', type: 'national' },
    ]);
    expect(await feriadosNacionais(2026, buscar)).toEqual([
      { data: '2026-01-01', nome: 'Confraternização mundial' },
      { data: '2026-04-21', nome: 'Tiradentes' },
    ]);
  });

  it('sem internet ou com a BrasilAPI fora do ar, devolve nada em vez de quebrar a tela', async () => {
    const falhar = async (): Promise<Response> => {
      throw new TypeError('Failed to fetch');
    };
    expect(await consultarCep('01001-000', falhar)).toBeNull();
    expect(await feriadosNacionais(2026, falhar)).toBeNull();
  });
});
