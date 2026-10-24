import type { DataISO, Evento, Pessoa, Sessao } from '@shared';
import { useMemo } from 'react';
import { useConsulta } from './hooks';

/** Eventos e sessões do período, com índices para busca rápida. */
export function usePeriodo(de: DataISO, ate: DataISO) {
  const q = useConsulta('eventos.listar', { de, ate });
  return useMemo(() => {
    const eventos = q.data?.eventos ?? [];
    const sessoes = q.data?.sessoes ?? [];
    return {
      ...q,
      eventos,
      sessoes,
      evento: new Map<string, Evento>(eventos.map((e) => [e.id, e])),
      sessao: new Map<string, Sessao>(sessoes.map((s) => [s.id, s])),
    };
  }, [q]);
}

export function usePessoas() {
  const q = useConsulta('pessoas.listar', null);
  return useMemo(() => {
    const lista = q.data ?? [];
    return { ...q, lista, pessoa: new Map<string, Pessoa>(lista.map((p) => [p.id, p])) };
  }, [q]);
}
