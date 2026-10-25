/**
 * Ficha técnica do evento, preenchida pelo produtor pelo link do evento (sem login). As mesmas regras valem na
 * página do produtor, na API e na tela do gestor.
 */
import { somarDias } from './datas';
import { lugar } from './poltronas';
import type { DataISO, Id } from './tipos';

export const CAPACIDADE_TEATRO = 1170;
export const HORA_MINIMA_MONTAGEM = '08:30';
export const LINK_REGULAMENTO = 'https://www.ufsm.br/app/uploads/sites/403/2022/06/Regulamento-Interno-do-CC.pdf';

export const TIPOS_EVENTO_FICHA = ['Teatro', 'Música', 'Dança', 'Formatura', 'Outro'] as const;
export const VINCULOS_RESPONSAVEL = ['Contratante', 'Servidor da UFSM', 'Outro'] as const;
export const LOCAIS_FICHA = ['Palco', 'Foyer Principal', 'Foyer Mezanino'] as const;
export const DESTINOS_ALIMENTOS = ['Sesc Mesa Brasil', 'Centro de Apoio à Criança com Câncer', 'Banco de Alimentos', 'Centro de Convenções Distribui', 'Outro'] as const;
export const LOCAIS_COFFEE = ['Camarins', 'Corredor entre os Camarins', 'Foyer Principal (Público em Geral)'] as const;
export const MAX_CAMARINS_INDIVIDUAIS = 4;
export const MAX_CAMARINS_COLETIVOS = 2;
export const MAX_ANEXOS_FICHA = 5;

export type EtapaFicha = 'evento' | 'horarios' | 'responsavel' | 'espacos' | 'camarins' | 'poltronas' | 'coffee' | 'revisao';

export const ETAPAS_FICHA: { id: EtapaFicha; titulo: string }[] = [
  { id: 'evento', titulo: 'O evento' },
  { id: 'horarios', titulo: 'Horários' },
  { id: 'responsavel', titulo: 'Responsável e equipe' },
  { id: 'espacos', titulo: 'Espaços e público' },
  { id: 'camarins', titulo: 'Camarins' },
  { id: 'poltronas', titulo: 'Poltronas' },
  { id: 'coffee', titulo: 'Coffee break' },
  { id: 'revisao', titulo: 'Revisão e envio' },
];

export interface HorarioSessaoFicha {
  sessaoId: Id;
  portas: string;
  inicio: string;
  fim: string;
  intervalo: boolean | null;
  intervaloInicio: string;
  intervaloFim: string;
}

export interface ResponsavelFicha {
  vinculo: string;
  vinculoOutro: string;
  nome: string;
  /** CPF ou CNPJ. Fica na planilha Sigiloso. */
  documento: string;
  siapeMatricula: string;
  /** Fica na planilha Sigiloso. */
  email: string;
  /** Fica na planilha Sigiloso. */
  telefone: string;
}

export interface GrupoPoltronas {
  nome: string;
  /** Ids da planta (poltronas.ts), ex.: 'baixa:A01'. */
  lugares: string[];
}

export interface AnexoFicha {
  id: Id;
  nome: string;
}

export interface FichaTecnicaDados {
  tipo: string;
  tipoOutro: string;
  sinopse: string;
  anexos: AnexoFicha[];
  publico: number | null;
  elenco: number | null;
  /** 'AAAA-MM-DDTHH:MM'. */
  montagem: string;
  desmontagem: string;
  /** Uma linha por sessão do evento, na ordem das sessões. */
  sessoes: HorarioSessaoFicha[];
  responsavel: ResponsavelFicha;
  descricaoMontagem: string;
  /** Nomes da equipe de montagem para a portaria, um por linha. */
  equipeMontagem: string;
  locais: string[];
  sessaoFotos: boolean | null;
  leituraIngressos: boolean | null;
  ingressoSolidario: boolean | null;
  destinoAlimentos: string;
  destinoOutro: string;
  /** Um nome por camarim pedido (o tamanho da lista é a quantidade). */
  camarinsIndividuais: string[];
  camarinsColetivos: string[];
  reservarPoltronas: boolean | null;
  grupos: GrupoPoltronas[];
  observacoesPoltronas: string;
  coffeeBreak: boolean | null;
  coffeeLocal: string;
  coffeeCardapio: string;
  aceiteRegulamento: boolean;
}

export type TravaFicha = 'auto' | 'travada' | 'destravada';

/** Ficha como o gestor vê (com os dados sigilosos do responsável). */
export interface FichaTecnica {
  eventoId: Id;
  status: 'rascunho' | 'enviada';
  trava: TravaFicha;
  travada: boolean;
  /** Último dia em que o produtor pode mexer: 2 dias antes da primeira sessão. */
  prazo: DataISO | '';
  enviadaEm: string;
  atualizadoEm?: string;
  /** Chave do link do produtor (/ficha/<token>). */
  token: string;
  dados: FichaTecnicaDados;
}

export interface ErroFicha {
  etapa: EtapaFicha;
  campo: string;
  mensagem: string;
}

type SessaoBase = { id: Id; data: DataISO };

export function fichaVazia(sessoes: SessaoBase[]): FichaTecnicaDados {
  return {
    tipo: '', tipoOutro: '', sinopse: '', anexos: [], publico: null, elenco: null, montagem: '', desmontagem: '',
    sessoes: sessoes.map((s) => ({ sessaoId: s.id, portas: '', inicio: '', fim: '', intervalo: null, intervaloInicio: '', intervaloFim: '' })),
    responsavel: { vinculo: '', vinculoOutro: '', nome: '', documento: '', siapeMatricula: '', email: '', telefone: '' },
    descricaoMontagem: '', equipeMontagem: '', locais: [], sessaoFotos: null, leituraIngressos: null, ingressoSolidario: null,
    destinoAlimentos: '', destinoOutro: '', camarinsIndividuais: [], camarinsColetivos: [], reservarPoltronas: null, grupos: [],
    observacoesPoltronas: '', coffeeBreak: null, coffeeLocal: '', coffeeCardapio: '', aceiteRegulamento: false,
  };
}

// ——— limpeza do que vem de fora (página pública) ———

type Bruto = Record<string, unknown>;
const obj = (v: unknown): Bruto => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Bruto) : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const umDe = <T extends string>(v: unknown, opcoes: readonly T[]): T | '' => (opcoes.includes(v as T) ? (v as T) : '');
const simNao = (v: unknown) => (typeof v === 'boolean' ? v : null);
const inteiro = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), 100_000) : null);
const hora = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : '');
const dataHora = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : '');

/** Aceita só os campos e valores conhecidos, cortando textos longos; lugares inexistentes ou repetidos saem. */
export function limparFicha(bruto: unknown, sessoes: SessaoBase[]): FichaTecnicaDados {
  const b = obj(bruto);
  const r = obj(b.responsavel);
  const horarios = lista(b.sessoes).map(obj);
  const usados = new Set<string>();
  return {
    tipo: umDe(b.tipo, TIPOS_EVENTO_FICHA),
    tipoOutro: texto(b.tipoOutro, 80),
    sinopse: texto(b.sinopse, 5000),
    anexos: lista(b.anexos).map(obj).filter((a) => typeof a.id === 'string' && a.id).slice(0, MAX_ANEXOS_FICHA).map((a) => ({ id: String(a.id), nome: texto(a.nome, 120) })),
    publico: inteiro(b.publico),
    elenco: inteiro(b.elenco),
    montagem: dataHora(b.montagem),
    desmontagem: dataHora(b.desmontagem),
    sessoes: sessoes.map((s) => {
      const h = horarios.find((x) => x.sessaoId === s.id) ?? {};
      return {
        sessaoId: s.id, portas: hora(h.portas), inicio: hora(h.inicio), fim: hora(h.fim), intervalo: simNao(h.intervalo),
        intervaloInicio: hora(h.intervaloInicio), intervaloFim: hora(h.intervaloFim),
      };
    }),
    responsavel: {
      vinculo: umDe(r.vinculo, VINCULOS_RESPONSAVEL), vinculoOutro: texto(r.vinculoOutro, 80), nome: texto(r.nome, 120),
      documento: texto(r.documento, 30), siapeMatricula: texto(r.siapeMatricula, 20), email: texto(r.email, 120), telefone: texto(r.telefone, 30),
    },
    descricaoMontagem: texto(b.descricaoMontagem, 3000),
    equipeMontagem: texto(b.equipeMontagem, 3000),
    locais: LOCAIS_FICHA.filter((l) => lista(b.locais).includes(l)),
    sessaoFotos: simNao(b.sessaoFotos),
    leituraIngressos: simNao(b.leituraIngressos),
    ingressoSolidario: simNao(b.ingressoSolidario),
    destinoAlimentos: umDe(b.destinoAlimentos, DESTINOS_ALIMENTOS),
    destinoOutro: texto(b.destinoOutro, 120),
    camarinsIndividuais: lista(b.camarinsIndividuais).slice(0, MAX_CAMARINS_INDIVIDUAIS).map((x) => texto(x, 120)),
    camarinsColetivos: lista(b.camarinsColetivos).slice(0, MAX_CAMARINS_COLETIVOS).map((x) => texto(x, 120)),
    reservarPoltronas: simNao(b.reservarPoltronas),
    grupos: lista(b.grupos)
      .slice(0, 20)
      .map(obj)
      .map((g) => ({
        nome: texto(g.nome, 60),
        lugares: lista(g.lugares).filter((id): id is string => typeof id === 'string' && !!lugar(id) && !usados.has(id) && !!usados.add(id)),
      })),
    observacoesPoltronas: texto(b.observacoesPoltronas, 2000),
    coffeeBreak: simNao(b.coffeeBreak),
    coffeeLocal: umDe(b.coffeeLocal, LOCAIS_COFFEE),
    coffeeCardapio: texto(b.coffeeCardapio, 1000),
    aceiteRegulamento: b.aceiteRegulamento === true,
  };
}

// ——— validação ———

const vazio = (s: string) => !s.trim();
const digitos = (s: string) => s.replace(/\D/g, '').length;

/** Tudo o que falta ou está errado, etapa por etapa. Vazio = pode enviar. */
export function errosDaFicha(d: FichaTecnicaDados, sessoes: SessaoBase[]): ErroFicha[] {
  const erros: ErroFicha[] = [];
  const erro = (etapa: EtapaFicha, campo: string, mensagem: string) => void erros.push({ etapa, campo, mensagem });
  const simOuNao = (etapa: EtapaFicha, campo: string, v: boolean | null) => v === null && erro(etapa, campo, 'Responda sim ou não.');

  // o evento
  if (!d.tipo) erro('evento', 'tipo', 'Escolha o tipo do evento.');
  else if (d.tipo === 'Outro' && vazio(d.tipoOutro)) erro('evento', 'tipoOutro', 'Diga qual é o tipo do evento.');
  if (d.publico === null) erro('evento', 'publico', 'Informe a estimativa de público.');
  else if (d.publico > CAPACIDADE_TEATRO) erro('evento', 'publico', 'A capacidade do teatro é de 1.170 pessoas.');
  if (d.elenco === null) erro('evento', 'elenco', 'Informe quantas pessoas estão no elenco.');

  // horários
  const dataDe = (id: Id) => sessoes.find((s) => s.id === id)?.data ?? '';
  const comecos: string[] = [];
  const fins: string[] = [];
  d.sessoes.forEach((h, i) => {
    const c = (campo: string) => `sessoes.${i}.${campo}`;
    const data = dataDe(h.sessaoId);
    if (!h.portas) erro('horarios', c('portas'), 'Informe a abertura das portas.');
    if (!h.inicio) erro('horarios', c('inicio'), 'Informe o horário de início.');
    if (!h.fim) erro('horarios', c('fim'), 'Informe o horário de término.');
    if (h.portas && h.inicio && h.portas > h.inicio) erro('horarios', c('portas'), 'A abertura das portas deve ser antes do início.');
    const fimOk = !!h.inicio && !!h.fim && h.fim > h.inicio;
    if (h.inicio && h.fim && !fimOk) erro('horarios', c('fim'), 'O término deve ser depois do início.');
    if (h.portas || h.inicio) comecos.push(`${data}T${h.portas || h.inicio}`);
    if (h.fim) fins.push(`${data}T${h.fim}`);
    if (h.intervalo === null) erro('horarios', c('intervalo'), 'Informe se haverá intervalo.');
    if (h.intervalo) {
      const iniOk = !!h.intervaloInicio && (!fimOk || (h.intervaloInicio > h.inicio && h.intervaloInicio < h.fim));
      if (!h.intervaloInicio) erro('horarios', c('intervaloInicio'), 'Informe o começo do intervalo.');
      else if (!iniOk) erro('horarios', c('intervaloInicio'), 'O intervalo deve ficar entre o início e o término.');
      if (!h.intervaloFim) erro('horarios', c('intervaloFim'), 'Informe o fim do intervalo.');
      else if (iniOk && (h.intervaloFim <= h.intervaloInicio || (fimOk && h.intervaloFim > h.fim))) {
        erro('horarios', c('intervaloFim'), 'O fim do intervalo deve ser depois do começo e antes do término.');
      }
    }
  });
  if (!d.montagem) erro('horarios', 'montagem', 'Informe a data e o horário da montagem.');
  else if (d.montagem.slice(11) < HORA_MINIMA_MONTAGEM) erro('horarios', 'montagem', 'A entrada de materiais é liberada a partir das 8h30.');
  else if (comecos.length && d.montagem > comecos.sort()[0]) erro('horarios', 'montagem', 'A montagem deve começar antes da abertura das portas.');
  if (!d.desmontagem) erro('horarios', 'desmontagem', 'Informe a data e o horário da desmontagem.');
  else if (fins.length && d.desmontagem < fins.sort()[fins.length - 1]) erro('horarios', 'desmontagem', 'A desmontagem deve ser depois do término da última sessão.');

  // responsável e equipe
  const r = d.responsavel;
  if (!r.vinculo) erro('responsavel', 'responsavel.vinculo', 'Escolha o vínculo do responsável.');
  else if (r.vinculo === 'Outro' && vazio(r.vinculoOutro)) erro('responsavel', 'responsavel.vinculoOutro', 'Diga qual é o vínculo.');
  else if (r.vinculo === 'Servidor da UFSM' && vazio(r.siapeMatricula)) erro('responsavel', 'responsavel.siapeMatricula', 'Informe o SIAPE ou a matrícula.');
  if (vazio(r.nome)) erro('responsavel', 'responsavel.nome', 'Informe o nome do responsável.');
  if (![11, 14].includes(digitos(r.documento))) erro('responsavel', 'responsavel.documento', 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) erro('responsavel', 'responsavel.email', 'Informe um e-mail válido.');
  if (digitos(r.telefone) < 10) erro('responsavel', 'responsavel.telefone', 'Informe o telefone com DDD.');
  if (vazio(d.descricaoMontagem)) erro('responsavel', 'descricaoMontagem', 'Conte o que será montado (cenário, painéis, equipamentos).');

  // espaços e público
  if (!d.locais.length) erro('espacos', 'locais', 'Escolha pelo menos um local.');
  simOuNao('espacos', 'sessaoFotos', d.sessaoFotos);
  simOuNao('espacos', 'leituraIngressos', d.leituraIngressos);
  simOuNao('espacos', 'ingressoSolidario', d.ingressoSolidario);
  if (d.ingressoSolidario) {
    if (!d.destinoAlimentos) erro('espacos', 'destinoAlimentos', 'Escolha o destino dos alimentos.');
    else if (d.destinoAlimentos === 'Outro' && vazio(d.destinoOutro)) erro('espacos', 'destinoOutro', 'Diga qual é o destino dos alimentos.');
  }

  // camarins
  d.camarinsIndividuais.forEach((n, i) => vazio(n) && erro('camarins', `camarinsIndividuais.${i}`, 'Identifique o camarim.'));
  d.camarinsColetivos.forEach((n, i) => vazio(n) && erro('camarins', `camarinsColetivos.${i}`, 'Identifique o camarim.'));

  // poltronas
  simOuNao('poltronas', 'reservarPoltronas', d.reservarPoltronas);
  if (d.reservarPoltronas) {
    if (!d.grupos.some((g) => g.lugares.length)) erro('poltronas', 'grupos', 'Marque pelo menos uma poltrona no mapa.');
    d.grupos.forEach((g, i) => g.lugares.length && vazio(g.nome) && erro('poltronas', `grupos.${i}.nome`, 'Dê um nome ao grupo.'));
  }

  // coffee break
  simOuNao('coffee', 'coffeeBreak', d.coffeeBreak);
  if (d.coffeeBreak) {
    if (!d.coffeeLocal) erro('coffee', 'coffeeLocal', 'Escolha onde será o coffee break.');
    if (vazio(d.coffeeCardapio)) erro('coffee', 'coffeeCardapio', 'Conte o que será servido.');
  }

  if (!d.aceiteRegulamento) erro('revisao', 'aceiteRegulamento', 'É preciso declarar a leitura do regulamento.');
  return erros;
}

// ——— prazo ———

/** Último dia para o produtor mexer: 2 dias antes da primeira sessão ('' sem sessões). */
export function prazoDaFicha(datas: DataISO[]): DataISO | '' {
  if (!datas.length) return '';
  return somarDias([...datas].sort()[0], -2);
}

export function fichaTravada(o: { trava: TravaFicha; prazo: DataISO | ''; hoje: DataISO }): boolean {
  if (o.trava === 'travada') return true;
  if (o.trava === 'destravada') return false;
  return !!o.prazo && o.hoje > o.prazo;
}

/** O que a página do produtor recebe: só o evento dele e a própria ficha. */
export interface FichaPublica {
  evento: { nome: string; sessoes: { id: Id; data: DataISO; rotulo: string; inicio: string | null; fim: string | null }[] };
  status: FichaTecnica['status'];
  travada: boolean;
  prazo: DataISO | '';
  enviadaEm: string;
  dados: FichaTecnicaDados;
  /** Link do folder (Configurações → links com "Folder" no nome); '' sem link. */
  linkFolder: string;
}
