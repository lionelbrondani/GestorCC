import { consultarCep, consultarCnpj, feriadosNacionais } from './brasilapi';

/** Resposta de mentira no formato da BrasilAPI (os dados são os públicos da própria UFSM). */
const responder = (corpo: unknown, status = 200) => async () => new Response(JSON.stringify(corpo), { status });

describe('BrasilAPI (CNPJ, CEP e feriados)', () => {
  it('CNPJ vira razão social, endereço montado, CEP formatado, e-mail e situação', async () => {
    const buscar = responder({
      razao_social: 'UNIVERSIDADE FEDERAL DE SANTA MARIA', descricao_tipo_de_logradouro: 'AVENIDA', logradouro: 'RORAIMA', numero: '1000',
      complemento: 'CIDADE UNIVERSITARIA', bairro: 'CAMOBI', municipio: 'SANTA MARIA', uf: 'RS', cep: '97105900', email: null, descricao_situacao_cadastral: 'ATIVA',
    });
    expect(await consultarCnpj('95.591.764/0001-05', buscar)).toEqual({
      razaoSocial: 'UNIVERSIDADE FEDERAL DE SANTA MARIA',
      endereco: 'AVENIDA RORAIMA, 1000 - CIDADE UNIVERSITARIA - CAMOBI, SANTA MARIA/RS',
      cep: '97105-900',
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
    const buscar = responder({ cep: '97105900', state: 'RS', city: 'Santa Maria', neighborhood: 'Camobi', street: 'Avenida Roraima' });
    expect(await consultarCep('97105-900', buscar)).toEqual({ endereco: 'Avenida Roraima, Camobi, Santa Maria/RS', cep: '97105-900' });
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
    expect(await consultarCep('97105-900', falhar)).toBeNull();
    expect(await feriadosNacionais(2026, falhar)).toBeNull();
  });
});
