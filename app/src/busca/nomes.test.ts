import { describe, expect, it } from 'vitest';
import { devolverNaConsulta, protegerNomes } from './nomes';

const PESSOAS = [
  { nome: 'Camila Freitas', nomeCurto: 'Camila' },
  { nome: 'José Antônio Reis', nomeCurto: 'Zé' },
  { nome: 'Ana Souza', nomeCurto: 'Ana' },
  { nome: 'Ana Lima', nomeCurto: 'Aninha' },
];

describe('nomes das pessoas fora da pergunta que vai ao Gemini', () => {
  it('nome completo, primeiro nome e apelido viram PESSOA_n, sem diferença de acento ou maiúscula', () => {
    const p = protegerNomes('quantas escalas a camila freitas e o JOSE ANTONIO REIS fizeram?', PESSOAS);
    expect(p.texto).toBe('quantas escalas a PESSOA_1 e o PESSOA_2 fizeram?');
    expect(p.devolver('PESSOA_1 e PESSOA_2')).toBe('Camila Freitas e José Antônio Reis');
    expect(protegerNomes('quando a Aninha trabalha?', PESSOAS).texto).toBe('quando a PESSOA_1 trabalha?');
  });

  it('a mesma pessoa citada duas vezes ganha o mesmo código', () => {
    expect(protegerNomes('Camila Freitas ou só Camila?', PESSOAS).texto).toBe('PESSOA_1 ou só PESSOA_1?');
  });

  it('só palavras inteiras, e nomes com menos de 3 letras ficam', () => {
    expect(protegerNomes('a Anabela e o Zé', PESSOAS).texto).toBe('a Anabela e o Zé');
  });

  it('nome de duas pessoas volta como foi digitado; código desconhecido fica', () => {
    const p = protegerNomes('escalas da Ana e da Aninha', PESSOAS);
    expect(p.texto).toBe('escalas da PESSOA_1 e da PESSOA_2');
    expect(p.devolver('PESSOA_1, PESSOA_2, pessoa_2 e PESSOA_9')).toBe('Ana, Ana Lima, Ana Lima e PESSOA_9');
  });

  it('o filtro ou o termo da consulta voltam com o nome', () => {
    const { devolver } = protegerNomes('escalas da Camila', PESSOAS);
    expect(devolverNaConsulta({ nome: 'escalasDaPessoa', termo: 'pessoa_1' }, devolver)).toEqual({ nome: 'escalasDaPessoa', termo: 'Camila Freitas' });
    expect(devolverNaConsulta({ nome: 'analise', assunto: 'escalas', de: null, ate: null, agrupar: 'mes', medida: 'contar', filtro: 'PESSOA_1', ordem: 'cronologica', limite: 20 }, devolver)).toMatchObject({
      filtro: 'Camila Freitas',
    });
    expect(devolverNaConsulta({ nome: 'proximosEventos' }, devolver)).toEqual({ nome: 'proximosEventos' });
  });
});
