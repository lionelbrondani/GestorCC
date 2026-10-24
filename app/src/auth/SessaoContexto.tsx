import type { Pessoa } from '@shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApi } from '../api/cliente';

export interface SessaoUsuario {
  pessoa: Pessoa;
  senhaInicial: boolean;
}

export type SessaoInicial = SessaoUsuario & { token: string };

interface ValorSessao {
  sessao: SessaoUsuario | null;
  entrar(email: string, senha: string): Promise<void>;
  sair(): void;
  marcarSenhaTrocada(): void;
  /** Atualiza o retrato da pessoa guardado na sessão (ex.: após mudar preferências no Perfil). */
  atualizarPessoa(p: Pessoa): void;
  /** Troca o token da sessão (ex.: depois de trocar a senha). */
  atualizarToken(token: string): void;
}

/** Disparado quando a API responde SESSAO: a sessão é encerrada e o app volta ao login. */
export const EVENTO_SESSAO_EXPIRADA = 'gestorcc:sessao-expirada';

const CHAVE = 'gestorcc-sessao';
const SessaoContexto = createContext<ValorSessao | null>(null);

function lerSalva(): SessaoInicial | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as SessaoInicial) : null;
  } catch {
    return null;
  }
}

function gravar(s: SessaoInicial | null) {
  try {
    if (s) sessionStorage.setItem(CHAVE, JSON.stringify(s));
    else sessionStorage.removeItem(CHAVE);
  } catch {
    // sem armazenamento: a sessão dura até recarregar a página
  }
}

export function SessaoProvedor({
  inicial,
  persistir = true,
  children,
}: {
  inicial?: SessaoInicial | null;
  persistir?: boolean;
  children: ReactNode;
}) {
  const api = useApi();
  const qc = useQueryClient();
  const [atual, setAtual] = useState<SessaoInicial | null>(() => {
    const s = inicial !== undefined ? inicial : persistir ? lerSalva() : null;
    api.definirToken(s?.token ?? null);
    return s;
  });

  const trocar = useCallback(
    (s: SessaoInicial | null) => {
      api.definirToken(s?.token ?? null);
      if (persistir) gravar(s);
      setAtual(s);
    },
    [api, persistir],
  );

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const r = await api.chamar('auth.entrar', { email, senha });
      qc.clear();
      trocar({ token: r.token, pessoa: r.pessoa, senhaInicial: r.senhaInicial });
    },
    [api, qc, trocar],
  );

  const sair = useCallback(() => {
    trocar(null);
    qc.clear();
  }, [qc, trocar]);

  const marcarSenhaTrocada = useCallback(() => {
    if (atual) trocar({ ...atual, senhaInicial: false });
  }, [atual, trocar]);

  const atualizarPessoa = useCallback(
    (p: Pessoa) => {
      if (atual) trocar({ ...atual, pessoa: p });
    },
    [atual, trocar],
  );

  const atualizarToken = useCallback(
    (token: string) => {
      if (atual) trocar({ ...atual, token });
    },
    [atual, trocar],
  );

  useEffect(() => {
    const expirou = () => {
      if (atual) sair();
    };
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, expirou);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, expirou);
  }, [atual, sair]);

  const valor = useMemo<ValorSessao>(
    () => ({
      sessao: atual ? { pessoa: atual.pessoa, senhaInicial: atual.senhaInicial } : null,
      entrar,
      sair,
      marcarSenhaTrocada,
      atualizarPessoa,
      atualizarToken,
    }),
    [atual, entrar, sair, marcarSenhaTrocada, atualizarPessoa, atualizarToken],
  );

  return <SessaoContexto.Provider value={valor}>{children}</SessaoContexto.Provider>;
}

export function useSessao(): ValorSessao {
  const v = useContext(SessaoContexto);
  if (!v) throw new Error('SessaoProvedor ausente.');
  return v;
}

/** Pessoa logada (use apenas dentro de rotas protegidas). */
export function useEu(): Pessoa {
  const { sessao } = useSessao();
  if (!sessao) throw new Error('Sem sessão.');
  return sessao.pessoa;
}
