/**
 * Dados de exemplo do protótipo. TODOS FICTÍCIOS: nomes, matrículas, CPFs, contas e e-mails
 * foram inventados e não correspondem a pessoas reais.
 */
import {
  autoPreencherPeriodo,
  MODELOS,
  type AlmoxItem,
  type AlmoxMovimento,
  type Aviso,
  type Config,
  type Contratante,
  type Contrato,
  type DadosPessoais,
  type Disponibilidade,
  type Escala,
  type Evento,
  type Feriado,
  type Lote,
  type LoteItem,
  type Ocorrencia,
  type Pessoa,
  type Sessao,
} from '@shared';
import type { Banco } from './armazenamento';

/** Gerador pseudoaleatório determinístico (os dados de exemplo são sempre os mesmos). */
function aleatorio(semente: number) {
  let s = semente;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function cpfFicticio(base: number): string {
  const d = String(base).padStart(9, '0').split('').map(Number);
  const dv = (nums: number[], peso: number) => {
    const r = (nums.reduce((acc, n, i) => acc + n * (peso - i), 0) * 10) % 11;
    return r === 10 ? 0 : r;
  };
  d.push(dv(d, 10));
  d.push(dv(d, 11));
  const s = d.join('');
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
}

function curto(nome: string): string {
  return nome.split(' ')[0].toUpperCase();
}

interface DefPessoa {
  nome: string;
  tipo: Pessoa['tipo'];
  vinculo: Pessoa['vinculo'];
  modelo: keyof typeof MODELOS;
  email?: string;
  matricula?: string;
  experiente?: boolean;
  escalarMenos?: boolean;
  nomeCurto?: string;
}

const DEF_PESSOAS: DefPessoa[] = [
  { nome: 'Marta Ribeiro', tipo: 'servidor', vinculo: 'fixo', modelo: 'gestor', email: 'gestor@ufsm.br', matricula: '1000000001' },
  { nome: 'Paulo Antunes', tipo: 'servidor', vinculo: 'fixo', modelo: 'gestor' },
  { nome: 'Sílvia Moraes', tipo: 'servidor', vinculo: 'fixo', modelo: 'gestor' },
  { nome: 'Rogério Dalla Costa', tipo: 'servidor', vinculo: 'fixo', modelo: 'operacao' },
  { nome: 'Tainá Cardoso', tipo: 'bolsista', vinculo: 'fixo', modelo: 'gestor', experiente: true },
  { nome: 'Bruno Lemos', tipo: 'bolsista', vinculo: 'fixo', modelo: 'gestor', experiente: true, escalarMenos: true },
  { nome: 'Camila Freitas', tipo: 'bolsista', vinculo: 'fixo', modelo: 'operacao', experiente: true, email: 'operacao@acad.ufsm.br', matricula: '2026000002' },
  { nome: 'Diego Souza', tipo: 'bolsista', vinculo: 'fixo', modelo: 'operacao', escalarMenos: true },
  { nome: 'Amanda Rocha', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual', email: 'bolsista@acad.ufsm.br', matricula: '2026000001' },
  { nome: 'Beatriz Lopes', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual', experiente: true },
  { nome: 'Caio Mendes', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Daniela Prado', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual', experiente: true },
  { nome: 'Eduardo Lima', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Fernanda Kist', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Gabriel Nunes', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual', experiente: true },
  { nome: 'Heloá Martins', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Helena Basso', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Igor Tavares', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Isabela Alves', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual', nomeCurto: 'ISABELA' },
  { nome: 'Isabela Vieira', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual', nomeCurto: 'ISABELA' },
  { nome: 'Júlia Fontana', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual', experiente: true },
  { nome: 'Kauã Pereira', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Larissa Melo', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Mateus Brum', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Natália Reis', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Otávio Pires', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Patrícia Zanini', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Rafael Costa', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Sofia Brandão', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
  { nome: 'Vitória Lunardi', tipo: 'bolsista', vinculo: 'eventual', modelo: 'eventual' },
];

const BANCOS = ['Banco do Brasil', 'Caixa Econômica Federal', 'Sicredi', 'Banrisul', 'Nubank'];

function criarPessoas(): { pessoas: Pessoa[]; dados: DadosPessoais[] } {
  const pessoas: Pessoa[] = [];
  const dados: DadosPessoais[] = [];
  DEF_PESSOAS.forEach((d, i) => {
    const id = `p${String(i + 1).padStart(2, '0')}`;
    const primeiro = d.nome.split(' ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const sobrenome = d.nome.split(' ').slice(-1)[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const matricula = d.matricula ?? (d.tipo === 'servidor' ? `10000000${String(i + 1).padStart(2, '0')}` : `20260000${String(i + 1).padStart(2, '0')}`);
    pessoas.push({
      id,
      nome: d.nome,
      nomeCurto: d.nomeCurto ?? curto(d.nome),
      emailAcademico: d.email ?? `${primeiro}.${sobrenome}@${d.tipo === 'servidor' ? 'ufsm.br' : 'acad.ufsm.br'}`,
      matricula,
      siape: d.tipo === 'servidor' ? `9${String(100000 + i * 37)}` : undefined,
      tipo: d.tipo,
      vinculo: d.vinculo,
      experiente: d.experiente ?? false,
      escalarMenos: d.escalarMenos ?? false,
      ativo: true,
      permissoes: { ...MODELOS[d.modelo] },
    });
    if (d.tipo === 'bolsista') {
      dados.push({
        pessoaId: id,
        cpf: cpfFicticio(100200300 + i * 7919),
        banco: BANCOS[i % BANCOS.length],
        agencia: String(1000 + i * 13),
        conta: `${10000 + i * 911}-${i % 10}`,
        camiseta: ['P', 'M', 'G'][i % 3],
      });
    }
  });
  return { pessoas, dados };
}

interface DefEvento {
  id: string;
  nome: string;
  tipo: Evento['tipo'];
  organizador: string;
  contato: string;
  pagamento?: Evento['pagamento'];
  pagador?: string;
  instrumento?: Evento['instrumento'];
  status?: Evento['status'];
  publico?: number;
  sessoes: { data: string; rotulo?: string; chegada: string | null; inicio: string | null; fim?: string | null; vagas?: number }[];
}

const DEF_EVENTOS: DefEvento[] = [
  { id: 'e01', nome: 'Coração de Potro', tipo: 'Show/Concerto', organizador: 'Produtora Pampa', contato: '(55) 90000-0101', publico: 780,
    sessoes: [{ data: '2026-10-02', chegada: '18:30', inicio: '20:00', fim: '22:00', vagas: 6 }] },
  { id: 'e02', nome: 'Nenhum de Nós', tipo: 'Show/Concerto', organizador: 'Som Sul Eventos', contato: '(55) 90000-0102', publico: 1020,
    sessoes: [{ data: '2026-10-03', chegada: '17:30', inicio: '19:30', fim: '22:00', vagas: 6 }] },
  { id: 'e03', nome: 'A Jornada do Dragão', tipo: 'Show/Concerto', organizador: 'Cia. Encanto', contato: '(55) 90000-0103', publico: 1500,
    sessoes: [
      { data: '2026-10-08', rotulo: 'Sessão 1', chegada: '13:00', inicio: '14:30', fim: '16:00', vagas: 4 },
      { data: '2026-10-09', rotulo: 'Sessão 2', chegada: '08:30', inicio: '10:00', fim: '11:30', vagas: 3 },
      { data: '2026-10-09', rotulo: 'Sessão 3', chegada: '12:30', inicio: '14:00', fim: '15:30', vagas: 5 },
    ] },
  { id: 'e04', nome: 'Bom pra Cachorro', tipo: 'Show/Concerto', organizador: 'Teatro do Abelardo', contato: '(55) 90000-0104', publico: 640,
    sessoes: [{ data: '2026-10-10', chegada: '13:30', inicio: '15:00', fim: '17:00', vagas: 6 }] },
  { id: 'e05', nome: 'Concerto BASM', tipo: 'Show/Concerto', organizador: 'Banda da Base Aérea', contato: '(55) 90000-0105', instrumento: 'termo', publico: 700,
    sessoes: [{ data: '2026-10-14', chegada: '18:30', inicio: '20:00', fim: '22:00', vagas: 8 }] },
  { id: 'e06', nome: 'A Bela e a Fera in Concert', tipo: 'Show/Concerto', organizador: 'Orquestra de Câmara', contato: '(55) 90000-0106', publico: 1800,
    sessoes: [
      { data: '2026-10-20', rotulo: 'Récita 1', chegada: '18:00', inicio: '19:30', fim: '22:00', vagas: 6 },
      { data: '2026-10-21', rotulo: 'Récita 2', chegada: '18:00', inicio: '19:30', fim: '22:00', vagas: 6 },
    ] },
  { id: 'e07', nome: 'O Corcunda de Notre Dame', tipo: 'Show/Concerto', organizador: 'Estúdio Cena', contato: '(55) 90000-0107', publico: 900,
    sessoes: [{ data: '2026-10-23', chegada: '18:30', inicio: '20:00', fim: '22:00', vagas: 6 }] },
  { id: 'e08', nome: 'Entrecenas', tipo: 'Show/Concerto', organizador: 'Grupo Tholl', contato: '(55) 90000-0108',
    sessoes: [{ data: '2026-10-24', chegada: '18:30', inicio: '20:00', fim: '22:00', vagas: 6 }] },
  { id: 'e09', nome: 'Evento PROGEP – Servidores', tipo: 'Corporativo', organizador: 'PROGEP/UFSM', contato: 'Ramal 0000', instrumento: 'termo',
    sessoes: [{ data: '2026-10-26', chegada: '12:45', inicio: '14:00', fim: '17:00', vagas: 4 }] },
  { id: 'e10', nome: 'Cidade da Advocacia', tipo: 'Congresso', organizador: 'Comissão organizadora', contato: '(55) 90000-0110',
    pagamento: 'externo', pagador: 'Organização da Cidade da Advocacia', instrumento: 'termo',
    sessoes: [
      { data: '2026-10-29', rotulo: 'Manhã', chegada: '08:00', inicio: '09:00', fim: '13:00', vagas: 4 },
      { data: '2026-10-29', rotulo: 'Tarde', chegada: '12:45', inicio: '14:00', fim: '18:00', vagas: 4 },
      { data: '2026-10-29', rotulo: 'Noite', chegada: '17:45', inicio: '19:00', fim: '23:00', vagas: 4 },
      { data: '2026-10-30', rotulo: 'Manhã', chegada: '08:00', inicio: '09:00', fim: '13:00', vagas: 4 },
      { data: '2026-10-30', rotulo: 'Tarde', chegada: '12:45', inicio: '14:00', fim: '18:00', vagas: 4 },
      { data: '2026-10-30', rotulo: 'Noite', chegada: '17:45', inicio: '19:00', fim: '23:00', vagas: 4 },
    ] },
  { id: 'e11', nome: 'Alunos em Modo Avião', tipo: 'Show/Concerto', organizador: 'Plauz Produções', contato: '(55) 90000-0111',
    sessoes: [
      { data: '2026-10-31', rotulo: '1ª sessão', chegada: '16:30', inicio: '18:00', fim: '19:30', vagas: 6 },
      { data: '2026-10-31', rotulo: '2ª sessão', chegada: '19:30', inicio: '21:00', fim: '22:30', vagas: 6 },
    ] },
  { id: 'e12', nome: 'JAI Jovem – Abertura', tipo: 'Congresso', organizador: 'PRPGP', contato: 'Ramal 0001', instrumento: 'termo',
    sessoes: [{ data: '2026-11-06', chegada: '13:00', inicio: '13:30', fim: '18:00', vagas: 5 }] },
  { id: 'e13', nome: 'Overdrive Duo', tipo: 'Show/Concerto', organizador: 'RS Music Shows', contato: '(51) 90000-0113',
    sessoes: [{ data: '2026-11-14', chegada: '19:00', inicio: '21:00', fim: '23:00', vagas: 6 }] },
  { id: 'e14', nome: 'No Movimento dos Anos 2000', tipo: 'Show/Concerto', organizador: 'Ritmo de Camobi', contato: '(55) 90000-0114',
    sessoes: [{ data: '2026-11-18', chegada: null, inicio: null, fim: null, vagas: 6 }] },
  { id: 'e15', nome: 'Rock in Concert', tipo: 'Show/Concerto', organizador: 'Starlight Produções', contato: '(55) 90000-0115', status: 'cancelado',
    sessoes: [{ data: '2026-11-19', chegada: '18:30', inicio: '20:00', fim: '22:30', vagas: 6 }] },
  { id: 'e16', nome: 'Coppélia', tipo: 'Show/Concerto', organizador: 'Ballet Escola', contato: '(55) 90000-0116',
    sessoes: [{ data: '2026-11-28', chegada: '18:30', inicio: '20:00', fim: '22:00', vagas: 8 }] },
  { id: 'e17', nome: 'Travessia', tipo: 'Show/Concerto', organizador: 'Espaço Revelle', contato: '(55) 90000-0117',
    sessoes: [{ data: '2026-11-30', chegada: '18:30', inicio: '20:00', fim: '22:00', vagas: 8 }] },
  { id: 'e18', nome: 'Formatura CCSH', tipo: 'Formatura', organizador: 'Comissão de formatura', contato: '(55) 90000-0118', instrumento: 'termo',
    sessoes: [
      { data: '2026-12-05', rotulo: 'Tarde', chegada: '13:00', inicio: '15:00', fim: '17:30', vagas: 8 },
      { data: '2026-12-05', rotulo: 'Noite', chegada: '17:30', inicio: '19:00', fim: '21:30', vagas: 8 },
    ] },
  { id: 'e19', nome: 'Concerto de Natal', tipo: 'Show/Concerto', organizador: 'Orquestra Sinfônica', contato: '(55) 90000-0119', instrumento: 'nenhum',
    sessoes: [{ data: '2026-12-12', chegada: '18:30', inicio: '20:00', fim: '22:00', vagas: 8 }] },
  { id: 'e20', nome: 'Espetáculo de Dança de Fim de Ano', tipo: 'Show/Concerto', organizador: 'Grand Pas Escola de Dança', contato: '(55) 90000-0120',
    sessoes: [{ data: '2026-12-19', chegada: '17:00', inicio: '19:00', fim: '21:30', vagas: 8 }] },
];

const FERIADOS_2026: Feriado[] = [
  { data: '2026-01-01', nome: 'Confraternização Universal' },
  { data: '2026-02-17', nome: 'Carnaval' },
  { data: '2026-04-03', nome: 'Sexta-feira Santa' },
  { data: '2026-04-21', nome: 'Tiradentes' },
  { data: '2026-05-01', nome: 'Dia do Trabalho' },
  { data: '2026-06-04', nome: 'Corpus Christi' },
  { data: '2026-09-07', nome: 'Independência do Brasil' },
  { data: '2026-10-12', nome: 'Nossa Senhora Aparecida' },
  { data: '2026-11-02', nome: 'Finados' },
  { data: '2026-11-15', nome: 'Proclamação da República' },
  { data: '2026-11-20', nome: 'Dia da Consciência Negra' },
  { data: '2026-12-25', nome: 'Natal' },
];

const ITENS_ALMOX: [string, string, string, number, number, number][] = [
  // [nome, categoria, unidade, valor (centavos), saldo, mínimo]
  ['Fita crepe 48mm', 'Expediente', 'Rolo', 690, 3, 6],
  ['Fita dupla face', 'Expediente', 'Rolo', 1250, 8, 4],
  ['Papel A4 (resma)', 'Expediente', 'Resma', 2890, 12, 10],
  ['Caneta esferográfica azul', 'Expediente', 'Unidade', 120, 40, 20],
  ['Marcador permanente', 'Expediente', 'Unidade', 450, 2, 5],
  ['Prancheta', 'Expediente', 'Unidade', 980, 6, 4],
  ['Envelope pardo A4', 'Expediente', 'Unidade', 85, 50, 20],
  ['Pilha AA', 'Elétrica', 'Unidade', 350, 10, 24],
  ['Pilha AAA', 'Elétrica', 'Unidade', 380, 30, 12],
  ['Bateria 9V', 'Elétrica', 'Unidade', 1590, 4, 6],
  ['Lâmpada LED 12W', 'Elétrica', 'Unidade', 1190, 18, 10],
  ['Extensão 10m', 'Elétrica', 'Unidade', 6490, 3, 2],
  ['Abraçadeira de nylon', 'Elétrica', 'Pacote', 1450, 5, 3],
  ['Fita isolante', 'Elétrica', 'Rolo', 590, 1, 4],
  ['Gaffer preto 50mm', 'Cenotécnica', 'Rolo', 8900, 2, 4],
  ['Fita fosforescente', 'Cenotécnica', 'Rolo', 5400, 3, 2],
  ['Corda de sisal', 'Cenotécnica', 'Metro', 290, 60, 20],
  ['Tecido preto (m)', 'Cenotécnica', 'Metro', 1890, 15, 10],
  ['Pregos 17x21', 'Cenotécnica', 'Kg', 2490, 2, 2],
  ['Parafuso sextavado', 'Cenotécnica', 'Caixa', 3290, 4, 2],
  ['Detergente', 'Limpeza', 'Frasco', 290, 20, 10],
  ['Água sanitária', 'Limpeza', 'Frasco', 490, 6, 8],
  ['Saco de lixo 100L', 'Limpeza', 'Pacote', 1890, 9, 6],
  ['Pano de chão', 'Limpeza', 'Unidade', 450, 12, 6],
  ['Álcool 70%', 'Limpeza', 'Litro', 990, 4, 6],
  ['Papel toalha', 'Limpeza', 'Fardo', 4290, 3, 4],
  ['Papel higiênico', 'Limpeza', 'Fardo', 5890, 7, 5],
  ['Sabonete líquido', 'Limpeza', 'Litro', 1290, 5, 4],
  ['Copo descartável 200ml', 'Copa', 'Pacote', 590, 30, 15],
  ['Café 500g', 'Copa', 'Pacote', 2190, 2, 4],
  ['Açúcar 1kg', 'Copa', 'Pacote', 490, 5, 3],
  ['Água mineral 500ml', 'Copa', 'Fardo', 1590, 8, 6],
  ['Guardanapo', 'Copa', 'Pacote', 390, 20, 10],
  ['Garrafa térmica', 'Copa', 'Unidade', 6990, 2, 1],
  ['Torneira de pressão', 'Hidráulica', 'Unidade', 4590, 1, 1],
  ['Veda rosca', 'Hidráulica', 'Rolo', 390, 6, 3],
  ['Reparo de descarga', 'Hidráulica', 'Unidade', 3290, 0, 2],
  ['Cola PVC', 'Hidráulica', 'Frasco', 1290, 2, 1],
  ['Placa de sinalização "Saída"', 'Outros', 'Unidade', 2590, 4, 2],
  ['Cordão de crachá', 'Outros', 'Unidade', 150, 80, 30],
];

function criarAlmox(hoje: string): { itens: AlmoxItem[]; movimentos: AlmoxMovimento[] } {
  const itens: AlmoxItem[] = ITENS_ALMOX.map(([nome, categoria, unidade, valor, saldo, minimo], i) => ({
    cod: String(1001 + i * 37).padStart(4, '0'),
    nomeAlmox: nome.toUpperCase(),
    nomeComum: nome,
    unidade,
    valor,
    categoria,
    qtdMinima: minimo,
    sala: i % 3 === 0 ? 'Depósito 1' : i % 3 === 1 ? 'Sala 308' : 'Coxia',
    status: 'Ativo',
    saldo,
  }));
  itens.push({ ...itens[0], cod: '0999', nomeAlmox: 'FITA ANTIGA DESCONTINUADA', nomeComum: '', status: 'Inativo', saldo: 0, qtdMinima: 0 });

  const movimentos: AlmoxMovimento[] = [];
  const rnd = aleatorio(42);
  itens.forEach((it, i) => {
    const saidas = it.status === 'Ativo' ? Math.floor(rnd() * 4) : 0;
    let total = 0;
    const quantidades = Array.from({ length: saidas }, () => 1 + Math.floor(rnd() * 3));
    quantidades.forEach((q) => (total += q));
    movimentos.push({
      id: `m${i}-0`, quando: '2026-08-01T09:00', tipo: 'ajuste', cod: it.cod, qtd: it.saldo + total,
      valorUnitario: it.valor, motivo: 'Saldo inicial importado',
    });
    quantidades.forEach((q, k) => {
      const mes = 8 + Math.floor(rnd() * 3);
      const dia = 1 + Math.floor(rnd() * 27);
      const quando = `2026-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T14:00`;
      movimentos.push({
        id: `m${i}-${k + 1}`, quando: quando < hoje ? quando : '2026-10-01T14:00', tipo: 'saida', cod: it.cod, qtd: -q,
        valorUnitario: it.valor, retiradoPorPessoaId: k % 2 ? 'p05' : 'p07', finalidade: 'Montagem de evento',
        eventoId: k % 2 ? 'e05' : undefined,
      });
    });
  });
  return { itens, movimentos };
}

function criarContratos(): { contratantes: Contratante[]; contratos: Contrato[] } {
  const k = (id: string, razao: string, doc: string): Contratante => ({
    id, razaoSocial: razao, documento: doc, inscricaoMunicipal: 'Isento', inscricaoEstadual: 'Isento',
    endereco: 'Rua dos Exemplos, 100, Centro, Santa Maria - RS', cep: '97000-000', representanteNome: 'Representante Fictício',
    email: `contato@${id}.exemplo.com`, contatoFaturaNome: 'Contato Financeiro', contatoFaturaEmail: `financeiro@${id}.exemplo.com`,
    contatoFaturaTelefone: '(55) 90000-0000',
  });
  const contratantes = [
    k('k1', 'ORQUESTRA DE CÂMARA EXEMPLO', '11.111.111/0001-11'),
    k('k2', 'ESTÚDIO CENA PRODUÇÕES LTDA', '22.222.222/0001-22'),
    k('k3', 'PLAUZ PRODUÇÕES EXEMPLO', '33.333.333/0001-33'),
    k('k4', 'RS MUSIC SHOWS EXEMPLO', '44.444.444/0001-44'),
    k('k5', 'BALLET ESCOLA EXEMPLO', '55.555.555/0001-55'),
    k('k6', 'ESPAÇO REVELLE EXEMPLO', '66.666.666/0001-66'),
  ];
  const base = {
    itemTabela: 'B.7', areas: ['Hall de entrada', 'Mezanino', 'Plateia', 'Palco', 'Camarins'], cortesiasQtd: 20,
    ingressoSolidario: 'Não possui' as const, fichaTecnicaRecebida: true, canceladoMotivo: '', observacoes: '', numeroFatura: '',
  };
  const contratos: Contrato[] = [
    { ...base, id: 'c1', numero: '17/2026', eventoId: 'e06', contratanteId: 'k1', processoPen: '23081.000017/2026-00', valorBase: 1050000,
      vencimento: '2026-10-10', statusContrato: 'Assinado', statusFatura: 'Paga', numeroFatura: '1100017', statusEcad: 'Pago', statusIss: 'Pago',
      statusFundep: 'Ok', statusCortesias: 'Recebidas', ingressoSolidario: 'CACC',
      observacoes: 'Aditivo ajustando as datas: 19 ensaio, 20 e 21 récitas.' },
    { ...base, id: 'c2', numero: '19/2026', eventoId: 'e07', contratanteId: 'k2', processoPen: '23081.000019/2026-00', valorBase: 500000,
      vencimento: '2026-10-16', statusContrato: 'Assinado', statusFatura: 'Paga', numeroFatura: '1100019', statusEcad: 'Isento', statusIss: 'Enviado p/ processamento',
      statusFundep: 'Ok', statusCortesias: 'Não recebidas' },
    { ...base, id: 'c3', numero: '21/2026', eventoId: 'e11', contratanteId: 'k3', processoPen: '23081.000021/2026-00', valorBase: 680000,
      vencimento: '2026-10-27', statusContrato: 'Assinado', statusFatura: 'Não paga', statusEcad: 'Não pago', statusIss: 'Não pago',
      statusFundep: 'Ok', statusCortesias: 'Não recebidas', observacoes: 'Tem aditivo: 1 sessão extra.' },
    { ...base, id: 'c4', numero: '23/2026', eventoId: 'e13', contratanteId: 'k4', processoPen: '23081.000023/2026-00', valorBase: 630000,
      vencimento: '2026-11-04', statusContrato: 'Assinado', statusFatura: 'Não enviada p/ emissão', statusEcad: 'Não enviado', statusIss: 'Não enviado',
      statusFundep: 'Ok', statusCortesias: 'Não recebidas', cortesiasQtd: 70 },
    { ...base, id: 'c5', numero: '33/2026', eventoId: 'e16', contratanteId: 'k5', processoPen: '23081.000033/2026-00', valorBase: 500000,
      vencimento: '2026-11-20', statusContrato: 'Enviado ao PEN-SIE', statusFatura: 'Não enviada p/ emissão', statusEcad: 'Não enviado', statusIss: 'Não enviado',
      statusFundep: 'Enviado', statusCortesias: 'Não recebidas', fichaTecnicaRecebida: false },
    { ...base, id: 'c6', numero: '34/2026', eventoId: 'e17', contratanteId: 'k6', processoPen: '23081.000034/2026-00', valorBase: 600000,
      vencimento: '2026-11-21', statusContrato: 'Enviado', statusFatura: 'Não enviada p/ emissão', statusEcad: 'Não enviado', statusIss: 'Não enviado',
      statusFundep: 'Não enviado', statusCortesias: 'Não recebidas', fichaTecnicaRecebida: false },
  ];
  return { contratantes, contratos };
}

function criarOcorrencias(): { ocorrencias: Ocorrencia[]; pendentes: Banco['respostasFormularioInfra'] } {
  const base = { foto: null, chamadoNumero: '', chamadoLink: '', chamadoAbertoEm: null, resolvidaEm: null } as const;
  const h = (quando: string, de: Ocorrencia['status'] | null, para: Ocorrencia['status'], observacao = '', quemId = 'p02') => ({ quando, quemId, de, para, observacao });
  const ocorrencias: Ocorrencia[] = [
    { ...base, id: 'oc1', numero: 1, titulo: 'Lâmpada queimada no camarim 2', descricao: 'Lâmpada do espelho, lado esquerdo.', categoria: 'Iluminação',
      local: 'Camarins', prioridade: 'baixa', status: 'resolvida', origem: 'app', relatorNome: 'Tainá Cardoso', relatorPessoaId: 'p05',
      criadaEm: '2026-10-02T16:10', resolvidaEm: '2026-10-03T10:00',
      historico: [h('2026-10-02T17:00', 'nova', 'analise'), h('2026-10-03T10:00', 'analise', 'resolvida', 'Trocada pela equipe com lâmpada do almoxarifado.')] },
    { ...base, id: 'oc2', numero: 2, titulo: 'Vazamento na pia do banheiro feminino do hall', descricao: 'Água escorrendo por baixo da pia, chão molhado.',
      categoria: 'Hidráulica', local: 'Banheiros', prioridade: 'alta', status: 'chamado', origem: 'formulario', relatorNome: 'Equipe de limpeza',
      relatorContato: 'limpeza@exemplo.com', criadaEm: '2026-10-07T09:30', chamadoNumero: '2026/004812', chamadoLink: 'https://exemplo.ufsm.br/chamados/004812',
      chamadoAbertoEm: '2026-10-08T11:00',
      historico: [h('2026-10-07T14:00', 'nova', 'analise'), h('2026-10-08T11:00', 'analise', 'chamado', 'Registro do sifão precisa de troca; pedido à manutenção.')] },
    { ...base, id: 'oc3', numero: 3, titulo: 'Ar-condicionado da sala VIP não gela', descricao: 'Liga, mas sai ar quente.', categoria: 'Ar-condicionado',
      local: 'Sala VIP', prioridade: 'media', status: 'atendimento', origem: 'formulario', relatorNome: 'Produção do evento', criadaEm: '2026-10-12T19:40',
      chamadoNumero: '2026/004990', chamadoLink: 'https://exemplo.ufsm.br/chamados/004990', chamadoAbertoEm: '2026-10-13T09:00',
      historico: [h('2026-10-13T08:30', 'nova', 'analise'), h('2026-10-13T09:00', 'analise', 'chamado'), h('2026-10-21T10:00', 'chamado', 'atendimento', 'Técnico veio, aguardando peça.')] },
    { ...base, id: 'oc4', numero: 4, titulo: 'Torneira pingando no camarim 1', descricao: '', categoria: 'Hidráulica', local: 'Camarins', prioridade: 'baixa',
      status: 'analise', origem: 'app', relatorNome: 'Camila Freitas', relatorPessoaId: 'p07', criadaEm: '2026-10-20T21:15',
      historico: [h('2026-10-21T09:00', 'nova', 'analise', 'Ver se tem reparo no almoxarifado.')] },
    { ...base, id: 'oc5', numero: 5, titulo: 'Poltrona quebrada na fileira K', descricao: 'Assento K-14 solto.', categoria: 'Mobiliário', local: 'Plateia',
      prioridade: 'media', status: 'nova', origem: 'app', relatorNome: 'Beatriz Lopes', relatorPessoaId: 'p10', criadaEm: '2026-10-23T22:40', eventoId: 'e07', historico: [] },
    { ...base, id: 'oc6', numero: 6, titulo: 'Infiltração no teto do mezanino', descricao: 'Mancha aumentando depois da chuva.', categoria: 'Civil (paredes, pisos, telhado)',
      local: 'Mezanino', prioridade: 'alta', status: 'chamado', origem: 'formulario', relatorNome: 'Segurança do prédio', criadaEm: '2026-10-19T08:00',
      chamadoNumero: '2026/005103', chamadoLink: 'https://exemplo.ufsm.br/chamados/005103', chamadoAbertoEm: '2026-10-20T10:30',
      historico: [h('2026-10-19T10:00', 'nova', 'analise'), h('2026-10-20T10:30', 'analise', 'chamado')] },
    { ...base, id: 'oc7', numero: 7, titulo: 'Interruptor solto na coxia', descricao: '', categoria: 'Elétrica', local: 'Coxias', prioridade: 'baixa',
      status: 'naoProcede', origem: 'formulario', relatorNome: 'Técnico de som (produção)', criadaEm: '2026-10-15T13:00', resolvidaEm: '2026-10-15T16:00',
      historico: [h('2026-10-15T16:00', 'nova', 'naoProcede', 'Já tinha sido fixado na véspera.')] },
    { ...base, id: 'oc8', numero: 8, titulo: 'Refletor piscando na vara 3', descricao: 'Durante o ensaio o refletor do centro piscou várias vezes.',
      categoria: 'Som e luz cênica', local: 'Palco', prioridade: 'media', status: 'nova', origem: 'formulario', relatorNome: 'Produção do evento',
      criadaEm: '2026-10-24T09:20', historico: [] },
  ];
  const pendentes: Banco['respostasFormularioInfra'] = [
    { ...base, titulo: 'Lâmpada queimada no banheiro masculino', descricao: 'Banheiro do mezanino, a do fundo.', categoria: 'Iluminação', local: 'Banheiros',
      prioridade: 'baixa', status: 'nova', origem: 'formulario', relatorNome: 'Público do evento', criadaEm: '2026-10-24T10:05' },
    { ...base, titulo: 'Porta de emergência emperrada', descricao: 'A barra antipânico da saída lateral esquerda não destrava.', categoria: 'Civil (paredes, pisos, telhado)',
      local: 'Plateia', prioridade: 'urgente', status: 'nova', origem: 'formulario', relatorNome: 'Brigada de incêndio', criadaEm: '2026-10-24T10:40' },
  ];
  return { ocorrencias, pendentes };
}

export function criarFixtures(hoje: string): Banco {
  const { pessoas, dados } = criarPessoas();
  const bolsistas = pessoas.filter((p) => p.tipo === 'bolsista');
  const servidores = pessoas.filter((p) => p.tipo === 'servidor');

  const eventos: Evento[] = [];
  const sessoes: Sessao[] = [];
  for (const d of DEF_EVENTOS) {
    eventos.push({
      id: d.id, nome: d.nome, tipo: d.tipo, organizador: d.organizador, contatoOrganizador: d.contato,
      servidorResponsavelId: servidores[Number(d.id.slice(1)) % servidores.length].id,
      publicoEstimado: d.publico ? Math.round(d.publico * 1.1) : undefined,
      publicoReal: d.sessoes[0].data < hoje ? d.publico : undefined,
      pagamento: d.pagamento ?? 'interno', pagadorExterno: d.pagador, instrumento: d.instrumento ?? 'contrato',
      status: d.status ?? 'ativo',
    });
    d.sessoes.forEach((s, i) => {
      const dezembro = s.data >= '2026-12-01';
      sessoes.push({
        id: `${d.id}s${i + 1}`, eventoId: d.id, data: s.data, rotulo: s.rotulo, chegada: s.chegada, inicio: s.inicio,
        fim: s.fim ?? null, horarioADefinir: s.chegada === null, vagasBolsistas: s.vagas ?? 8, vagasServidores: 1,
        diaria: d.id === 'e06' ? 10000 : null, minimoExperientes: 1,
        status: d.status === 'cancelado' ? 'cancelada' : 'ativa',
        publicadaEm: dezembro ? null : '2026-09-28T10:00', convocacao: null,
      });
    });
  }

  // Disponibilidade: todos responderam outubro/novembro; dezembro ainda aberto (parte respondeu).
  const rnd = aleatorio(7);
  const disponibilidades: Disponibilidade[] = [];
  for (const s of sessoes) {
    const dezembro = s.data >= '2026-12-01';
    for (const p of [...bolsistas, ...servidores]) {
      const respondeu = !dezembro || Number(p.id.slice(1)) % 3 !== 0;
      if (!respondeu || (p.id === 'p09' && dezembro)) continue;
      disponibilidades.push({ pessoaId: p.id, sessaoId: s.id, disponivel: rnd() < 0.6, origem: 'proprio' });
    }
  }

  // Escalas de outubro e novembro geradas pelas próprias regras do sistema.
  const publicadas = sessoes.filter((s) => s.publicadaEm);
  const escolhas = autoPreencherPeriodo(
    publicadas.map((s) => s.id),
    { pessoas, sessoes, escalas: [], disponibilidades },
  );
  const escalas: Escala[] = [];
  const statusPara = (s: Sessao): Escala['status'] => {
    if (s.status === 'cancelada') return 'cancelado';
    if (s.data < hoje && s.data < '2026-10-23') return 'realizado';
    return 'publicado';
  };
  escolhas.forEach(({ sessaoId, pessoaId }, i) => {
    const s = sessoes.find((x) => x.id === sessaoId)!;
    escalas.push({ id: `x${i + 1}`, sessaoId, pessoaId, papel: 'bolsista', status: statusPara(s), adicaoDireta: false, loteId: null });
  });
  publicadas.forEach((s, i) => {
    escalas.push({
      id: `xs${i + 1}`, sessaoId: s.id, pessoaId: servidores[i % servidores.length].id, papel: 'servidor',
      status: statusPara(s), adicaoDireta: false, loteId: null,
    });
  });
  // Uma falta registrada para exemplo.
  const falta = escalas.find((e) => e.sessaoId === 'e04s1' && e.papel === 'bolsista');
  if (falta) falta.status = 'faltou';

  // Lotes: um pago (e01, e02) e um enviado (e03, e04).
  const lotes: Lote[] = [
    { id: 'L1', titulo: 'Lote 2026-10 #1', periodoReferencia: 'OUTUBRO/2026 – eventos de 02/10/2026 até 03/10/2026',
      edital: 'Edital 000/2026 (exemplo)', iniciativa: 'Iniciativa Estratégica Arte e Cultura', incluirZerados: true,
      status: 'pago', criadoEm: '2026-10-05T10:00', pagoEm: '2026-10-15' },
    { id: 'L2', titulo: 'Lote 2026-10 #2', periodoReferencia: 'OUTUBRO/2026 – eventos de 08/10/2026 até 10/10/2026',
      edital: 'Edital 000/2026 (exemplo)', iniciativa: 'Iniciativa Estratégica Arte e Cultura', incluirZerados: true,
      status: 'enviado', criadoEm: '2026-10-16T10:00', pagoEm: null },
  ];
  const loteItens: LoteItem[] = [];
  const noLote = (loteId: string, eventoIds: string[]) => {
    for (const e of escalas) {
      const s = sessoes.find((x) => x.id === e.sessaoId)!;
      if (eventoIds.includes(s.eventoId) && e.status === 'realizado' && e.papel === 'bolsista') {
        e.loteId = loteId;
        loteItens.push({ loteId, escalaId: e.id, pessoaId: e.pessoaId, valor: s.diaria ?? 8000 });
      }
    }
  };
  noLote('L1', ['e01', 'e02']);
  noLote('L2', ['e03', 'e04']);

  const { contratantes, contratos } = criarContratos();
  const { itens, movimentos } = criarAlmox(hoje);
  const { ocorrencias, pendentes } = criarOcorrencias();
  // Lâmpada usada na ocorrência #1 (resolvida pela equipe com material do almoxarifado).
  const lampada = itens.find((i) => i.nomeComum === 'Lâmpada LED 12W')!;
  const ajusteLampada = movimentos.find((m) => m.cod === lampada.cod && m.tipo === 'ajuste')!;
  ajusteLampada.qtd += 1;
  movimentos.push({ id: 'm-oc1', quando: '2026-10-03T10:00', tipo: 'saida', cod: lampada.cod, qtd: -1, valorUnitario: lampada.valor,
    retiradoPorPessoaId: 'p02', finalidade: 'Ocorrência #1', ocorrenciaId: 'oc1' });

  const avisos: Aviso[] = [
    { id: 'a1', titulo: 'Uniforme nos eventos', texto: 'Lembrem de vir de camiseta preta e calça escura em todos os eventos. Crachá é obrigatório.',
      publico: 'bolsistas', pessoasIds: [], fixado: true, validoAte: null, pedeConfirmacao: true, autorId: 'p01', criadoEm: '2026-10-01T09:00', leituras: ['p10', 'p12'] },
    { id: 'a2', titulo: 'Reunião de equipe', texto: 'Reunião geral na sala 308 na segunda-feira, 26/10, às 10h.',
      publico: 'gestores', pessoasIds: [], fixado: false, validoAte: '2026-10-26', pedeConfirmacao: false, autorId: 'p01', criadoEm: '2026-10-20T15:00', leituras: [] },
    { id: 'a3', titulo: 'Disponibilidade de dezembro aberta', texto: 'Marquem a disponibilidade de dezembro no GestorCC até 25/11.',
      publico: 'todos', pessoasIds: [], fixado: false, validoAte: '2026-11-25', pedeConfirmacao: false, autorId: 'p05', criadoEm: '2026-10-22T11:00', leituras: [] },
  ];

  const config: Config = {
    diariaPadrao: 8000, vagasBolsistasPadrao: 8, vagasServidoresPadrao: 1, minimoExperientesPadrao: 1,
    edital: 'Edital 000/2026 (exemplo)', iniciativa: 'Iniciativa Estratégica Arte e Cultura', projetoFundep: '30055',
    destinatariosFundep: ['faturamento@fundep.exemplo.com'],
    assinaturaEmail: 'Centro de Convenções - UFSM\nNúcleo de Gestão Artística e Cultural\nCoordenadoria de Cultura e Arte\nPró-Reitoria de Extensão - UFSM',
    limitePerguntasDia: 30,
    informacoesSetor: 'Teatro com 1.170 lugares (plateia baixa, alta e mezanino). Fica na Avenida Roraima, 1000, Camobi, Santa Maria.',
    diasGuardarCortesias: 90,
    diasGuardarFicha: 180,
    agendaSetor: {
      nome: 'Centro de Convenções UFSM',
      conta: 'centrodeconvencoes@ufsm.br',
      link: 'https://calendar.google.com/calendar/u/0/r',
      conectada: true,
    },
    linksFormularios: [
      { nome: 'Solicitação de datas', url: 'https://forms.gle/exemplo-solicitacao' },
      { nome: 'Registro de problemas', url: 'https://forms.gle/exemplo-problemas' },
      { nome: 'Ficha técnica do evento', url: 'https://forms.gle/exemplo-ficha' },
    ],
  };

  const senhas: Banco['senhas'] = {};
  for (const p of pessoas) senhas[p.id] = { senha: p.matricula, inicial: true };

  return {
    pessoas, dadosPessoais: dados, senhas, eventos, sessoes, feriados: FERIADOS_2026,
    rodadas: [
      { id: 'r1', nome: 'Outubro/2026', prazo: '2026-09-25T23:59', status: 'fechada', sessaoIds: sessoes.filter((s) => s.data.startsWith('2026-10')).map((s) => s.id) },
      { id: 'r2', nome: 'Novembro/2026', prazo: '2026-10-20T23:59', status: 'fechada', sessaoIds: sessoes.filter((s) => s.data.startsWith('2026-11')).map((s) => s.id) },
      { id: 'r3', nome: 'Dezembro/2026', prazo: '2026-11-25T23:59', status: 'aberta', sessaoIds: sessoes.filter((s) => s.data.startsWith('2026-12')).map((s) => s.id) },
    ],
    disponibilidades, escalas, avaliacoes: [], lotes, loteItens, envioExterno: [],
    contratos, aditivos: [
      { id: 'ad1', contratoId: 'c3', numero: 1, data: '2026-09-18', descricao: '1 sessão extra', valorDelta: 340000, novaData: '2026-10-29', statusFatura: 'Não enviada p/ emissão' },
    ],
    contratantes, almoxItens: itens, almoxMovimentos: movimentos,
    autorizadosExternos: ['Equipe de limpeza terceirizada', 'Técnico de som (produção)'],
    pedidos: [],
    ocorrencias,
    respostasFormularioInfra: pendentes,
    avisos,
    notificacoes: [
      { id: 'n1', pessoaId: 'p09', texto: 'Sua escala de novembro foi publicada.', link: '/minhas-escalas', criadaEm: '2026-10-21T10:00', lida: false },
      { id: 'n2', pessoaId: 'p01', texto: '18 pessoas ainda não responderam a disponibilidade de dezembro.', link: '/escalas', criadaEm: '2026-10-23T09:00', lida: false },
    ],
    historico: [],
    config,
  };
}
