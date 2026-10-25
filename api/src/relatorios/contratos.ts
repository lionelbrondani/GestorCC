import { formatarData, formatarReais, valorTotalContrato } from '@shared';
import { paraContrato, type LinhaAditivo, type LinhaContrato } from '../acoes/contratos';
import type { LinhaEvento, LinhaSessao } from '../acoes/eventos';
import type { Portas } from '../nucleo/portas';

const ordemNumero = (n: string) => {
  const m = /^(\d+)\/(\d{4})$/.exec(n);
  return m ? Number(m[2]) * 100000 + Number(m[1]) : Number.MAX_SAFE_INTEGER;
};

/** CONTRATOS (spec 11): a planilha de controle, só com a razão social do contratante (spec 9.1). */
export function escreverContratos(portas: Portas): string {
  const { repo } = portas;
  const aditivos = repo.listar<LinhaAditivo>('aditivos').map((a) => ({ ...a, valorDelta: Number(a.valorDelta) }));
  const eventos = repo.listar<LinhaEvento>('eventos');
  const sessoes = repo.listar<LinhaSessao>('sessoes');
  const contratantes = repo.listar<{ id: string; razaoSocial: string }>('contratantes');
  const contratos = repo.listar<LinhaContrato>('contratos').map(paraContrato).sort((a, b) => ordemNumero(a.numero) - ordemNumero(b.numero));
  const linhas = [
    ['Nº', 'EVENTO', 'DATA', 'CONTRATANTE', 'VALOR TOTAL', 'VENCIMENTO', 'CONTRATO', 'FATURA', 'Nº FATURA', 'ECAD', 'ISS', 'FUNDEP', 'CORTESIAS', 'FICHA TÉCNICA'],
    ...contratos.map((c) => {
      const data = sessoes.filter((s) => s.eventoId === c.eventoId).map((s) => s.data).sort()[0];
      return [
        c.numero, eventos.find((e) => e.id === c.eventoId)?.nome ?? '', data ? formatarData(data) : '', contratantes.find((k) => k.id === c.contratanteId)?.razaoSocial ?? '',
        formatarReais(valorTotalContrato(c, aditivos)), c.vencimento ? formatarData(c.vencimento) : '', c.statusContrato, c.statusFatura, c.numeroFatura,
        c.statusEcad, c.statusIss, c.statusFundep, c.statusCortesias, c.fichaTecnicaRecebida ? 'Recebida' : 'Não recebida',
      ];
    }),
  ];
  repo.escreverAbaLivre('relatorios', 'CONTRATOS', linhas);
  return 'CONTRATOS';
}
