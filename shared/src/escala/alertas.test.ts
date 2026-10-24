import { describe, expect, it } from 'vitest';
import { sessao } from '../teste/fabricas';
import { alertasDaEscala, intervaloSessao } from './alertas';

describe('intervaloSessao', () => {
  it('é nulo quando o horário está a definir', () => {
    expect(intervaloSessao(sessao({ horarioADefinir: true, chegada: null, inicio: null, fim: null }))).toBeNull();
  });
  it('começa na chegada e termina no fim', () => {
    const i = intervaloSessao(sessao({ data: '1970-01-02', chegada: '08:00', inicio: '09:00', fim: '13:00' }))!;
    expect(i).toEqual({ inicio: 1440 + 480, fim: 1440 + 780 });
  });
  it('sem fim, assume 3 horas após o início', () => {
    const i = intervaloSessao(sessao({ data: '1970-01-01', chegada: '18:00', inicio: '19:00', fim: null }))!;
    expect(i.fim).toBe(19 * 60 + 180);
  });
});

describe('alertasDaEscala', () => {
  const manha = sessao({ data: '2026-10-29', chegada: '08:00', inicio: '09:00', fim: '13:00' });

  it('sobreposição é conflito', () => {
    const tarde = sessao({ data: '2026-10-29', chegada: '12:45', inicio: '14:00', fim: '18:00' });
    expect(alertasDaEscala(manha, [tarde])).toContain('conflito');
  });
  it('mesmo dia sem sobreposição é só informação', () => {
    const tarde = sessao({ data: '2026-10-29', chegada: '14:00', inicio: '14:30', fim: '18:00' });
    expect(alertasDaEscala(manha, [tarde])).toEqual(['mesmoDia']);
  });
  it('dia seguinte gera dias seguidos', () => {
    const amanha = sessao({ data: '2026-10-30' });
    expect(alertasDaEscala(manha, [amanha])).toContain('diasSeguidos');
  });
  it('sessão a definir no mesmo dia nunca é conflito', () => {
    const indefinida = sessao({ data: '2026-10-29', horarioADefinir: true, chegada: null, inicio: null, fim: null });
    expect(alertasDaEscala(indefinida, [manha])).toEqual(['mesmoDia']);
  });
  it('ignora a própria sessão', () => {
    expect(alertasDaEscala(manha, [manha])).toEqual([]);
  });
});
