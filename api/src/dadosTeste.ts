/**
 * Limpeza dos dados de teste e carga de dados fictícios, para rodar pelo editor do Apps Script antes de começar com os
 * dados reais. Os fictícios usam ids "demo-", e-mails @teste.invalid e nomes com "TESTE"; nenhum vai para a agenda Google.
 */
import { fichaVazia, MODELOS, MODULOS, somarDias, type FichaTecnicaDados, type ModeloPermissao } from '@shared';
import { criarCredencialInicial } from './acoes/auth';
import { paraBase64Url } from './auth/bytes';
import type { NomeTabela, Portas } from './nucleo/portas';
import { marcarRelatorios } from './relatorios/pendentes';

/** Tabelas apagadas por inteiro no reset (o resto é pessoas, almoxarifado, configurações e feriados). */
const APAGAR: NomeTabela[] = [
  'avisos', 'avisosLeituras', 'notificacoes', 'historico', 'eventos', 'sessoes', 'rodadas', 'rodadaSessoes', 'disponibilidades', 'escalas',
  'avaliacoes', 'lotes', 'loteItens', 'envioExterno', 'almoxMovimentos', 'almoxAutorizadosExternos', 'almoxPedidos', 'almoxPedidoItens',
  'ocorrencias', 'ocorrenciasHistorico', 'contratos', 'aditivos', 'contratantes', 'fichas', 'fichasSigilo', 'cortesiasDestinos', 'cortesiasSigilo',
];
/** Itens fictícios do almoxarifado: saem no reset; os reais ficam, com o saldo que tinham. */
const PREFIXO_ITEM = 'TESTE - ';

type Linha = { id: string } & Record<string, unknown>;

/**
 * Apaga os dados de teste: mantém só a pessoa indicada (com permissões, senha e dados pessoais), os itens reais do
 * almoxarifado, as configurações e os feriados. Tira da agenda Google os eventos das sessões apagadas.
 */
export function resetarDados(portas: Portas, manterPessoaId: string): Record<string, number> {
  const repo = portas.repo;
  const apagados: Record<string, number> = {};
  const meses = new Set<string>();
  for (const s of repo.listar<{ id: string; data?: string; googleEventoId?: string }>('sessoes')) {
    if (s.data) meses.add(s.data.slice(0, 7));
    if (s.googleEventoId && portas.agenda.ligada()) {
      try {
        portas.agenda.remover(s.googleEventoId);
      } catch {
        // evento já apagado no Google: segue a limpeza
      }
    }
  }
  for (const t of APAGAR) {
    apagados[t] = repo.listar(t).length;
    if (apagados[t]) repo.substituirTabela(t, []);
  }
  const manter = (t: NomeTabela, fica: (l: Linha) => boolean) => {
    const linhas = repo.listar<Linha>(t);
    const ficam = linhas.filter(fica);
    apagados[t] = linhas.length - ficam.length;
    if (apagados[t]) repo.substituirTabela(t, ficam);
  };
  manter('pessoas', (p) => p.id === manterPessoaId);
  manter('permissoes', (p) => p.pessoaId === manterPessoaId);
  manter('credenciais', (c) => c.id === manterPessoaId);
  manter('dadosPessoais', (d) => d.id === manterPessoaId);
  manter('almoxItens', (i) => !String(i.nomeAlmox ?? '').startsWith(PREFIXO_ITEM));
  marcarRelatorios(portas.props, [...[...meses].flatMap((m) => [`agenda:${m}`, `escala:${m}`]), 'trocas', 'estoque', 'infra', 'contratos']);
  return apagados;
}

// ——— dados fictícios ———

const PESSOAS: [nome: string, tipo: 'bolsista' | 'servidor', vinculo: 'eventual' | 'fixo', experiente: boolean, modelo: ModeloPermissao][] = [
  ['Amanda Ribeiro', 'bolsista', 'eventual', true, 'eventual'],
  ['Bruno Carvalho', 'bolsista', 'eventual', true, 'eventual'],
  ['Camila Duarte', 'bolsista', 'eventual', true, 'eventual'],
  ['Diego Fontes', 'bolsista', 'eventual', true, 'eventual'],
  ['Eduarda Lima', 'bolsista', 'eventual', false, 'eventual'],
  ['Felipe Moraes', 'bolsista', 'eventual', false, 'eventual'],
  ['Gabriela Nunes', 'bolsista', 'eventual', false, 'eventual'],
  ['Henrique Prado', 'bolsista', 'eventual', false, 'eventual'],
  ['Isabela Rocha', 'bolsista', 'eventual', false, 'eventual'],
  ['João Teixeira', 'bolsista', 'eventual', false, 'eventual'],
  ['Larissa Vieira', 'bolsista', 'fixo', true, 'eventual'],
  ['Mateus Almeida', 'bolsista', 'fixo', false, 'eventual'],
  ['Patrícia Gomes', 'servidor', 'fixo', true, 'operacao'],
  ['Ricardo Antunes', 'servidor', 'fixo', true, 'operacao'],
  ['Sônia Barros', 'servidor', 'fixo', true, 'operacao'],
];

/** [dias a partir de hoje, tipo, nome, sessões [dias, início, fim, rótulo], vagas de bolsistas, status]. */
const EVENTOS: [number, string, string, [number, string, string, string][], number, 'ativo' | 'cancelado'][] = [
  [-25, 'Formatura', 'Formatura de Enfermagem', [[-25, '19:00', '22:30', '']], 8, 'ativo'],
  [-18, 'Show/Concerto', 'Concerto da Orquestra', [[-18, '20:00', '22:00', '']], 6, 'ativo'],
  [-10, 'Congresso', 'Congresso de Agronomia', [[-10, '08:00', '18:00', '1º dia'], [-9, '08:00', '17:00', '2º dia']], 5, 'ativo'],
  [3, 'Show/Concerto', 'Show de Talentos', [[3, '19:30', '22:00', '']], 6, 'ativo'],
  [6, 'Formatura', 'Formatura de Direito', [[6, '19:00', '23:00', '']], 10, 'ativo'],
  [9, 'Corporativo', 'Seminário de Inovação', [[9, '08:30', '12:30', '']], 4, 'ativo'],
  [11, 'Outro', 'Palestra (cancelada)', [[11, '14:00', '16:00', '']], 3, 'cancelado'],
  [13, 'Outro', 'Espetáculo de Dança', [[13, '19:00', '21:30', 'Estreia'], [14, '16:00', '18:30', 'Matinê']], 8, 'ativo'],
  [17, 'Congresso', 'Jornada Acadêmica', [[17, '08:00', '17:00', '']], 5, 'ativo'],
  [21, 'Formatura', 'Formatura de Engenharia', [[21, '19:00', '23:00', '']], 10, 'ativo'],
  [26, 'Show/Concerto', 'Festival de Coros', [[26, '18:00', '21:00', '']], 6, 'ativo'],
  [32, 'Corporativo', 'Encontro de Gestores', [[32, '13:30', '18:00', '']], 3, 'ativo'],
  [40, 'Outro', 'Mostra de Teatro', [[40, '', '', '']], 6, 'ativo'],
];

const ITENS: [string, string, string, string, number, string, number][] = [
  ['9901', 'Fita isolante', 'UN', 'Elétrica', 450, 'Almox 1', 20],
  ['9902', 'Lâmpada LED 9W', 'UN', 'Elétrica', 1290, 'Almox 1', 12],
  ['9903', 'Pilha AA', 'PAR', 'Áudio', 890, 'Almox 2', 4],
  ['9904', 'Fita gaffer preta', 'ROLO', 'Palco', 5900, 'Almox 2', 3],
  ['9905', 'Água mineral 500ml', 'UN', 'Camarim', 150, 'Copa', 48],
  ['9906', 'Papel toalha', 'PCT', 'Limpeza', 980, 'Copa', 2],
];

const menos1h = (h: string) => (h ? `${String(Math.max(0, Number(h.slice(0, 2)) - 1)).padStart(2, '0')}${h.slice(2)}` : '');
/** "Sorteio" fixo, para os dados saírem sempre iguais. */
const sorteio = (a: number, b: number) => (a * 37 + b * 101) % 100;

/** Cria os dados fictícios. Recusa se já existem (rode resetarDados antes de criar de novo). */
export function criarDadosFicticios(portas: Portas): Record<string, number> {
  const repo = portas.repo;
  if (repo.listar<{ id: string }>('pessoas').some((p) => p.id.startsWith('demo-'))) {
    throw new Error('Os dados fictícios já existem. Rode resetarDados antes de criar de novo.');
  }
  const hoje = portas.relogio.hoje();
  const agora = portas.relogio.agora();
  const dia = (n: number) => somarDias(hoje, n);
  const autorId = repo.listar<{ id: string }>('pessoas').find((p) => !p.id.startsWith('demo-'))?.id ?? '';
  const token = () => paraBase64Url(portas.cripto.aleatorio(32));

  // pessoas
  const pessoas = PESSOAS.map(([nome, tipo, vinculo, experiente], i) => {
    const n = String(i + 1).padStart(2, '0');
    const [primeiro, ultimo] = nome.split(' ');
    const email = `${primeiro}.${ultimo}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return {
      id: `demo-p${n}`, nome, nomeCurto: primeiro.toUpperCase(), emailAcademico: `${email}@teste.invalid`, emailAlternativo: '',
      matricula: `20990000${n}`, siape: tipo === 'servidor' ? `99000${n}` : '', tipo, vinculo, experiente, escalarMenos: nome === 'Henrique Prado',
      ativo: true, convitesAgenda: '',
    };
  });
  repo.inserirVarios('pessoas', pessoas);
  repo.inserirVarios('permissoes', pessoas.flatMap((p, i) => MODULOS.map((m) => ({ id: `${p.id}:${m.id}`, pessoaId: p.id, modulo: m.id, nivel: MODELOS[PESSOAS[i][4]][m.id] }))));
  repo.inserirVarios('credenciais', pessoas.map((p) => criarCredencialInicial(portas.cripto, p.id, p.matricula)));
  const bolsistas = pessoas.filter((p) => p.tipo === 'bolsista');
  const servidores = pessoas.filter((p) => p.tipo === 'servidor');

  // eventos e sessões
  const eventos: Linha[] = [];
  const sessoes: (Linha & { data: string; eventoId: string; vagasBolsistas: number; status: string })[] = [];
  EVENTOS.forEach(([, tipo, nome, ses, vagas, status], i) => {
    const id = `demo-e${String(i + 1).padStart(2, '0')}`;
    eventos.push({
      id, nome: `TESTE · ${nome}`, tipo, organizador: tipo === 'Formatura' ? 'Comissão de Formatura (teste)' : 'Organização fictícia', contatoOrganizador: '(55) 90000-0000',
      servidorResponsavelId: servidores[i % servidores.length].id, publicoEstimado: 200 + ((i * 97) % 900), publicoReal: null,
      pagamento: i % 3 === 0 ? 'externo' : 'interno', pagadorExterno: i % 3 === 0 ? 'FUNDEP' : '', instrumento: i % 4 === 3 ? 'termo' : 'contrato', status,
      observacoes: 'Evento fictício para testar o sistema.',
    });
    ses.forEach(([d, inicio, fim, rotulo], j) =>
      sessoes.push({
        id: `${id}-s${j + 1}`, eventoId: id, data: dia(d), rotulo, chegada: menos1h(inicio), inicio, fim, horarioADefinir: !inicio, vagasBolsistas: vagas,
        vagasServidores: 1, diaria: null, minimoExperientes: vagas >= 6 ? 2 : 1, status: status === 'ativo' ? 'ativa' : 'cancelada',
        publicadaEm: d <= 6 && status === 'ativo' ? `${dia(Math.min(d, 0) - 5)}T10:00` : '', convocacaoAbertaAte: '', convocacaoVagas: 0, googleEventoId: '', agendaPendente: false,
      }),
    );
  });
  repo.inserirVarios('eventos', eventos);
  repo.inserirVarios('sessoes', sessoes);
  const ativas = sessoes.filter((s) => s.status === 'ativa');
  const passadas = ativas.filter((s) => s.data < hoje);
  const publicadas = ativas.filter((s) => s.publicadaEm && s.data >= hoje);
  const abertas = ativas.filter((s) => !s.publicadaEm);

  // rodadas e disponibilidades: uma fechada (eventos já escalados) e uma aberta (próximos eventos)
  const rodadas = [
    { id: 'demo-r1', nome: 'TESTE · Rodada anterior', prazo: `${dia(-30)}T23:59`, status: 'fechada', sessoes: [...passadas, ...publicadas] },
    { id: 'demo-r2', nome: 'TESTE · Rodada aberta', prazo: `${dia(2)}T23:59`, status: 'aberta', sessoes: abertas },
  ];
  repo.inserirVarios('rodadas', rodadas.map(({ sessoes: _s, ...r }) => r));
  repo.inserirVarios('rodadaSessoes', rodadas.flatMap((r) => r.sessoes.map((s) => ({ id: `${r.id}:${s.id}`, rodadaId: r.id, sessaoId: s.id, nova: false }))));
  const disponibilidades: Linha[] = [];
  rodadas.forEach((r, ri) =>
    r.sessoes.forEach((s, si) =>
      [...bolsistas, ...servidores].forEach((p, pi) => {
        const n = sorteio(pi + si * 3, ri + 1);
        if (ri === 1 && pi % 5 === 4) return; // na rodada aberta, alguns ainda não responderam
        disponibilidades.push({ id: `demo-d-${p.id}-${s.id}`, pessoaId: p.id, sessaoId: s.id, disponivel: n < 70, origem: 'proprio', respondidoEm: `${dia(-31 + ri * 28)}T09:${String(pi).padStart(2, '0')}` });
      }),
    ),
  );
  repo.inserirVarios('disponibilidades', disponibilidades);
  const disponivel = (pessoaId: string, sessaoId: string) => disponibilidades.some((d) => d.pessoaId === pessoaId && d.sessaoId === sessaoId && d.disponivel);

  // escalas: passadas realizadas (uma falta), publicadas, e um rascunho na rodada aberta
  const escalas: Linha[] = [];
  const escalar = (s: (typeof sessoes)[number], status: string, quantos: number, desde: number) => {
    const livres = bolsistas.filter((p) => disponivel(p.id, s.id));
    const k0 = desde % Math.max(1, livres.length);
    [...livres.slice(k0), ...livres.slice(0, k0)].slice(0, quantos).forEach((p, k) =>
      escalas.push({ id: `demo-x-${s.id}-${p.id}`, sessaoId: s.id, pessoaId: p.id, papel: 'bolsista', status: status === 'realizado' && k === 2 ? 'faltou' : status, adicaoDireta: false, loteId: '' }),
    );
    const serv = servidores[escalas.length % servidores.length];
    escalas.push({ id: `demo-x-${s.id}-${serv.id}`, sessaoId: s.id, pessoaId: serv.id, papel: 'servidor', status: status === 'faltou' ? 'realizado' : status, adicaoDireta: false, loteId: '' });
  };
  passadas.forEach((s, i) => escalar(s, 'realizado', s.vagasBolsistas, i));
  publicadas.forEach((s, i) => escalar(s, 'publicado', s.vagasBolsistas - (i === 0 ? 1 : 0), i + 2));
  if (abertas[0]) escalar(abertas[0], 'rascunho', Math.ceil(abertas[0].vagasBolsistas / 2), 1);

  // um lote de pagamento enviado com a primeira formatura
  const doLote = escalas.filter((e) => e.sessaoId === passadas[0]?.id && e.papel === 'bolsista' && e.status === 'realizado');
  doLote.forEach((e) => (e.loteId = 'demo-l1'));
  repo.inserirVarios('escalas', escalas);
  repo.inserirVarios('lotes', [{ id: 'demo-l1', titulo: 'TESTE · Lote da Formatura de Enfermagem', periodoReferencia: passadas[0]?.data.slice(0, 7) ?? '', edital: 'Edital fictício', iniciativa: 'Bolsas do CC (teste)', incluirZerados: false, status: 'enviado', pagoEm: '' }]);
  repo.inserirVarios('loteItens', doLote.map((e) => ({ id: `demo-li-${e.id}`, loteId: 'demo-l1', escalaId: e.id, pessoaId: e.pessoaId, valor: 8000 })));
  repo.inserirVarios('avaliacoes', bolsistas.slice(0, 5).map((p, i) => ({ id: `demo-av-${p.id}`, pessoaId: p.id, mes: dia(-30).slice(0, 7), nota: 5 - (i % 3), observacao: i % 2 ? 'Pontual e atenciosa com o público.' : '', autorId })));

  // contratos, contratantes e um aditivo
  repo.inserirVarios('contratantes', [
    { id: 'demo-k1', razaoSocial: 'Produtora Exemplo Ltda (teste)', documento: '00.000.000/0001-00', inscricaoMunicipal: '', inscricaoEstadual: '', endereco: 'Rua Fictícia, 100', cep: '97000-000', representanteNome: 'Representante Fictício', email: 'contato@teste.invalid', contatoFaturaNome: 'Financeiro', contatoFaturaEmail: 'fatura@teste.invalid', contatoFaturaTelefone: '(55) 90000-0001' },
    { id: 'demo-k2', razaoSocial: 'Comissão de Formatura Exemplo (teste)', documento: '000.000.000-00', inscricaoMunicipal: '', inscricaoEstadual: '', endereco: 'Av. Exemplo, 200', cep: '97000-000', representanteNome: 'Formando Fictício', email: 'comissao@teste.invalid', contatoFaturaNome: '', contatoFaturaEmail: '', contatoFaturaTelefone: '' },
  ]);
  const ano = hoje.slice(0, 4);
  const contrato = (i: number, eventoId: string, k: string, valor: number, st: string[], vencimento: string) => ({
    id: `demo-c${i}`, numero: `${900 + i}/${ano}`, eventoId, contratanteId: k, processoPen: `23081.0${String(i).padStart(5, '0')}/${ano}-00`, valorBase: valor, itemTabela: '1.1',
    vencimento, areas: ['Plateia', 'Palco', 'Camarins'], cortesiasQtd: 20 + i * 5, ingressoSolidario: i % 2 ? 'Possui' : 'Não possui', statusContrato: st[0],
    statusFatura: st[1], numeroFatura: st[1] === 'Paga' ? `NF-TESTE-${i}` : '', statusEcad: st[2], statusIss: st[3], statusFundep: st[4], statusCortesias: st[5],
    fichaTecnicaRecebida: st[0] === 'Assinado', canceladoMotivo: '', observacoes: 'Contrato fictício.', pdfAssinadoId: '', pdfFaturaId: '',
  });
  repo.inserirVarios('contratos', [
    contrato(1, 'demo-e02', 'demo-k1', 650000, ['Assinado', 'Paga', 'Pago', 'Pago', 'Ok', 'Distribuídas'], dia(-20)),
    contrato(2, 'demo-e05', 'demo-k2', 890000, ['Enviado ao PEN-SIE', 'Enviada p/ emissão', 'Não enviado', 'Isento', 'Enviado', 'Recebidas'], dia(10)),
    contrato(3, 'demo-e08', 'demo-k1', 420000, ['Não enviado', 'Não enviada p/ emissão', 'Não enviado', 'Não enviado', 'Não enviado', 'Não recebidas'], dia(20)),
    contrato(4, 'demo-e10', 'demo-k2', 980000, ['Assinado', 'Não paga', 'Enviado p/ processamento', 'Não pago', 'Ok', 'Não recebidas'], dia(-3)),
  ]);
  repo.inserirVarios('aditivos', [{ id: 'demo-ad1', contratoId: 'demo-c2', numero: 1, data: dia(-2), descricao: 'Mais um dia de montagem (teste)', valorDelta: 120000, novaData: '', statusFatura: 'Não enviada p/ emissão', numeroFatura: '' }]);

  // ficha técnica enviada (Formatura de Direito) e uma em rascunho (Espetáculo de Dança)
  const sessoesDe = (eventoId: string) => ativas.filter((s) => s.eventoId === eventoId).map((s) => ({ id: s.id, data: s.data }));
  const fichaDireito: FichaTecnicaDados = {
    ...fichaVazia(sessoesDe('demo-e05')), tipo: 'Formatura', publico: 900, elenco: 120, montagem: `${dia(6)}T09:00`, desmontagem: `${dia(6)}T23:59`,
    sessoes: sessoesDe('demo-e05').map((s) => ({ sessaoId: s.id, portas: '18:30', inicio: '19:00', fim: '23:00', intervalo: false, intervaloInicio: '', intervaloFim: '' })),
    responsavel: { vinculo: 'Contratante', vinculoOutro: '', nome: 'Formando Fictício', documento: '', siapeMatricula: '', email: '', telefone: '' },
    descricaoMontagem: 'Painel de fotos no foyer e mesa de autoridades no palco.', equipeMontagem: 'Montador Fictício Um\nMontador Fictício Dois',
    locais: ['Palco', 'Foyer Principal'], sessaoFotos: true, leituraIngressos: false, ingressoSolidario: false, camarinsIndividuais: ['Paraninfo'],
    camarinsColetivos: ['Formandos'], reservarPoltronas: true, grupos: [{ nome: 'Autoridades', lugares: ['baixa:A15', 'baixa:A17', 'baixa:A19', 'baixa:A16', 'baixa:A18'] }, { nome: 'Família do paraninfo', lugares: ['baixa:B15', 'baixa:B17', 'baixa:B19'] }],
    coffeeBreak: true, coffeeLocal: 'Camarins', coffeeCardapio: 'Água e café.', aceiteRegulamento: true,
  };
  repo.inserirVarios('fichas', [
    { id: 'demo-e05', status: 'enviada', trava: 'auto', dados: fichaDireito, enviadaEm: `${dia(-1)}T15:30` },
    { id: 'demo-e08', status: 'rascunho', trava: 'auto', dados: { ...fichaVazia(sessoesDe('demo-e08')), tipo: 'Dança', publico: 600 }, enviadaEm: '' },
  ]);
  repo.inserirVarios('fichasSigilo', [
    { id: 'demo-e05', token: token(), documento: '000.000.000-00', email: 'comissao@teste.invalid', telefone: '(55) 90000-0002' },
    { id: 'demo-e08', token: token(), documento: '', email: '', telefone: '' },
  ]);

  // cortesias da Formatura de Direito
  repo.inserirVarios('cortesiasDestinos', [
    { id: 'demo-ct1', eventoId: 'demo-e05', nome: 'Casa do Estudante (teste)', quantidade: 20, pedirMatricula: true, trava: 'auto', atualizadoPeloDestinoEm: `${dia(-1)}T11:00` },
    { id: 'demo-ct2', eventoId: 'demo-e05', nome: 'PRE (teste)', quantidade: 5, pedirMatricula: false, trava: 'auto', atualizadoPeloDestinoEm: '' },
  ]);
  repo.inserirVarios('cortesiasSigilo', [
    { id: 'demo-ct1', token: token(), pessoas: ['Aluno Fictício Um', 'Aluna Fictícia Dois', 'Aluno Fictício Três', 'Aluna Fictícia Quatro', 'Aluno Fictício Cinco'].map((nome, i) => ({ nome, matricula: `20990100${i}` })) },
    { id: 'demo-ct2', token: token(), pessoas: [] },
  ]);

  // almoxarifado: itens TESTE, retiradas, um autorizado e um pedido
  repo.inserirVarios('almoxItens', ITENS.map(([cod, nome, unidade, categoria, valor, sala, saldo]) => ({
    id: cod, cod, nomeAlmox: `${PREFIXO_ITEM}${nome.toUpperCase()}`, nomeComum: `${nome} (teste)`, unidade, valor, categoria, qtdMinima: 5, sala, status: 'Ativo', saldo,
  })));
  repo.inserirVarios('almoxAutorizadosExternos', [{ id: 'demo-aut1', nome: 'Técnico da Produtora (teste)', ativo: true }]);
  repo.inserirVarios('almoxMovimentos', ITENS.slice(0, 4).map(([cod, , , , valor], i) => ({
    id: `demo-m${i + 1}`, quando: `${dia(-12 + i * 3)}T1${i}:00`, tipo: 'saida', cod, qtd: -(i + 1), valorUnitario: valor, retiradoPorPessoaId: i === 3 ? '' : bolsistas[i].id,
    retiradoPorExterno: i === 3 ? 'Técnico da Produtora (teste)' : '', eventoId: eventos[i]?.id ?? '', ocorrenciaId: '', finalidade: 'Uso no evento (teste)', pedidoId: '', motivo: '',
  })));
  repo.inserirVarios('almoxPedidos', [{ id: 'demo-pd1', solicitanteId: autorId, status: 'aberto' }]);
  repo.inserirVarios('almoxPedidoItens', [
    { id: 'demo-pi1', pedidoId: 'demo-pd1', cod: '9903', qtdPedida: 20, qtdRecebida: 0, valorEstimado: 890 },
    { id: 'demo-pi2', pedidoId: 'demo-pd1', cod: '9906', qtdPedida: 10, qtdRecebida: 0, valorEstimado: 980 },
  ]);

  // ocorrências do prédio
  const ocorrencias = [
    ['Torneira pingando no camarim 2', 'Hidráulica', 'Camarins', 'media', 'nova'],
    ['Lâmpada queimada na plateia (fila F)', 'Iluminação', 'Plateia', 'baixa', 'analise'],
    ['Ar-condicionado do palco sem gelar', 'Ar-condicionado', 'Palco', 'alta', 'chamado'],
    ['Poltrona solta na fila K', 'Mobiliário', 'Plateia', 'media', 'resolvida'],
  ].map(([titulo, categoria, local, prioridade, status], i) => ({
    id: `demo-oc${i + 1}`, numero: 900 + i + 1, titulo: `TESTE · ${titulo}`, descricao: 'Ocorrência fictícia para testar o sistema.', categoria, local, prioridade, status,
    origem: i === 1 ? 'formulario' : 'app', relatorNome: bolsistas[i].nome, relatorPessoaId: i === 1 ? '' : bolsistas[i].id, relatorContato: '', eventoId: '',
    fotoId: '', chamadoNumero: status === 'chamado' ? 'TESTE-12345' : '', chamadoLink: '', chamadoAbertoEm: status === 'chamado' ? `${dia(-2)}T10:00` : '',
    resolvidaEm: status === 'resolvida' ? `${dia(-1)}T16:00` : '', respostaFormularioId: '',
  }));
  repo.inserirVarios('ocorrencias', ocorrencias);
  repo.inserirVarios('ocorrenciasHistorico', ocorrencias.filter((o) => o.status !== 'nova').map((o) => ({ id: `demo-oh-${o.id}`, ocorrenciaId: o.id, quando: `${dia(-2)}T09:00`, quemId: autorId, de: 'nova', para: o.status, observacao: '' })));

  // mural
  repo.inserirVarios('avisos', [
    { id: 'demo-a1', titulo: 'TESTE · Bem-vindos ao GestorCC', texto: 'Este é um aviso fictício, fixado no topo do mural.', publico: 'todos', pessoasIds: [], fixado: true, validoAte: '', pedeConfirmacao: false, autorId },
    { id: 'demo-a2', titulo: 'TESTE · Reunião de bolsistas', texto: `Reunião fictícia no dia ${dia(5).split('-').reverse().join('/')} às 14h.`, publico: 'bolsistas', pessoasIds: [], fixado: false, validoAte: dia(5), pedeConfirmacao: true, autorId },
  ]);

  const meses = [...new Set(sessoes.map((s) => s.data.slice(0, 7)))];
  marcarRelatorios(portas.props, [...meses.flatMap((m) => [`agenda:${m}`, `escala:${m}`]), 'trocas', 'estoque', 'infra', 'contratos', 'lote:demo-l1']);
  void agora;
  return {
    pessoas: pessoas.length, eventos: eventos.length, sessoes: sessoes.length, disponibilidades: disponibilidades.length, escalas: escalas.length,
    contratos: 4, ocorrencias: ocorrencias.length, itensAlmox: ITENS.length,
  };
}
