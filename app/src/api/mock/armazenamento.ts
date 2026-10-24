import type {
  Aditivo,
  AlmoxItem,
  AlmoxMovimento,
  AlmoxPedido,
  Avaliacao,
  Aviso,
  Config,
  Contratante,
  Contrato,
  DadosPessoais,
  Disponibilidade,
  Escala,
  Evento,
  Feriado,
  Id,
  Lote,
  LoteItem,
  Notificacao,
  Pessoa,
  RegistroHistorico,
  Rodada,
  Sessao,
} from '@shared';
import { criarFixtures } from './fixtures';

export interface Banco {
  pessoas: Pessoa[];
  dadosPessoais: DadosPessoais[];
  senhas: Record<Id, { senha: string; inicial: boolean }>;
  eventos: Evento[];
  sessoes: Sessao[];
  feriados: Feriado[];
  rodadas: Rodada[];
  disponibilidades: Disponibilidade[];
  escalas: Escala[];
  avaliacoes: Avaliacao[];
  lotes: Lote[];
  loteItens: LoteItem[];
  envioExterno: { eventoId: Id; enviadoEm: string; campos: string[] }[];
  contratos: Contrato[];
  aditivos: Aditivo[];
  contratantes: Contratante[];
  almoxItens: AlmoxItem[];
  almoxMovimentos: AlmoxMovimento[];
  autorizadosExternos: string[];
  pedidos: AlmoxPedido[];
  avisos: Aviso[];
  notificacoes: Notificacao[];
  historico: RegistroHistorico[];
  config: Config;
}

const CHAVE = 'gestorcc-prototipo';
const VERSAO_BANCO = 1;

export interface Armazenamento {
  banco: Banco;
  salvar(): void;
  restaurar(): void;
}

export function criarArmazenamento(persistir: boolean, hoje: string): Armazenamento {
  let banco: Banco | null = null;
  if (persistir) {
    try {
      const bruto = localStorage.getItem(CHAVE);
      const lido = bruto ? (JSON.parse(bruto) as { versao: number; banco: Banco }) : null;
      if (lido?.versao === VERSAO_BANCO) banco = lido.banco;
    } catch {
      banco = null;
    }
  }

  const arm: Armazenamento = {
    banco: banco ?? criarFixtures(hoje),
    salvar() {
      if (!persistir) return;
      try {
        localStorage.setItem(CHAVE, JSON.stringify({ versao: VERSAO_BANCO, banco: arm.banco }));
      } catch {
        // armazenamento indisponível (aba anônima, cota): o protótipo segue só em memória
      }
    },
    restaurar() {
      arm.banco = criarFixtures(hoje);
      arm.salvar();
    },
  };
  return arm;
}
