import { diaDaSemana, diaDaSemanaCurto, formatarData, mesExtenso, type Escala, type Pessoa, type Sessao } from '@shared';
import { Printer } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Botao, Carregando, EstadoVazio } from '../../componentes';
import { hoje } from '../../util/hoje';
import { tituloSessao } from '../../util/sessoes';
import { mesCurto } from '../../util/sessoes';
import { CabecalhoImpresso, SeletorModelo, useModelo } from '../impressao/ModeloImpressao';
import { useDadosEscalas } from './dadosEscalas';
import { paginarColunas } from './paginarColunas';

const POR_PAGINA = 12;
const STATUS_IMPRESSOS: Escala['status'][] = ['publicado', 'realizado', 'faltou'];

type Dados = ReturnType<typeof useDadosEscalas>;
interface Base {
  dados: Dados;
  sessoes: Sessao[];
  pessoas: Pessoa[];
  escalado: Set<string>;
  escaladas: Escala[];
  mes: number;
  ano: number;
}

function nomeNaGrade(p: Pessoa, todas: Pessoa[]): string {
  const primeiro = p.nome.split(' ')[0];
  const repetido = p.nomeCurto.includes('.') || todas.some((o) => o.id !== p.id && o.nome.split(' ')[0] === primeiro);
  return `${primeiro}${repetido ? ` ${p.nome.split(' ').slice(-1)[0][0]}.` : ''}${p.tipo === 'servidor' ? ' (serv.)' : ''}`;
}

function EscalaLegado({ dados, sessoes, pessoas, escalado, mes, ano }: Base) {
  const paginas = paginarColunas(sessoes, POR_PAGINA);
  return (
    <div className="folha-impressao escala-impressa">
      {paginas.map((pagina, i) => (
        <section key={i} className="pagina-impressao">
          <span className="losango-canto" style={{ top: -6, right: -6 }} aria-hidden />
          <h1>TABELA DE ESCALA DOS BOLSISTAS</h1>
          <p className="subtitulo">
            Período de Referência: {mesExtenso(mes)}/{ano}
          </p>
          <table>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                {pagina.map((s) => {
                  const ev = dados.periodo.evento.get(s.eventoId);
                  return (
                    <th key={s.id} scope="col">
                      <div>
                        {s.data.slice(8, 10)}/{s.data.slice(5, 7)}
                      </div>
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
                  <td className="nome">{nomeNaGrade(p, pessoas)}</td>
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
  );
}

function EscalaAtualizada({ dados, sessoes, pessoas, escaladas, mes, ano }: Base) {
  const nomes = (s: Sessao, papel: 'servidor' | 'bolsista') =>
    escaladas
      .filter((e) => e.sessaoId === s.id && e.papel === papel)
      .map((e) => dados.pessoas.pessoa.get(e.pessoaId)?.nome ?? '—')
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const contagem = pessoas
    .map((p) => ({ p, n: escaladas.filter((e) => e.pessoaId === p.id).length }))
    .sort((a, b) => b.n - a.n || a.p.nome.localeCompare(b.p.nome, 'pt-BR'));

  return (
    <div className="impresso impresso-retrato">
      <CabecalhoImpresso titulo="ESCALA DO CENTRO DE CONVENÇÕES" subtitulo={`${mesExtenso(mes)}/${ano} · ${sessoes.length} sessões publicadas`} />
      {sessoes.map((s) => {
        const servidores = nomes(s, 'servidor');
        const bolsistas = nomes(s, 'bolsista');
        return (
          <section key={s.id} className="impresso-bloco" data-testid="bloco-sessao">
            <div className="impresso-data">
              <small>{diaDaSemanaCurto(s.data)}</small>
              <strong>{s.data.slice(8, 10)}</strong>
              <small>
                {mesCurto(s.data)}
              </small>
            </div>
            <div>
              <h2>{tituloSessao(dados.periodo.evento.get(s.eventoId), s)}</h2>
              <p className="impresso-meta">
                Chegada no CC: <strong>{s.horarioADefinir || !s.chegada ? 'a definir' : s.chegada}</strong>
                {s.inicio && !s.horarioADefinir && <> · início {s.inicio}</>}
                {s.fim && !s.horarioADefinir && <> · fim {s.fim}</>}
                {servidores.length > 0 && (
                  <>
                    {' '}
                    · Responsável: <strong>{servidores.join(', ')}</strong>
                  </>
                )}
              </p>
              <div className="impresso-rotulo">Bolsistas ({bolsistas.length})</div>
              {bolsistas.length ? (
                <ol className="impresso-nomes">
                  {bolsistas.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ol>
              ) : (
                <p className="impresso-meta">Nenhum bolsista escalado.</p>
              )}
            </div>
          </section>
        );
      })}
      <section className="impresso-resumo">
        <h2>Escalas por pessoa</h2>
        <ul>
          {contagem.map(({ p, n }) => (
            <li key={p.id}>
              {p.nome.split(' ')[0]} {p.nome.split(' ').slice(-1)[0]}: <strong>{n}</strong>
            </li>
          ))}
        </ul>
      </section>
      <p className="impresso-rodape">Gerado pelo GestorCC em {formatarData(hoje())}</p>
    </div>
  );
}

export function ImprimirEscala() {
  const [params] = useSearchParams();
  const [modelo, setModelo] = useModelo();
  const mesParam = params.get('mes') ?? hoje().slice(0, 7);
  const [ano, mes] = mesParam.split('-').map(Number);
  const dados = useDadosEscalas(mesParam);
  if (dados.carregando) return <Carregando />;

  const sessoes = dados.sessoes.filter((s) => s.publicadaEm && s.status === 'ativa');
  const escaladas = dados.escalas.filter((e) => STATUS_IMPRESSOS.includes(e.status) && sessoes.some((s) => s.id === e.sessaoId));
  const ids = new Set(escaladas.map((e) => e.pessoaId));
  const pessoas = dados.pessoas.lista
    .filter((p) => ids.has(p.id))
    .sort((a, b) => Number(a.tipo === 'bolsista') - Number(b.tipo === 'bolsista') || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  const base: Base = { dados, sessoes, pessoas, escaladas, escalado: new Set(escaladas.map((e) => `${e.sessaoId}|${e.pessoaId}`)), mes, ano };
  const paginas = paginarColunas(sessoes, POR_PAGINA).length;

  return (
    <div className="pilha">
      <SeletorModelo modelo={modelo} aoMudar={setModelo} />
      <div className="linha nao-imprimir">
        <Botao variante="primario" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir
        </Botao>
        <span className="texto-2 pequeno">
          {modelo === 'legado'
            ? `Modelo legado (grade com X): A4 paisagem, ${paginas} página(s).`
            : 'Modelo atualizado: A4 retrato, uma sessão por bloco com a equipe.'}{' '}
          Escolha "Salvar como PDF" para enviar aos servidores.
        </span>
      </div>
      {!sessoes.length ? (
        <EstadoVazio titulo="Nenhuma sessão publicada neste mês" />
      ) : modelo === 'legado' ? (
        <EscalaLegado {...base} />
      ) : (
        <EscalaAtualizada {...base} />
      )}
    </div>
  );
}
