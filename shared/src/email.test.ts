import { describe, expect, it } from 'vitest';
import { EMAIL_JUNTO, emailValido, MODULO_DO_EMAIL, separarEmails, textoLembreteRodadaEmail } from './email';

describe('e-mail', () => {
  it('reconhece endereços válidos', () => {
    expect(emailValido('nome@acad.ufsm.br')).toBe(true);
    expect(emailValido(' Nome.Sobrenome@ufsm.br ')).toBe(true);
    expect(emailValido('nome@')).toBe(false);
    expect(emailValido('nome@ufsm')).toBe(false);
    expect(emailValido('a b@ufsm.br')).toBe(false);
  });

  it('lê o campo Para separado por vírgula, ponto e vírgula, espaço ou linha, sem repetir', () => {
    expect(separarEmails('a@ufsm.br, B@ufsm.br; a@ufsm.br\nc@x  ')).toEqual({ validos: ['a@ufsm.br', 'b@ufsm.br'], invalidos: ['c@x'] });
    expect(separarEmails('   ')).toEqual({ validos: [], invalidos: [] });
  });

  it('cada tipo de e-mail exige editar o módulo da tela que o monta', () => {
    expect(MODULO_DO_EMAIL).toEqual({ ficha: 'eventos', cortesias: 'eventos', fundep: 'contratos', escala: 'escalas', rodada: 'escalas', acesso: 'pessoas', pedido: 'eventos' });
  });

  it('só o pedido à FUNDEP vai junto para todos; os demais, um para cada (ninguém vê os outros endereços)', () => {
    expect(Object.entries(EMAIL_JUNTO).filter(([, junto]) => junto).map(([t]) => t)).toEqual(['fundep']);
  });
});

describe('lembrete da rodada por e-mail', () => {
  it('fala com a pessoa (sem listar quem mais falta) e leva ao link da disponibilidade', () => {
    const texto = textoLembreteRodadaEmail({ nome: 'Dezembro/2026', prazo: '2026-11-25T23:59' }, 'https://gestorcc.web.app/disponibilidade');
    expect(texto).toBe(
      'Olá! A rodada de disponibilidade Dezembro/2026 fecha em 25/11/2026 às 23:59 e ainda falta a sua resposta.\n\n' +
        'Entre no GestorCC e marque os eventos em que você pode trabalhar:\nhttps://gestorcc.web.app/disponibilidade\n\n' +
        'Sem resposta, você conta como indisponível.',
    );
  });
});
