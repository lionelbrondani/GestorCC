import { describe, expect, it } from 'vitest';
import { diaDaSemana, diaDaSemanaCurto, diasDoMes, diferencaDias, formatarData, horaParaMinutos, mesDe, mesExtenso, somarDias } from './datas';

describe('datas', () => {
  it('formata dd/mm/aaaa', () => expect(formatarData('2026-10-09')).toBe('09/10/2026'));
  it('dia da semana por extenso', () => expect(diaDaSemana('2026-11-06')).toBe('sexta-feira'));
  it('dia da semana curto', () => expect(diaDaSemanaCurto('2026-11-07')).toBe('SÁB'));
  it('diferença atravessando o mês', () => expect(diferencaDias('2026-10-31', '2026-11-01')).toBe(1));
  it('somar dias', () => expect(somarDias('2026-12-31', 1)).toBe('2027-01-01'));
  it('dias de fevereiro de 2026', () => expect(diasDoMes(2026, 2)).toHaveLength(28));
  it('hora em minutos', () => expect(horaParaMinutos('19:30')).toBe(1170));
  it('mês por extenso', () => expect(mesExtenso(10)).toBe('OUTUBRO'));
  it('mês de uma data', () => expect(mesDe('2026-10-09')).toBe('2026-10'));
});
