import { formatarDataHora } from '@shared';
import { Link } from 'react-router-dom';
import { usePeriodo } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Carregando, Cartao, EstadoVazio, Pagina } from '../../componentes';
import { agora, hoje, janela } from '../../util/hoje';
import { chegadaTexto, dataLonga, tituloSessao } from '../../util/sessoes';
import { CartaoAviso } from '../pessoal/Avisos';

export function InicioBolsista() {
  const eu = useEu();
  const { de, ate } = janela(1, 120);
  const periodo = usePeriodo(de, ate);
  const escalas = useConsulta('escalas.listar', { de, ate });
  const rodadas = useConsulta('rodadas.listar', null);
  const avisos = useConsulta('avisos.listar', null);

  if (periodo.isLoading || escalas.isLoading) return <Carregando />;

  const momento = agora();
  const proxima = (escalas.data ?? [])
    .filter((e) => e.pessoaId === eu.id && e.status === 'publicado')
    .map((e) => periodo.sessao.get(e.sessaoId))
    .filter((s): s is NonNullable<typeof s> => !!s && s.data >= hoje())
    .sort((a, b) => a.data.localeCompare(b.data) || (a.chegada ?? '').localeCompare(b.chegada ?? ''))[0];
  const rodada = (rodadas.data ?? []).find((r) => r.status === 'aberta' && r.prazo >= momento);
  const convocacoes = periodo.sessoes.filter((s) => s.convocacao && s.convocacao.abertaAte >= momento);
  const fixados = (avisos.data ?? []).filter((a) => a.fixado);

  return (
    <Pagina titulo={`Olá, ${eu.nome.split(' ')[0]}!`}>
      {rodada && (
        <Alerta tom="destaque">
          <div className="linha-entre">
            <span>
              Disponibilidade de <strong>{rodada.nome}</strong> aberta até {formatarDataHora(rodada.prazo)}.
            </span>
            <Link to="/disponibilidade" className="cc-botao" data-variante="primario" data-tamanho="pequeno">
              Responder
            </Link>
          </div>
        </Alerta>
      )}
      {convocacoes.length > 0 && (
        <Alerta tom="aviso">
          <div className="linha-entre">
            <span>Precisamos de mais bolsistas em {convocacoes.length} sessão(ões).</span>
            <Link to="/disponibilidade" className="cc-botao" data-variante="secundario" data-tamanho="pequeno">
              Ver
            </Link>
          </div>
        </Alerta>
      )}
      <Cartao titulo="Próxima escala" destaque={!!proxima}>
        {proxima ? (
          <div className="pilha-2">
            <h3 style={{ fontSize: '1.3rem' }}>{tituloSessao(periodo.evento.get(proxima.eventoId), proxima)}</h3>
            <p className="texto-2">{dataLonga(proxima.data)}</p>
            <p>
              <strong>{proxima.horarioADefinir || !proxima.chegada ? 'Horário a definir' : `Chegar às ${chegadaTexto(proxima)}`}</strong>
            </p>
            <Link to="/minhas-escalas" className="pequeno">
              Ver todas as minhas escalas
            </Link>
          </div>
        ) : (
          <EstadoVazio titulo="Nenhuma escala marcada" texto="Assim que você for escalado, o próximo evento aparece aqui." />
        )}
      </Cartao>
      <Link to="/relatar" className="cc-botao" data-variante="secundario" style={{ alignSelf: 'flex-start' }}>
        Viu algum problema no prédio? Relatar
      </Link>
      {fixados.map((a) => (
        <CartaoAviso key={a.id} aviso={a} compacto />
      ))}
    </Pagina>
  );
}
