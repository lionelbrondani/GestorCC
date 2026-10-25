// Portas em memória, usadas nos testes da API.
import { ErroApi } from '@shared';
import type { AgendaGoogle, Cache, EventoAgenda, FormatoAba, NomeTabela, Planilha, Propriedades, Relogio, Repositorio, Trava } from '../nucleo/portas';

type Registro = { id: string } & Record<string, unknown>;

const copiar = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function relogioFixo(inicio: string): Relogio & { avancarMinutos(m: number): void; definir(agora: string): void } {
  // 'AAAA-MM-DDTHH:MM' tratado como horário local de São Paulo (UTC-3, sem horário de verão).
  let ms = Date.parse(`${inicio}:00-03:00`);
  const formatar = (x: number) => new Date(x - 3 * 3600_000).toISOString().slice(0, 16);
  const texto = () => formatar(ms);
  return {
    formatar,
    agoraMs: () => ms,
    agora: () => texto(),
    hoje: () => texto().slice(0, 10),
    avancarMinutos(m) {
      ms += m * 60_000;
    },
    definir(agora) {
      ms = Date.parse(`${agora}:00-03:00`);
    },
  };
}

export function criarRepositorioMemoria(
  inicial: Partial<Record<NomeTabela, Registro[]>> = {},
  relogio: Relogio = relogioFixo('2026-10-24T10:00'),
  abasLivres: Partial<Record<string, Record<string, unknown>[]>> = {},
): Repositorio & { dump(): Partial<Record<NomeTabela, Registro[]>>; abaLivre(planilha: Planilha, aba: string): string[][] | undefined; abaFormato(planilha: Planilha, aba: string): FormatoAba | undefined } {
  const dados: Partial<Record<NomeTabela, Registro[]>> = copiar(inicial);
  const tabela = (t: NomeTabela) => (dados[t] ??= []);
  const escritas = new Map<string, string[][]>();
  const formatos = new Map<string, FormatoAba | undefined>();
  const repo = {
    quem: '',
    listar<T extends { id: string }>(t: NomeTabela): T[] {
      return copiar(tabela(t)) as unknown as T[];
    },
    inserir<T extends { id: string }>(t: NomeTabela, r: T) {
      if (tabela(t).some((x) => x.id === r.id)) throw new Error(`Registro repetido em ${t}: ${r.id}`);
      const agora = relogio.agora();
      tabela(t).push({ ...copiar(r), criadoEm: agora, atualizadoEm: agora, atualizadoPor: repo.quem } as unknown as Registro);
    },
    atualizar<T extends { id: string }>(t: NomeTabela, r: T) {
      const i = tabela(t).findIndex((x) => x.id === r.id);
      if (i < 0) throw new Error(`Registro inexistente em ${t}: ${r.id}`);
      const criadoEm = tabela(t)[i].criadoEm;
      tabela(t)[i] = { ...copiar(r), criadoEm, atualizadoEm: relogio.agora(), atualizadoPor: repo.quem } as unknown as Registro;
    },
    remover(t: NomeTabela, id: string) {
      dados[t] = tabela(t).filter((x) => x.id !== id);
    },
    definirAutor(pessoaId: string) {
      repo.quem = pessoaId;
    },
    lerAbaLivre(planilha: Planilha, aba: string) {
      return copiar(abasLivres[`${planilha}:${aba}`] ?? []);
    },
    escreverAbaLivre(planilha: Planilha, aba: string, linhas: string[][], formato?: FormatoAba) {
      formatos.set(`${planilha}:${aba}`, formato);
      escritas.set(`${planilha}:${aba}`, copiar(linhas));
    },
    /** Só nos testes: o que foi escrito numa aba livre. */
    abaLivre: (planilha: Planilha, aba: string): string[][] | undefined => escritas.get(`${planilha}:${aba}`),
    /** Só nos testes: o formato pedido para uma aba livre. */
    abaFormato: (planilha: Planilha, aba: string): FormatoAba | undefined => formatos.get(`${planilha}:${aba}`),
    dump: () => copiar(dados),
  };
  return repo;
}

export function cacheMemoria(): Cache {
  const m = new Map<string, string>();
  return { obter: (k) => m.get(k) ?? null, guardar: (k, v) => void m.set(k, v) };
}

export function travaMemoria(): Trava {
  return { executar: (fn) => fn() };
}

export function travaOcupada(): Trava {
  return {
    executar() {
      throw new ErroApi('SISTEMA_OCUPADO', 'O sistema está ocupado. Tente de novo em alguns segundos.');
    },
  };
}

export function propriedadesMemoria(inicial: Record<string, string> = {}): Propriedades {
  const m = new Map(Object.entries(inicial));
  return { obter: (k) => m.get(k) ?? null, definir: (k, v) => void m.set(k, v) };
}

/** Agenda Google de mentira: guarda os eventos num Map; `falhar` simula o Google fora do ar. */
export function agendaMemoria(ligada = true): AgendaGoogle & { eventos: Map<string, EventoAgenda>; falhar: boolean } {
  const eventos = new Map<string, EventoAgenda>();
  let seq = 0;
  const agenda = {
    eventos,
    falhar: false,
    ligada: () => ligada,
    salvar(id: string | null, evento: EventoAgenda) {
      if (agenda.falhar) throw new Error('Google Agenda fora do ar');
      const final = id && eventos.has(id) ? id : `g${++seq}`;
      eventos.set(final, evento);
      return final;
    },
    remover(id: string) {
      if (agenda.falhar) throw new Error('Google Agenda fora do ar');
      eventos.delete(id);
    },
  };
  return agenda;
}
