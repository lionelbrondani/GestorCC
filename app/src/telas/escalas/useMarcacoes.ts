import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '../../api/cliente';

/** Espera depois do último clique antes de mandar as marcações juntas. */
export const ESPERA_MARCACOES_MS = 800;

export type EstadoMarcacoes = 'ocioso' | 'pendente' | 'salvando' | 'salvo' | 'erro';

/**
 * Marcações de disponibilidade que aparecem na hora e vão para a API juntas (uma gravação na planilha), pouco depois
 * do último clique ou ao fechar a tela. Sem `pessoaId`, marca as da própria pessoa.
 */
export function useMarcacoes(pessoaId?: string) {
  const api = useApi();
  const qc = useQueryClient();
  const [locais, setLocais] = useState<Map<string, boolean>>(new Map());
  const [estado, setEstado] = useState<EstadoMarcacoes>('ocioso');
  const [erro, setErro] = useState<string | null>(null);
  const fila = useRef(new Map<string, boolean>());
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alvo = useRef(pessoaId);

  const enviar = useCallback(async () => {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = null;
    if (!fila.current.size) return;
    const itens = [...fila.current].map(([sessaoId, disponivel]) => ({ sessaoId, disponivel }));
    const quem = alvo.current;
    fila.current = new Map();
    setEstado('salvando');
    try {
      await api.chamar('disponibilidades.marcarVarios', { pessoaId: quem, itens });
      await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'disponibilidades.listar' });
      setEstado(fila.current.size ? 'pendente' : 'salvo');
    } catch (e) {
      // volta as marcações que não foram gravadas
      setLocais((m) => {
        const n = new Map(m);
        for (const i of itens) n.delete(i.sessaoId);
        return n;
      });
      setErro((e as Error).message);
      setEstado('erro');
    }
  }, [api, qc]);

  // trocou a pessoa (ou saiu da tela): manda o que faltou e começa do zero
  useEffect(() => {
    alvo.current = pessoaId;
    return () => {
      void enviar();
      setLocais(new Map());
    };
  }, [pessoaId, enviar]);

  const marcar = useCallback(
    (itens: { sessaoId: string; disponivel: boolean }[]) => {
      setErro(null);
      setLocais((m) => {
        const n = new Map(m);
        for (const i of itens) n.set(i.sessaoId, i.disponivel);
        return n;
      });
      for (const i of itens) fila.current.set(i.sessaoId, i.disponivel);
      setEstado('pendente');
      if (relogio.current) clearTimeout(relogio.current);
      relogio.current = setTimeout(() => void enviar(), ESPERA_MARCACOES_MS);
    },
    [enviar],
  );

  const valor = (sessaoId: string, doServidor: boolean | undefined) => (locais.has(sessaoId) ? locais.get(sessaoId) : doServidor);
  return { marcar, valor, estado, erro, enviar };
}

export const TEXTO_ESTADO: Record<EstadoMarcacoes, string> = {
  ocioso: '',
  pendente: 'Salvando em instantes…',
  salvando: 'Salvando…',
  salvo: 'Salvo ✓',
  erro: '',
};
