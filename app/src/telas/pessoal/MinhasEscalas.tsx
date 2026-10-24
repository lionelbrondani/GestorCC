import { diaDaSemanaCurto, type Escala } from '@shared';
import { CalendarPlus } from 'lucide-react';
import { useState } from 'react';
import { usePeriodo, usePessoas } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Abas, Carregando, Cartao, EstadoVazio, Etiqueta, Pagina } from '../../componentes';
import { hoje, janela } from '../../util/hoje';
import { chegadaTexto, dataLonga, linkGoogleAgenda, tituloSessao } from '../../util/sessoes';
import './pessoal.css';

const ROTULO_STATUS: Partial<Record<Escala['status'], { texto: string; tom: 'sucesso' | 'erro' | 'neutro' | 'info' }>> = {
  realizado: { texto: 'Realizada', tom: 'sucesso' },
  faltou: { texto: 'Falta', tom: 'erro' },
  cancelado: { texto: 'Cancelada', tom: 'neutro' },
};

export function MinhasEscalas() {
  const eu = useEu();
  const { de, ate } = janela(180, 180);
  const periodo = usePeriodo(de, ate);
  const escalas = useConsulta('escalas.listar', { de, ate });
  const pessoas = usePessoas();
  const [aba, setAba] = useState<'proximas' | 'anteriores'>('proximas');

  if (periodo.isLoading || escalas.isLoading) return <Carregando />;

  const todas = escalas.data ?? [];
  const minhas = todas
    .filter((e) => e.pessoaId === eu.id && e.status !== 'rascunho')
    .map((e) => ({ e, s: periodo.sessao.get(e.sessaoId) }))
    .filter((x): x is { e: Escala; s: NonNullable<typeof x.s> } => !!x.s)
    .sort((a, b) => a.s.data.localeCompare(b.s.data) || (a.s.chegada ?? '').localeCompare(b.s.chegada ?? ''));

  const proximas = minhas.filter((x) => x.s.data >= hoje());
  const anteriores = minhas.filter((x) => x.s.data < hoje()).reverse();
  const lista = aba === 'proximas' ? proximas : anteriores;

  return (
    <Pagina titulo="Minhas escalas" subtitulo="Seus eventos publicados no Centro de Convenções.">
      <Abas
        abas={[
          { id: 'proximas', rotulo: `Próximas (${proximas.length})` },
          { id: 'anteriores', rotulo: `Anteriores (${anteriores.length})` },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />
      {lista.length === 0 ? (
        <EstadoVazio titulo="Você ainda não tem escalas publicadas." texto="Quando a escala do mês sair, ela aparece aqui." />
      ) : (
        <div className="pilha">
          {lista.map(({ e, s }) => {
            const ev = periodo.evento.get(s.eventoId);
            const colegas = todas
              .filter((x) => x.sessaoId === s.id && x.pessoaId !== eu.id && !['rascunho', 'cancelado'].includes(x.status))
              .map((x) => pessoas.pessoa.get(x.pessoaId)?.nomeCurto ?? '—');
            const status = ROTULO_STATUS[e.status];
            return (
              <Cartao key={e.id}>
                <div className="escala-item">
                  <div className="escala-data" aria-hidden>
                    <small>{diaDaSemanaCurto(s.data)}</small>
                    <strong>{s.data.slice(8, 10)}</strong>
                    <small>{s.data.slice(5, 7)}/{s.data.slice(2, 4)}</small>
                  </div>
                  <div className="pilha-2">
                    <div className="linha-entre">
                      <h3>{tituloSessao(ev, s)}</h3>
                      <span className="linha">
                        {e.papel === 'servidor' && <Etiqueta tom="info">Responsável</Etiqueta>}
                        {status && <Etiqueta tom={status.tom}>{status.texto}</Etiqueta>}
                      </span>
                    </div>
                    <p className="texto-2">
                      {dataLonga(s.data)} · <strong>Chegar às {chegadaTexto(s)}</strong>
                      {s.inicio && ` · início ${s.inicio}`}
                    </p>
                    {colegas.length > 0 && <p className="pequeno texto-2">Com: {colegas.join(', ')}</p>}
                    {aba === 'proximas' && e.status === 'publicado' && (
                      <a className="cc-botao" data-variante="fantasma" data-tamanho="pequeno" href={linkGoogleAgenda(ev, s)} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>
                        <CalendarPlus size={16} aria-hidden /> Adicionar ao Google Agenda
                      </a>
                    )}
                  </div>
                </div>
              </Cartao>
            );
          })}
        </div>
      )}
    </Pagina>
  );
}
