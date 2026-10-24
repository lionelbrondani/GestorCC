import { diasDoMes, type ContextoEscala } from '@shared';
import { useMemo } from 'react';
import { usePeriodo, usePessoas } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';

export const INVALIDAR_ESCALAS = ['escalas.listar', 'eventos.listar', 'disponibilidades.listar', 'rodadas.listar', 'historico.listar'] as const;

/** Tudo que as telas de escala precisam para um mês 'AAAA-MM'. */
export function useDadosEscalas(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  const dias = diasDoMes(ano, m);
  const de = dias[0];
  const ate = dias[dias.length - 1];
  const periodo = usePeriodo(de, ate);
  const pessoas = usePessoas();
  const escalas = useConsulta('escalas.listar', { de, ate });
  const rodadas = useConsulta('rodadas.listar', null);
  const sessaoIds = periodo.sessoes.map((s) => s.id);
  const disp = useConsulta('disponibilidades.listar', { sessaoIds }, { habilitada: !periodo.isLoading });

  const carregando = periodo.isLoading || pessoas.isLoading || escalas.isLoading || rodadas.isLoading || disp.isLoading;

  const sessoesOrdenadas = useMemo(
    () => [...periodo.sessoes].sort((a, b) => a.data.localeCompare(b.data) || (a.chegada ?? '99').localeCompare(b.chegada ?? '99')),
    [periodo.sessoes],
  );

  const ctxBase: Omit<ContextoEscala, 'escalas'> = {
    pessoas: pessoas.lista.filter((p) => p.ativo),
    sessoes: periodo.sessoes,
    disponibilidades: disp.data ?? [],
  };

  return {
    carregando,
    de,
    ate,
    periodo,
    pessoas,
    sessoes: sessoesOrdenadas,
    escalas: escalas.data ?? [],
    rodadas: rodadas.data ?? [],
    disponibilidades: disp.data ?? [],
    ctxBase,
  };
}

export async function copiarTexto(texto: string, html?: string): Promise<boolean> {
  try {
    if (html && 'ClipboardItem' in window) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([texto], { type: 'text/plain' }) }),
      ]);
    } else {
      await navigator.clipboard.writeText(texto);
    }
    return true;
  } catch {
    return false;
  }
}
