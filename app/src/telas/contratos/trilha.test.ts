import type { Contrato } from '@shared';
import { describe, expect, it } from 'vitest';
import { etapasDoContrato } from './trilha';

const base = {
  statusContrato: 'Assinado', statusFatura: 'Paga', statusEcad: 'Isento', statusIss: 'Pago', statusFundep: 'Ok', statusCortesias: 'Distribuídas',
} as Contrato;

const estados = (c: Partial<Contrato>, alertas: string[] = []) => etapasDoContrato({ ...base, ...c }, alertas as never).map((e) => [e.id, e.estado]);

describe('trilha do contrato', () => {
  it('seis etapas, na ordem, com o estado de cada uma', () => {
    expect(estados({})).toEqual([
      ['contrato', 'feito'], ['fatura', 'feito'], ['ecad', 'isento'], ['iss', 'feito'], ['fundep', 'feito'], ['cortesias', 'feito'],
    ]);
  });

  it('não enviado é pendente; enviado ou aguardando pagamento está em andamento', () => {
    expect(estados({ statusFatura: 'Não enviada p/ emissão', statusEcad: 'Enviado p/ processamento', statusIss: 'Não pago', statusCortesias: 'Não recebidas' }))
      .toEqual(expect.arrayContaining([['fatura', 'pendente'], ['ecad', 'andamento'], ['iss', 'andamento'], ['cortesias', 'pendente']]));
  });

  it('alertas viram atenção ou atraso na etapa certa', () => {
    expect(estados({ statusFatura: 'Não paga' }, ['faturaVencida'])).toContainEqual(['fatura', 'atrasado']);
    expect(estados({ statusFatura: 'Não paga' }, ['faturaVencendo'])).toContainEqual(['fatura', 'atencao']);
    expect(estados({ statusContrato: 'Enviado' }, ['naoAssinado'])).toContainEqual(['contrato', 'atencao']);
    expect(estados({ statusEcad: 'Não enviado', statusIss: 'Isento' }, ['ecadIssPendente'])).toEqual(expect.arrayContaining([['ecad', 'atencao'], ['iss', 'isento']]));
    expect(estados({ statusCortesias: 'Não recebidas' }, ['cortesiasPendentes'])).toContainEqual(['cortesias', 'atencao']);
  });

  it('contrato cancelado fica todo apagado', () => {
    expect(estados({ statusContrato: 'Cancelado', statusFatura: 'Não paga' }).every(([, e]) => e === 'cancelado')).toBe(true);
  });
});
