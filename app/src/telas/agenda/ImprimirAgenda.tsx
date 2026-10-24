import { diaDaSemana, diasDoMes, mesExtenso, type Sessao } from '@shared';
import { Printer } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { usePeriodo, usePessoas } from '../../api/consultas';
import { useConsulta } from '../../api/hooks';
import { Botao, Carregando } from '../../componentes';
import { hoje } from '../../util/hoje';
import './agenda.css';

function rotuloDia(d: string): string {
  const dia = diaDaSemana(d);
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${d.slice(8, 10)}`;
}

function horario(s: Sessao): string {
  const h = s.horarioADefinir || !s.inicio ? 'a definir' : s.fim ? `${s.inicio} - ${s.fim}` : s.inicio;
  return s.rotulo ? `${s.rotulo}: ${h}` : h;
}

export function ImprimirAgenda() {
  const [params] = useSearchParams();
  const mes = params.get('mes') ?? hoje().slice(0, 7);
  const [ano, m] = mes.split('-').map(Number);
  const dias = diasDoMes(ano, m);
  const periodo = usePeriodo(dias[0], dias[dias.length - 1]);
  const feriados = useConsulta('feriados.listar', { ano });
  const pessoas = usePessoas();

  if (periodo.isLoading || feriados.isLoading) return <Carregando />;

  const feriado = new Map((feriados.data ?? []).map((f) => [f.data, f.nome]));

  return (
    <div className="pilha">
      <div className="linha nao-imprimir">
        <Botao variante="primario" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir
        </Botao>
        <span className="texto-2 pequeno">Formato A4 retrato. No diálogo de impressão, escolha "Salvar como PDF" se preferir.</span>
      </div>
      <div className="folha-impressao agenda-impressa">
        <h1>
          {mesExtenso(m)}/{ano}
        </h1>
        <table>
          <thead>
            <tr>
              <th>DIA</th>
              <th>EVENTO</th>
              <th>RESPONSÁVEL</th>
              <th>RESP NUGAC</th>
              <th>HORÁRIO</th>
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => {
              const sessoes = periodo.sessoes.filter((s) => s.data === d && s.status === 'ativa');
              const eventos = [...new Set(sessoes.map((s) => s.eventoId))].map((id) => periodo.evento.get(id)!).filter((e) => e?.status === 'ativo');
              if (feriado.has(d) && eventos.length === 0) {
                return (
                  <tr key={d} className="feriado">
                    <td>{rotuloDia(d)}</td>
                    <td colSpan={4}>FERIADO{feriado.get(d) ? ` – ${feriado.get(d)}` : ''}</td>
                  </tr>
                );
              }
              return (
                <tr key={d}>
                  <td>{rotuloDia(d)}</td>
                  <td>
                    {eventos.map((e) => (
                      <div key={e.id}>{e.nome}</div>
                    ))}
                  </td>
                  <td>
                    {eventos.map((e) => (
                      <div key={e.id}>
                        {e.organizador}
                        {e.contatoOrganizador ? ` / ${e.contatoOrganizador}` : ''}
                      </div>
                    ))}
                  </td>
                  <td>
                    {eventos.map((e) => (
                      <div key={e.id}>{(e.servidorResponsavelId && pessoas.pessoa.get(e.servidorResponsavelId)?.nome.split(' ')[0]) || ''}</div>
                    ))}
                  </td>
                  <td>
                    {sessoes.map((s) => (
                      <div key={s.id}>{horario(s)}</div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
