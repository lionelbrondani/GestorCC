import { ehGestor } from '@shared';
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  Gift,
  Home,
  KeyRound,
  Package,
  PackageSearch,
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
import './manual.css';

/** Print de uma tela real do sistema (modo protótipo, dados fictícios), salvo em public/manual/. */
interface Print {
  arquivo: string;
  legenda: string;
  /** pc: a tela inteira no computador; cel: a tela do celular; recorte: um cartão da tela. */
  formato: 'pc' | 'cel' | 'recorte';
}

interface Secao {
  id: string;
  titulo: string;
  icone: LucideIcon;
  /** Gestão aparece só para quem administra; o resto é para todos. */
  publico: 'todos' | 'gestao';
  serve: string;
  passos: ReactNode[];
  prints?: Print[];
  dicas?: string[];
}

const SECOES: Secao[] = [
  {
    id: 'entrar', titulo: 'Entrar e senha', icone: KeyRound, publico: 'todos',
    serve: 'Acessar o GestorCC pelo celular ou pelo computador.',
    passos: [
      'Abra o endereço do GestorCC e digite o e-mail cadastrado.',
      <>Se aparecer o botão <strong>Fazer login com o Google</strong>, entre com a sua conta da UFSM: não precisa de senha.</>,
      'Na primeira vez, a senha é a sua matrícula. O sistema pede para você criar uma senha nova.',
      <>Para trocar a senha depois: <strong>Perfil → Trocar senha</strong> (mínimo de 8 caracteres).</>,
      'Esqueceu a senha? Peça a um gestor: ele volta a senha para a sua matrícula.',
    ],
    prints: [{ arquivo: 'entrar', legenda: 'Tela de entrada', formato: 'pc' }],
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
    prints: [{ arquivo: 'bolsista-disponibilidade', legenda: 'Disponibilidade no celular', formato: 'cel' }],
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
    prints: [{ arquivo: 'bolsista-minhas-escalas', legenda: 'Minhas escalas no celular', formato: 'cel' }],
  },
  {
    id: 'relatar', titulo: 'Relatar um problema no prédio', icone: TriangleAlert, publico: 'todos',
    serve: 'Avisar a equipe sobre algo quebrado ou que precisa de conserto.',
    passos: [
      <>Abra <strong>Relatar problema</strong>, escreva um título curto e escolha o local e o tipo.</>,
      'Descreva o ponto exato e, se puder, tire uma foto.',
      'Acompanhe a situação do seu relato na mesma tela.',
    ],
    prints: [{ arquivo: 'bolsista-relatar', legenda: 'Relatar problema no celular', formato: 'cel' }],
  },
  {
    id: 'inicio', titulo: 'Início, busca e avisos', icone: Home, publico: 'gestao',
    serve: 'Ver o que precisa de você, o dia e a semana, e chegar rápido a cada parte do sistema.',
    passos: [
      <><strong>O que precisa de você</strong>, no alto: as pendências com prazo (presença, escala a publicar, apoio sem equipe, ficha técnica sem resposta, lote de pagamento, contratos), da mais urgente para a menos. Toque para ir direto.</>,
      'Os atalhos coloridos levam direto a cada área: agenda, fichas, escalas, pagamentos e as demais.',
      <><strong>Hoje</strong> e <strong>Próximos 7 dias</strong> mostram os eventos e quantas vagas já estão preenchidas (ex.: 4/4).</>,
      <>A <strong>busca</strong>, no alto, encontra eventos e pessoas e entende perguntas como "quem está escalado sábado?". Perguntas com contas ("quem mais trabalhou em outubro?") viram uma tabela com o total. Os nomes das pessoas viram códigos antes de a pergunta ir ao Gemini.</>,
      'O sininho mostra os avisos. No celular, o menu completo fica no botão Menu, embaixo.',
    ],
    prints: [{ arquivo: 'inicio', legenda: 'Início da gestão', formato: 'pc' }],
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
    prints: [{ arquivo: 'agenda', legenda: 'Agenda', formato: 'pc' }],
    dicas: ['Na agenda, atividades de apoio aparecem em itálico, com borda tracejada.'],
  },
  {
    id: 'pedidos', titulo: 'Pedidos de data', icone: CalendarPlus, publico: 'gestao',
    serve: 'Receber os pedidos de data pela página pública (substitui o formulário do Google) e decidir cada um.',
    passos: [
      <><strong>Pedidos de data → Copiar link do formulário</strong> e use esse link no site, no Instagram e nas respostas.</>,
      'Quem pede preenche o evento, os dias (montagem, ensaio, evento, desmontagem) com os horários, os espaços e os dados da empresa e do responsável. Recebe um protocolo.',
      'Cada pedido aparece com a agenda dos dias pedidos: livre, outro evento no mesmo dia ou conflito de horário.',
      <><strong>Aprovar e criar evento</strong>: o pedido vira evento com uma sessão por dia, e a empresa entra como contratante.</>,
      <><strong>Recusar</strong> pede o motivo. Responda a pessoa pelo botão <strong>E-mail</strong> (você confere antes de enviar).</>,
    ],
    dicas: ['Pedido novo avisa no sininho e aparece em "O que precisa de você", no Início.'],
  },
  {
    id: 'fichas', titulo: 'Ficha técnica', icone: ClipboardCheck, publico: 'gestao',
    serve: 'O produtor preenche horários, camarins, poltronas reservadas e coffee break por um link, sem login.',
    passos: [
      <>Abra o evento e use <strong>Ficha técnica → Gerar link da ficha técnica</strong>.</>,
      <><strong>Enviar por e-mail</strong> (você confere o texto antes) ou <strong>Abrir no WhatsApp</strong>, com a mensagem pronta.</>,
      'O produtor preenche em etapas e marca as poltronas no mapa. Ele pode corrigir até 2 dias antes da primeira sessão.',
      <>Acompanhe tudo em <strong>Fichas técnicas</strong> (menu): enviadas, aguardando e com prazo na semana.</>,
      <><strong>Lançar montagem e desmontagem na agenda do CC</strong> cria as atividades de apoio do evento a partir da ficha.</>,
      <><strong>Imprimir resumo</strong>: dados da ficha e o mapa das poltronas reservadas, para a equipe.</>,
    ],
    prints: [
      { arquivo: 'ficha-evento', legenda: 'No evento: o link e as ações da ficha', formato: 'recorte' },
      { arquivo: 'fichas', legenda: 'Menu Fichas técnicas', formato: 'pc' },
      { arquivo: 'ficha-produtor', legenda: 'O que o produtor vê, no celular', formato: 'cel' },
    ],
    dicas: [
      'Evento de um dia: a montagem e a desmontagem devem ser no mesmo dia; a ficha avisa e não deixa passar.',
      'E-mail: o GestorCC só manda quando você clica em Enviar, depois de ver para quem vai, o assunto e o texto (dá para mudar tudo). O Google deixa mandar cerca de 100 por dia.',
    ],
  },
  {
    id: 'cortesias', titulo: 'Cortesias', icone: Gift, publico: 'gestao',
    serve: 'Repartir as cortesias entre destinos (ex.: Casa do Estudante); cada destino lança os nomes pelo link.',
    passos: [
      <>No evento, <strong>Cortesias → Novo destino</strong>: nome do destino e quantidade.</>,
      <><strong>E-mail</strong> ou <strong>WhatsApp</strong> mandam a mensagem com o link ao responsável do destino.</>,
      'O destino lança nome e matrícula de quem vai receber, até o dia anterior ao evento.',
      <><strong>Imprimir lista</strong> no dia do evento: ordem alfabética, com a coluna para marcar a retirada.</>,
    ],
    prints: [
      { arquivo: 'cortesias-evento', legenda: 'No evento: os destinos e seus links', formato: 'recorte' },
      { arquivo: 'cortesias-destino', legenda: 'O que o destino vê, no celular', formato: 'cel' },
    ],
  },
  {
    id: 'escalas', titulo: 'Escalas: rodada, montar e publicar', icone: ClipboardList, publico: 'gestao',
    serve: 'Abrir a rodada de disponibilidade, montar a escala evento a evento e publicar.',
    passos: [
      <><strong>Escalas → Disponibilidade → Nova rodada</strong>: escolha as sessões e o prazo. Todos recebem o aviso no app.</>,
      <>Faltando respostas? <strong>Lembrar por e-mail</strong> manda um lembrete para cada pessoa que ainda não respondeu.</>,
      <>Se alguém avisou por fora, use <strong>Marcar por alguém</strong> (Sim/Não aparecem na hora e salvam juntos).</>,
      <><strong>Montar → Evento a evento</strong>: toque no bloco da pessoa para escalar; toque na vaga para tirar.</>,
      <><strong>Escalar próximo evento</strong> salva e passa para o seguinte. No último, <strong>Revisar e publicar</strong>.</>,
      <><strong>Ver escala</strong> mostra o mês (ou a rodada) por evento ou por pessoa, sem imprimir.</>,
      <>Em <strong>Publicadas</strong>, a mensagem de cada sessão vai pelo WhatsApp ou por <strong>E-mail para a equipe</strong>.</>,
      <>Trocas (inclusive depois do evento) em <strong>Publicadas → Trocar</strong>, com justificativa.</>,
      <><strong>Presença</strong>: depois do evento, confirme quem compareceu (isso libera o pagamento).</>,
    ],
    prints: [
      { arquivo: 'escalas-montar', legenda: 'Montar · evento a evento', formato: 'pc' },
      { arquivo: 'escalas-ver', legenda: 'Ver escala', formato: 'pc' },
    ],
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
      <>Esqueceu uma sessão? No lote ainda não pago, use <strong>Incluir sessões</strong>.</>,
      'Quando o pagamento sair, marque o lote como pago.',
    ],
    prints: [{ arquivo: 'pagamentos', legenda: 'Pagamentos', formato: 'pc' }],
  },
  {
    id: 'contratos', titulo: 'Contratos', icone: FileSignature, publico: 'gestao',
    serve: 'Acompanhar contrato, fatura, ECAD, ISS, FUNDEP e cortesias de cada evento.',
    passos: [
      'Cada contrato aparece com a trilha das 6 etapas: verde concluído, azul em andamento, amarelo a fazer, laranja prazo perto, vermelho atrasado.',
      'Clique num número do resumo no topo para ver só os contratos com aquela etapa pendente.',
      <>Documentos são gerados a partir dos modelos do Google Docs; o pedido à FUNDEP vai por e-mail, com os PDFs assinados anexados (ou como texto para copiar).</>,
      <><strong>Novo contratante</strong>: digite o CNPJ e o sistema preenche razão social, endereço, CEP e e-mail com os dados da Receita (confira antes de salvar).</>,
    ],
    prints: [{ arquivo: 'contratos', legenda: 'Contratos, com a trilha de etapas', formato: 'pc' }],
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
    prints: [{ arquivo: 'almox-saida', legenda: 'Saída de itens', formato: 'pc' }],
  },
  {
    id: 'infra', titulo: 'Infraestrutura (prédio)', icone: Wrench, publico: 'gestao',
    serve: 'Acompanhar os problemas do prédio, do relato até a solução.',
    passos: [
      'Os relatos chegam pelo app e pelo formulário de problemas.',
      'Mude a situação (análise, chamado aberto, em atendimento, resolvida) e registre o número do chamado.',
    ],
    prints: [{ arquivo: 'infra', legenda: 'Infraestrutura', formato: 'pc' }],
  },
  {
    id: 'achados', titulo: 'Achados e perdidos', icone: PackageSearch, publico: 'gestao',
    serve: 'Guardar os itens esquecidos no prédio, com foto, até o dono buscar ou o prazo para descartar vencer.',
    passos: [
      <><strong>Achados e perdidos → Registrar achado</strong>: descrição, data, local, onde ficou guardado e a foto (no celular, dá para tirar na hora).</>,
      'Cada item ganha um número (ex.: #12). Escreva o número na etiqueta do item guardado.',
      'A lista mostra há quantos dias o item está guardado e quanto falta para poder descartar (90 dias, ou o prazo de Configurações).',
      <><strong>Devolver ao dono</strong> pede quem retirou e um documento ou telefone. <strong>Descartar</strong> pede o destino (lixo, doação…).</>,
      <>Marcou por engano? Abra o item e use <strong>Voltar para os guardados</strong>.</>,
    ],
    dicas: [
      'Itens com o prazo vencido aparecem em "O que precisa de você", no Início. Nada é descartado sozinho.',
      'A busca do alto também encontra os achados (ex.: "guarda-chuva").',
      'A foto fica no Drive do setor, sem link público. 90 dias depois da devolução ou do descarte, a foto e os dados de quem retirou são apagados.',
    ],
    prints: [{ arquivo: 'achados', legenda: 'Achados e perdidos no celular', formato: 'cel' }],
  },
  {
    id: 'relatorio', titulo: 'Relatório mensal', icone: BarChart3, publico: 'gestao',
    serve: 'Panorama administrativo do setor no mês, para imprimir e prestar contas.',
    passos: [
      <>Abra <strong>Relatório mensal</strong>, escolha o mês e clique em <strong>Imprimir</strong>.</>,
      'Traz: números do mês e ocupação do espaço, eventos por tipo, equipe e diárias (em totais), contratos, ECAD, ISS e cortesias por evento, fichas técnicas, almoxarifado e prédio.',
    ],
    prints: [{ arquivo: 'relatorio', legenda: 'Relatório mensal', formato: 'pc' }],
  },
  {
    id: 'pessoas', titulo: 'Pessoas e configurações', icone: Users, publico: 'gestao',
    serve: 'Cadastrar a equipe, dar permissões e ajustar diária, vagas padrão, feriados e links.',
    passos: [
      <><strong>Pessoas → Nova pessoa</strong>: nome, e-mail, matrícula, tipo (bolsista/servidor) e vínculo (fixo/eventual).</>,
      'A senha inicial é a matrícula. Para quem esqueceu: Redefinir senha para a matrícula.',
      <><strong>Configurações</strong>: diária padrão, vagas padrão, feriados (com <strong>Importar feriados nacionais</strong>), edital/iniciativa, FUNDEP, links (ex.: folder do CC).</>,
      <><strong>Configurações → Saúde do sistema</strong>: último backup, rotinas automáticas, agenda Google, e-mails do dia e erros recentes.</>,
      <><strong>Configurações → Dados pessoais (LGPD)</strong>: em quantos dias depois do evento o sistema apaga os nomes das cortesias e os dados do responsável da ficha.</>,
    ],
    prints: [{ arquivo: 'pessoas', legenda: 'Pessoas', formato: 'pc' }],
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
            <p className="manual-capa-nota">As imagens são telas reais do sistema, com dados fictícios.</p>
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
            {/* só prints de celular: ficam ao lado dos passos; os de computador vão embaixo, maiores */}
            <div className="manual-conteudo" data-lado={s.prints?.every((p) => p.formato === 'cel') ? '' : undefined}>
              <ol className="manual-passos">
                {s.passos.map((p, k) => (
                  <li key={k}>{p}</li>
                ))}
              </ol>
              {s.prints && (
                <div className="manual-prints">
                  {s.prints.map((p) => (
                    <figure key={p.arquivo} className="manual-print" data-formato={p.formato}>
                      <img src={`/manual/${p.arquivo}.jpg`} alt={p.legenda} />
                      <figcaption>{p.legenda}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
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
