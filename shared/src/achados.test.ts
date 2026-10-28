import { describe, expect, it } from 'vitest';
import { erroDaSaida, erroDoAchado, limparAchado, prazoDoAchado, textoPrazoAchado } from './achados';

describe('achados e perdidos: dias guardado e prazo para descartar', () => {
  it('conta os dias desde que foi achado e quantos faltam para o prazo', () => {
    expect(prazoDoAchado('2026-10-08', '2026-10-24', 90)).toEqual({ dias: 16, faltam: 74, vencido: false, descartarEm: '2027-01-06' });
  });

  it('o prazo vence no dia em que o item completa os 90 dias', () => {
    expect(prazoDoAchado('2026-07-27', '2026-10-24', 90)).toMatchObject({ dias: 89, faltam: 1, vencido: false });
    expect(prazoDoAchado('2026-07-26', '2026-10-24', 90)).toMatchObject({ dias: 90, faltam: 0, vencido: true });
  });

  it('texto curto para a lista', () => {
    expect(textoPrazoAchado('2026-10-08', '2026-10-24', 90)).toBe('guardado há 16 dias · pode descartar em 74 dias');
    expect(textoPrazoAchado('2026-10-23', '2026-10-24', 90)).toBe('guardado há 1 dia · pode descartar em 89 dias');
    expect(textoPrazoAchado('2026-10-24', '2026-10-24', 90)).toBe('guardado desde hoje · pode descartar em 90 dias');
    expect(textoPrazoAchado('2026-07-20', '2026-10-24', 90)).toBe('guardado há 96 dias · prazo vencido, pode descartar');
  });
});

describe('achados e perdidos: o que se registra', () => {
  it('limpa o que vem da tela e exige descrição e uma data que já passou', () => {
    const d = limparAchado({ descricao: '  Guarda-chuva preto ', achadoEm: '2026-10-20', local: 'Plateia', eventoId: '', guardadoEm: ' Armário ', observacoes: 'x'.repeat(900) });
    expect(d).toEqual({ descricao: 'Guarda-chuva preto', achadoEm: '2026-10-20', local: 'Plateia', eventoId: null, guardadoEm: 'Armário', observacoes: 'x'.repeat(500) });
    expect(erroDoAchado(d, '2026-10-24')).toBeNull();
    expect(erroDoAchado({ ...d, descricao: '' }, '2026-10-24')).toBe('Descreva o item (ex.: guarda-chuva preto).');
    expect(erroDoAchado({ ...d, achadoEm: '' }, '2026-10-24')).toBe('Informe a data em que o item foi achado.');
    expect(erroDoAchado({ ...d, achadoEm: '2026-10-25' }, '2026-10-24')).toBe('A data em que foi achado não pode ser no futuro.');
  });

  it('a devolução pede quem retirou; a data da saída fica entre o dia em que foi achado e hoje', () => {
    const item = { achadoEm: '2026-10-20' };
    expect(erroDaSaida({ status: 'devolvido', data: '2026-10-24', retiradoPor: 'Maria Exemplo' }, item, '2026-10-24')).toBeNull();
    expect(erroDaSaida({ status: 'devolvido', data: '2026-10-24', retiradoPor: ' ' }, item, '2026-10-24')).toBe('Informe quem retirou o item.');
    expect(erroDaSaida({ status: 'descartado', data: '2026-10-19' }, item, '2026-10-24')).toBe('A data não pode ser antes de o item ser achado.');
    expect(erroDaSaida({ status: 'descartado', data: '2026-10-25' }, item, '2026-10-24')).toBe('A data não pode ser no futuro.');
    expect(erroDaSaida({ status: 'descartado', data: '2026-10-24' }, item, '2026-10-24')).toBeNull();
    expect(erroDaSaida({ status: 'guardado', data: '' }, item, '2026-10-24')).toBeNull();
  });
});
