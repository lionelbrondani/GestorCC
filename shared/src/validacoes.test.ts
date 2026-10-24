import { describe, expect, it } from 'vitest';
import { cpfValido, normalizarCpf, normalizarMatricula } from './validacoes';

describe('CPF', () => {
  it('normaliza só dígitos', () => expect(normalizarCpf('12345678909')).toBe('123.456.789-09'));
  it('normaliza com espaços e pontuação irregular', () => expect(normalizarCpf('123.456.789- 09')).toBe('123.456.789-09'));
  it('rejeita dígito verificador errado', () => expect(cpfValido('123.456.789-00')).toBe(false));
  it('aceita CPF válido', () => expect(cpfValido('123.456.789-09')).toBe(true));
  it('rejeita repetidos', () => expect(cpfValido('111.111.111-11')).toBe(false));
  it('normalizar devolve null para inválido', () => expect(normalizarCpf('123')).toBeNull());
});

describe('matrícula', () => {
  it('rejeita notação científica vinda da planilha', () => expect(normalizarMatricula('2.02520732E8')).toBeNull());
  it('aceita 9 dígitos com espaços', () => expect(normalizarMatricula(' 202520732 ')).toBe('202520732'));
  it('aceita 10 dígitos', () => expect(normalizarMatricula('2023520506')).toBe('2023520506'));
});
