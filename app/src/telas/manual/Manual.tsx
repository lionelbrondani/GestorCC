import { ehGestor } from '@shared';
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  Gift,
  KeyRound,
  Package,
  Printer,
  TriangleAlert,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEu } from '../../auth/SessaoContexto';
import { Botao, Etiqueta, Pagina } from '../../componentes';
import { Trilha } from '../contratos/Contratos';
import { etapasDoContrato } from '../contratos/trilha';
import '../contratos/contratos.css';
import '../cortesias/cortesias.css';
import '../escalas/escalas.css';
import '../pessoal/pessoal.css';
import '../relatorio/relatorio.css';
import './manual.css';

interface Secao {
  id: string;
  titulo: string;
  icone: LucideIcon;
  /** Gestão aparece só para quem administra; o resto é para todos. */
  publico: 'todos' | 'gestao';
  serve: string;
  passos: ReactNode[];
  ilustracao?: ReactNode;
  dicas?: string[];
}

/** Moldura de "tela" para as ilustrações. */
function Tela({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <figure className="manual-tela">
      <figcaption>
        <span className="manual-tela-bolinhas" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        {titulo}
      </figcaption>
      <div className="manual-tela-corpo">{children}</div>
    </figure>
  );
}

const contratoExemplo = {
  statusContrato: 'Assinado', statusFatura: 'Não paga', statusEcad: 'Enviado p/ processamento', statusIss: 'Isento', statusFundep: 'Não enviado', statusCortesias: 'Não recebidas',
} as Parameters<typeof etapasDoContrato>[0];

const SECOES: Secao[] = [
  {
    id: 'entrar', titulo: 'Entrar e senha', icone: KeyRound, publico: 'todos',
    serve: 'Acessar o GestorCC pelo celular ou pelo computador.',
    passos: [
      'Abra o endereço do GestorCC e digite o e-mail cadastrado.',
      'Na primeira vez, a senha é a sua matrícula. O sistema pede para você criar uma senha nova.',
      <>Para trocar a senha depois: <strong>Perfil → Trocar senha</strong> (mínimo de 8 caracteres).</>,
      'Esqueceu a senha? Peça a um gestor: ele volta a senha para a sua matrícula.',
    ],
    ilustracao: (
      <Tela titulo="Entrar">
        <div className="manual-form">
          <label>E-mail<span className="cc-entrada">nome@acad.ufsm.br</span></label>
          <label>Senha<span className="cc-entrada">••••••••</span></label>
          <Botao variante="primario">Entrar</Botao>
        </div>
      </Tela>
    ),
    dicas: ['No celular, use "Adicionar à tela inicial" para abrir o GestorCC como um aplicativo.'],
  },
  {
    id: 'disponibilidade', titulo: 'Marcar disponibilidade', icone: ClipboardList, publico: 'todos',
    serve: 'Avisar em quais eventos da rodada você pode trabalhar.',
    passos: [
      <>Abra <strong>Disponibilidade</strong> no menu. Aparece o calendário do mês com os eventos da rodada aberta.</>,
      'Toque na sessão para marcar Sim; toque de novo para Não. Ou abra o dia e use os botões grandes Sim e Não.',
      'As marcações são salvas sozinhas logo depois do último toque ("Salvo ✓").',
      'Responda até o prazo da rodada. Sem resposta conta como indisponível.',
    ],
    ilustracao: (
      <Tela titulo="Disponibilidade · Concerto de Natal">
        <div className="linha-entre">
          <span>
            <strong>Concerto de Natal</strong>
            <br />
            <span className="pequeno texto-2">Chegada 18:30 · início 20:00</span>
          </span>
          <span className="sim-nao">
            <button data-valor="sim" aria-pressed>
              Sim
            </button>
            <button data-valor="nao">Não</button>
          </span>
        </div>
      </Tela>
    ),
    dicas: ['Sessão com o selo "nova" entrou na rodada depois que ela abriu: confira se pode.'],
  },
  {
    id: 'minhas-escalas', titulo: 'Minhas escalas e avisos', icone: CalendarCheck, publico: 'todos',
    serve: 'Ver onde você foi escalado, com quem e quando chegar.',
    passos: [
      <>Abra <strong>Minhas escalas</strong>: aparecem as escalas publicadas, com a equipe de cada sessão.</>,
      'Avisos importantes (escala publicada, troca, convocação) chegam no sininho, no alto da tela.',
      <>Quer receber as escalas no Google Agenda? <strong>Perfil → Receber minhas escalas no Google Agenda</strong>.</>,
      <>Bolsistas veem em <strong>Ganhos</strong> o previsto, o enviado para pagamento e o já pago.</>,
    ],
    ilustracao: (
      <Tela titulo="Avisos">
        <div className="manual-aviso">
          <Bell size={18} aria-hidden /> Você foi escalado(a): Formatura de Direito (12/12).
        </div>
      </Tela>
    ),
  },
  {
    id: 'relatar', titulo: 'Relatar um problema no prédio', icone: TriangleAlert, publico: 'todos',
    serve: 'Avisar a equipe sobre algo quebrado ou que precisa de conserto.',
    passos: [
      <>Abra <strong>Relatar problema</strong>, escreva um título curto e escolha o local e o tipo.</>,
      'Descreva o ponto exato e, se puder, tire uma foto.',
      'Acompanhe a situação do seu relato na mesma tela.',
    ],
  },
  {
    id: 'agenda', titulo: 'Agenda e eventos', icone: CalendarDays, publico: 'gestao',
    serve: 'Cadastrar os eventos e suas sessões; tudo vai sozinho para a agenda do CC no Google.',
    passos: [
      <><strong>Agenda → Novo evento</strong>: nome, tipo, organizador, instrumento e quem paga os bolsistas.</>,
      'Cada evento tem uma ou mais sessões (data, chegada, início, fim, vagas). Cada sessão é escalada e paga separadamente.',
      <>Montagem, passagem de som, desmontagem e ensaio: escolha a <strong>Atividade</strong> da sessão. Elas aparecem na agenda, têm escala própria (aba Apoio) e não pagam diária.</>,
      'Para cancelar um evento ou uma sessão, use Cancelar e informe o motivo: quem estava escalado é avisado.',
      <><strong>Agenda → Imprimir</strong>: modelo legado (um dia por linha, dias com evento em cinza) ou atualizado.</>,
    ],
    dicas: ['Na agenda, atividades de apoio aparecem em itálico, com borda tracejada.'],
  },
  {
    id: 'fichas', titulo: 'Ficha técnica', icone: ClipboardCheck, publico: 'gestao',
    serve: 'O produtor preenche horários, camarins, poltronas reservadas e coffee break por um link, sem login.',
    passos: [
      <>Abra o evento e use <strong>Ficha técnica → Gerar link da ficha técnica</strong>.</>,
      <><strong>Copiar mensagem para o produtor</strong> e cole no e-mail ou no WhatsApp (o GestorCC não envia e-mails).</>,
      'O produtor preenche em etapas e marca as poltronas no mapa. Ele pode corrigir até 2 dias antes da primeira sessão.',
      <>Acompanhe tudo em <strong>Fichas técnicas</strong> (menu): enviadas, aguardando e com prazo na semana.</>,
      <><strong>Lançar montagem e desmontagem na agenda do CC</strong> cria as atividades de apoio do evento a partir da ficha.</>,
      <><strong>Imprimir resumo</strong>: dados da ficha e o mapa das poltronas reservadas, para a equipe.</>,
    ],
    ilustracao: (
      <Tela titulo="Evento · Ficha técnica">
        <div className="linha">
          <Etiqueta tom="sucesso">Enviada</Etiqueta>
          <Etiqueta>Aberta até 10/12/2026</Etiqueta>
        </div>
        <div className="linha" style={{ marginTop: 8 }}>
          <Botao tamanho="pequeno">Copiar mensagem para o produtor</Botao>
          <Botao tamanho="pequeno">Imprimir resumo</Botao>
          <Botao tamanho="pequeno" variante="primario">
            Lançar na agenda do CC
          </Botao>
        </div>
      </Tela>
    ),
    dicas: ['Evento de um dia: a montagem e a desmontagem devem ser no mesmo dia; a ficha avisa e não deixa passar.'],
  },
  {
    id: 'cortesias', titulo: 'Cortesias', icone: Gift, publico: 'gestao',
    serve: 'Repartir as cortesias entre destinos (ex.: Casa do Estudante); cada destino lança os nomes pelo link.',
    passos: [
      <>No evento, <strong>Cortesias → Novo destino</strong>: nome do destino e quantidade.</>,
      <><strong>Copiar mensagem</strong> e envie ao responsável do destino.</>,
      'O destino lança nome e matrícula de quem vai receber, até o dia anterior ao evento.',
      <><strong>Imprimir lista</strong> no dia do evento: ordem alfabética, com a coluna para marcar a retirada.</>,
    ],
    ilustracao: (
      <Tela titulo="Link do destino">
        <p style={{ margin: '0 0 8px' }}>
          Você recebeu <strong>30 cortesias</strong> para distribuir à <strong>Casa do Estudante</strong>.
        </p>
        <div className="cortesias-contador">
          <span>22 de 30</span>
        </div>
      </Tela>
    ),
  },
  {
    id: 'escalas', titulo: 'Escalas: rodada, montar e publicar', icone: ClipboardList, publico: 'gestao',
    serve: 'Abrir a rodada de disponibilidade, montar a escala evento a evento e publicar.',
    passos: [
      <><strong>Escalas → Disponibilidade → Nova rodada</strong>: escolha as sessões e o prazo. Todos recebem o aviso.</>,
      <>Se alguém avisou por fora, use <strong>Marcar por alguém</strong> (Sim/Não aparecem na hora e salvam juntos).</>,
      <><strong>Montar → Evento a evento</strong>: toque no bloco da pessoa para escalar; toque na vaga para tirar.</>,
      <><strong>Escalar próximo evento</strong> salva e passa para o seguinte. No último, <strong>Revisar e publicar</strong>.</>,
      <><strong>Ver escala</strong> mostra o mês (ou a rodada) por evento ou por pessoa, sem imprimir.</>,
      <>Trocas (inclusive depois do evento) em <strong>Publicadas → Trocar</strong>, com justificativa.</>,
      <><strong>Presença</strong>: depois do evento, confirme quem compareceu (isso libera o pagamento).</>,
    ],
    ilustracao: (
      <Tela titulo="Montar · evento a evento">
        <div className="vagas">
          <ul className="vagas-lista">
            <li>
              <span className="bloco-pessoa" data-experiente>
                <span className="bloco-nome">ANA</span>
              </span>
            </li>
          </ul>
          <span className="vaga-vazia">+</span>
          <span className="vaga-vazia">+</span>
        </div>
        <div className="blocos" style={{ marginTop: 8 }}>
          <span className="bloco-pessoa">
            <span className="bloco-nome">BRUNO</span>
            <span className="contagem" data-nivel={1}>
              1x
            </span>
          </span>
          <span className="bloco-pessoa">
            <span className="bloco-nome">CARLA</span>
            <span className="contagem" data-nivel={0}>
              0x
            </span>
          </span>
        </div>
      </Tela>
    ),
    dicas: ['Os números (1x, 2x…) mostram quantas vezes a pessoa já foi escalada no mês: comece pelos menores.'],
  },
  {
    id: 'apoio', titulo: 'Escala de apoio (montagem, passagem de som, desmontagem)', icone: Wrench, publico: 'gestao',
    serve: 'Escalar os bolsistas fixos (administração) e servidores nas atividades de apoio.',
    passos: [
      'Cadastre a atividade como sessão do evento (Atividade: Montagem…) ou lance pela ficha técnica.',
      <>Em <strong>Escalas → Apoio</strong>, escolha quem acompanha e clique em <strong>Escalar</strong>.</>,
      <><strong>Publicar</strong> avisa quem foi escalado. Apoio não entra na rodada e não paga diária.</>,
    ],
  },
  {
    id: 'pagamentos', titulo: 'Pagamentos', icone: Wallet, publico: 'gestao',
    serve: 'Montar os lotes de diárias e acompanhar o que foi pago.',
    passos: [
      <><strong>Pagamentos → Novo lote</strong>: escolha as sessões realizadas (com presença confirmada).</>,
      'Copie ou baixe a ficha de indicação do lote e envie ao setor de pagamento.',
      'Quando o pagamento sair, marque o lote como pago.',
    ],
  },
  {
    id: 'contratos', titulo: 'Contratos', icone: FileSignature, publico: 'gestao',
    serve: 'Acompanhar contrato, fatura, ECAD, ISS, FUNDEP e cortesias de cada evento.',
    passos: [
      'Cada contrato aparece com a trilha das 6 etapas: verde concluído, azul em andamento, amarelo a fazer, laranja prazo perto, vermelho atrasado.',
      'Clique num número do resumo no topo para ver só os contratos com aquela etapa pendente.',
      <>Documentos são gerados a partir dos modelos do Google Docs; o pedido à FUNDEP sai como texto para copiar.</>,
    ],
    ilustracao: (
      <Tela titulo="Contratos">
        <Trilha etapas={etapasDoContrato(contratoExemplo, ['faturaVencendo'])} />
      </Tela>
    ),
  },
  {
    id: 'almox', titulo: 'Almoxarifado', icone: Package, publico: 'gestao',
    serve: 'Controlar o estoque, as retiradas e os pedidos de compra.',
    passos: [
      <><strong>Almoxarifado → Saída</strong>: adicione os itens (pelo nome, código ou câmera) e digite quem está retirando.</>,
      'Nome novo? O sistema pergunta se quer cadastrar como autorizado e já registra a retirada.',
      <><strong>Quem pode retirar</strong>: inclua, renomeie ou desative as pessoas de fora da equipe.</>,
      'O painel mostra os itens no mínimo; os pedidos acompanham as compras até o recebimento.',
    ],
  },
  {
    id: 'infra', titulo: 'Infraestrutura (prédio)', icone: Wrench, publico: 'gestao',
    serve: 'Acompanhar os problemas do prédio, do relato até a solução.',
    passos: [
      'Os relatos chegam pelo app e pelo formulário de problemas.',
      'Mude a situação (análise, chamado aberto, em atendimento, resolvida) e registre o número do chamado.',
    ],
  },
  {
    id: 'relatorio', titulo: 'Relatório mensal', icone: BarChart3, publico: 'gestao',
    serve: 'Imprimir tudo o que aconteceu no mês e o que cada pessoa tem direito a receber.',
    passos: [
      <>Abra <strong>Relatório mensal</strong>, escolha o mês e clique em <strong>Imprimir</strong>.</>,
      'Traz: números do mês, diárias de cada bolsista (o que já está em lote), agenda, lotes, contratos, fichas, almoxarifado e prédio.',
    ],
    ilustracao: (
      <Tela titulo="Relatório mensal">
        <div className="rel-numeros">
          <div className="rel-numero" data-tom="info">
            <strong>12</strong>
            <span>eventos · 15 sessões</span>
          </div>
          <div className="rel-numero" data-tom="sucesso">
            <strong>R$ 3.840,00</strong>
            <span>em diárias (UFSM)</span>
          </div>
        </div>
      </Tela>
    ),
  },
  {
    id: 'pessoas', titulo: 'Pessoas e configurações', icone: Users, publico: 'gestao',
    serve: 'Cadastrar a equipe, dar permissões e ajustar diária, vagas padrão, feriados e links.',
    passos: [
      <><strong>Pessoas → Nova pessoa</strong>: nome, e-mail, matrícula, tipo (bolsista/servidor) e vínculo (fixo/eventual).</>,
      'A senha inicial é a matrícula. Para quem esqueceu: Redefinir senha para a matrícula.',
      <><strong>Configurações</strong>: diária padrão, vagas padrão, feriados, edital/iniciativa, FUNDEP, links (ex.: folder do CC).</>,
    ],
  },
];

/** Manual ilustrado do GestorCC, dentro do sistema; dá para imprimir ou salvar em PDF. */
export function Manual() {
  const eu = useEu();
  const gestao = ehGestor(eu.permissoes);
  const secoes = SECOES.filter((s) => s.publico === 'todos' || gestao);
  return (
    <Pagina
      titulo="Manual do GestorCC"
      subtitulo="Como usar cada parte do sistema, passo a passo."
      acoes={
        <Botao variante="primario" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir / salvar em PDF
        </Botao>
      }
    >
      <div className="manual">
        <header className="manual-capa">
          <img src="/logo-cc-escuro.png" alt="Centro de Convenções PRE | UFSM" />
          <div>
            <h2>
              <BookOpen size={22} aria-hidden /> Manual do GestorCC
            </h2>
            <p>Agenda, escalas, fichas técnicas, cortesias, pagamentos, contratos, almoxarifado e prédio num lugar só.</p>
          </div>
        </header>

        <nav className="manual-sumario" aria-label="Sumário">
          <h3>Sumário</h3>
          <ol>
            {secoes.map((s) => (
              <li key={s.id}>
                <a href={`#manual-${s.id}`}>{s.titulo}</a>
              </li>
            ))}
          </ol>
        </nav>

        {secoes.map((s, i) => (
          <section key={s.id} id={`manual-${s.id}`} className="manual-secao" data-publico={s.publico}>
            <h3>
              <span className="manual-numero">{i + 1}</span>
              <s.icone size={22} aria-hidden />
              {s.titulo}
              {s.publico === 'gestao' && <Etiqueta tom="info">Gestão</Etiqueta>}
            </h3>
            <p className="manual-serve">{s.serve}</p>
            <div className="manual-conteudo">
              <ol className="manual-passos">
                {s.passos.map((p, k) => (
                  <li key={k}>{p}</li>
                ))}
              </ol>
              {s.ilustracao}
            </div>
            {s.dicas?.map((d, k) => (
              <p key={k} className="manual-dica">
                💡 {d}
              </p>
            ))}
          </section>
        ))}

        <p className="manual-fim">
          Dúvidas, sugestões ou erros: lionel.brondani@acad.ufsm.br · GestorCC, desenvolvido pelo bolsista Lionel Brondani · código aberto em github.com/lionelbrondani/GestorCC
        </p>
      </div>
    </Pagina>
  );
}
