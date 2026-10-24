import { diaDaSemana, mesExtenso, type Escala } from '@shared';
import { Printer } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Botao, Carregando, EstadoVazio } from '../../componentes';
import { hoje } from '../../util/hoje';
import { useDadosEscalas } from './dadosEscalas';
import { paginarColunas } from './paginarColunas';

const POR_PAGINA = 12;
const STATUS_IMPRESSOS: Escala['status'][] = ['publicado', 'realizado', 'faltou'];

export function ImprimirEscala() {
  const [params] = useSearchParams();
  const mes = params.get('mes') ?? hoje().slice(0, 7);
  const [ano, m] = mes.split('-').map(Number);
  const dados = useDadosEscalas(mes);
  if (dados.carregando) return <Carregando />;

  const sessoes = dados.sessoes.filter((s) => s.publicadaEm && s.status === 'ativa');
  const escaladas = dados.escalas.filter((e) => STATUS_IMPRESSOS.includes(e.status) && sessoes.some((s) => s.id === e.sessaoId));
  const ids = new Set(escaladas.map((e) => e.pessoaId));
  const pessoas = dados.pessoas.lista
    .filter((p) => ids.has(p.id))
    .sort((a, b) => Number(a.tipo === 'bolsista') - Number(b.tipo === 'bolsista') || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  const escalado = new Set(escaladas.map((e) => `${e.sessaoId}|${e.pessoaId}`));
  const paginas = paginarColunas(sessoes, POR_PAGINA);

  return (
    <div className="pilha">
      <div className="linha nao-imprimir">
        <Botao variante="primario" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir
        </Botao>
        <span className="texto-2 pequeno">A4 paisagem, {paginas.length} página(s). Escolha "Salvar como PDF" para enviar aos servidores.</span>
      </div>
      {!sessoes.length ? (
        <EstadoVazio titulo="Nenhuma sessão publicada neste mês" />
      ) : (
        <div className="folha-impressao escala-impressa">
          {paginas.map((pagina, i) => (
            <section key={i} className="pagina-impressao">
              <span className="losango-canto" style={{ top: -6, right: -6 }} aria-hidden />
              <h1>TABELA DE ESCALA DOS BOLSISTAS</h1>
              <p className="subtitulo">
                Período de Referência: {mesExtenso(m)}/{ano}
              </p>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    {pagina.map((s) => {
                      const ev = dados.periodo.evento.get(s.eventoId);
                      return (
                        <th key={s.id} scope="col">
                          <div>{s.data.slice(8, 10)}/{s.data.slice(5, 7)}</div>
                          <div className="dia">{diaDaSemana(s.data)}</div>
                          <div className="evento">
                            {ev?.nome}
                            {s.rotulo ? ` – ${s.rotulo}` : ''}
                          </div>
                          <div>{s.horarioADefinir || !s.inicio ? 'a definir' : s.inicio}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr className="chegada">
                    <td>Estar no CC</td>
                    {pagina.map((s) => (
                      <td key={s.id}>{s.horarioADefinir || !s.chegada ? 'a definir' : s.chegada}</td>
                    ))}
                  </tr>
                  {pessoas.map((p) => (
                    <tr key={p.id}>
                      <td className="nome">
                        {p.nome.split(' ')[0]}
                        {p.nomeCurto.includes('.') || pessoas.some((o) => o.id !== p.id && o.nome.split(' ')[0] === p.nome.split(' ')[0]) ? ` ${p.nome.split(' ').slice(-1)[0][0]}.` : ''}
                        {p.tipo === 'servidor' ? ' (serv.)' : ''}
                      </td>
                      {pagina.map((s) => (
                        <td key={s.id}>{escalado.has(`${s.id}|${p.id}`) ? 'X' : ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
