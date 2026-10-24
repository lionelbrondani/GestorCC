import { ehGestor, formatarReais, pode, somarDias, valorTotalContrato } from '@shared';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePeriodo, usePessoas } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Carregando, Cartao, Etiqueta, Pagina } from '../../componentes';
import { hoje, janela } from '../../util/hoje';
import { chegadaTexto, dataLonga, tituloSessao } from '../../util/sessoes';
import { CartaoAviso } from '../pessoal/Avisos';
import { InicioBolsista } from './InicioBolsista';
import { calcularPendencias } from './pendencias';
import './inicio.css';

export function Inicio() {
  const eu = useEu();
  return ehGestor(eu.permissoes) ? <InicioGestor /> : <InicioBolsista />;
}

export function InicioGestor() {
  const eu = useEu();
  const p = eu.permissoes;
  const { de, ate } = janela(60, 90);
  const periodo = usePeriodo(de, ate);
  const escalas = useConsulta('escalas.listar', { de, ate });
  const rodadas = useConsulta('rodadas.listar', null);
  const pessoas = usePessoas();
  const idsRodadas = (rodadas.data ?? []).filter((r) => r.status === 'aberta').flatMap((r) => r.sessaoIds);
  const disp = useConsulta('disponibilidades.listar', { sessaoIds: idsRodadas }, { habilitada: !!rodadas.data });
  const almox = useConsulta('almox.listar', null, { habilitada: pode(p, 'almoxEstoque', 'ver') });
  const contratos = useConsulta('contratos.listar', null, { habilitada: pode(p, 'contratos', 'ver') });
  const avisos = useConsulta('avisos.listar', null);

  if (periodo.isLoading || escalas.isLoading) return <Carregando />;

  const h = hoje();
  const fimSemana = somarDias(h, 6);
  const ativas = periodo.sessoes.filter((s) => s.status === 'ativa').sort((a, b) => a.data.localeCompare(b.data) || (a.chegada ?? '').localeCompare(b.chegada ?? ''));
  const deHoje = ativas.filter((s) => s.data === h);
  const daSemana = ativas.filter((s) => s.data > h && s.data <= fimSemana);
  const pendencias = calcularPendencias({
    sessoes: periodo.sessoes, escalas: escalas.data ?? [], eventos: periodo.eventos, rodadas: rodadas.data ?? [],
    disponibilidades: disp.data ?? [], pessoas: pessoas.lista, itens: almox.data?.itens ?? [], contratos: contratos.data?.contratos ?? [],
    hoje: h, permissoes: p,
  });
  const ano = h.slice(0, 4);
  const doAno = (contratos.data?.contratos ?? []).filter((c) => c.numero.endsWith(ano) && c.statusContrato !== 'Cancelado');
  const contratado = doAno.reduce((acc, c) => acc + valorTotalContrato(c, contratos.data?.aditivos ?? []), 0);
  const pago = doAno.filter((c) => c.statusFatura === 'Paga').reduce((acc, c) => acc + valorTotalContrato(c, contratos.data?.aditivos ?? []), 0);
  const escaladosNa = (sessaoId: string) => (escalas.data ?? []).filter((e) => e.sessaoId === sessaoId && e.papel === 'bolsista' && ['publicado', 'rascunho', 'realizado'].includes(e.status)).length;

  const ListaSessoes = ({ lista, vazio }: { lista: typeof ativas; vazio: string }) =>
    lista.length === 0 ? (
      <p className="texto-3 pequeno">{vazio}</p>
    ) : (
      <ul className="inicio-lista">
        {lista.map((s) => (
          <li key={s.id}>
            <Link to={`/agenda/${s.eventoId}`}>
              <div>
                <strong>{tituloSessao(periodo.evento.get(s.eventoId), s)}</strong>
                <div className="pequeno texto-2">
                  {dataLonga(s.data)} · chegada {chegadaTexto(s)}
                </div>
              </div>
              <Etiqueta tom={escaladosNa(s.id) >= s.vagasBolsistas ? 'sucesso' : 'aviso'}>
                {escaladosNa(s.id)}/{s.vagasBolsistas}
              </Etiqueta>
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <Pagina titulo={`Bom trabalho, ${eu.nome.split(' ')[0]}!`} subtitulo={`Hoje é ${dataLonga(h)}.`}>
      <div className="grade-2">
        <Cartao titulo="Hoje" destaque={deHoje.length > 0}>
          <ListaSessoes lista={deHoje} vazio="Nenhum evento hoje." />
        </Cartao>
        <Cartao titulo="Próximos 7 dias">
          <ListaSessoes lista={daSemana} vazio="Nada marcado para a semana." />
        </Cartao>
      </div>

      <Cartao titulo={`Pendências (${pendencias.length})`}>
        {pendencias.length === 0 ? (
          <p className="texto-3 pequeno">Tudo em dia. 🎉</p>
        ) : (
          <ul className="inicio-lista">
            {pendencias.map((pd, i) => (
              <li key={i}>
                <Link to={pd.link}>
                  <span className="linha">
                    <AlertTriangle size={16} aria-hidden className="inicio-icone-pendencia" />
                    {pd.texto}
                  </span>
                  <ChevronRight size={16} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {contratos.data && (
        <div className="grade-cartoes">
          <Cartao>
            <div className="cc-rotulo-numero">Contratado em {ano}</div>
            <div className="cc-numero">{formatarReais(contratado)}</div>
          </Cartao>
          <Cartao>
            <div className="cc-rotulo-numero">Faturas pagas</div>
            <div className="cc-numero">{formatarReais(pago)}</div>
          </Cartao>
        </div>
      )}

      {(avisos.data ?? []).filter((a) => a.fixado).map((a) => (
        <CartaoAviso key={a.id} aviso={a} compacto />
      ))}
    </Pagina>
  );
}
