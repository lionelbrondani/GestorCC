import { formatarData, mascararCpf, pode, type DadosPessoais, type Evento } from '@shared';
import { useQuery } from '@tanstack/react-query';
import { Copy, Printer } from 'lucide-react';
import { useState } from 'react';
import { consultar, useApi } from '../../api/cliente';
import { useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Botao, Cartao, EstadoVazio } from '../../componentes';

import { copiarTexto } from '../escalas/dadosEscalas';
import type { useDadosPagamentos } from './dadosPagamentos';

const CAMPOS = ['Nome', 'Matrícula', 'Função', 'Data e horário', 'CPF', 'Banco'] as const;
type CampoExterno = (typeof CAMPOS)[number];
const SIGILOSOS: CampoExterno[] = ['CPF', 'Banco'];

function TabelaExterno({ evento, dados }: { evento: Evento; dados: ReturnType<typeof useDadosPagamentos> }) {
  const eu = useEu();
  const api = useApi();
  const podeSigilo = pode(eu.permissoes, 'dadosPessoais', 'ver');
  const [campos, setCampos] = useState<Set<CampoExterno>>(new Set(['Nome', 'Matrícula', 'Função', 'Data e horário']));
  const [msg, setMsg] = useState<string | null>(null);
  const registrar = useMutacao('externos.registrarEnvio', ['historico.listar']);
  const sessoes = dados.periodo.sessoes.filter((s) => s.eventoId === evento.id && s.status === 'ativa');
  const escalas = dados.base.escalas.filter((e) => sessoes.some((s) => s.id === e.sessaoId) && e.status === 'realizado');
  const pessoaIds = [...new Set(escalas.map((e) => e.pessoaId))];
  const precisaSigilo = podeSigilo && SIGILOSOS.some((c) => campos.has(c));
  const sigilosos = useQuery({
    queryKey: ['externoDados', evento.id, precisaSigilo],
    enabled: precisaSigilo,
    queryFn: async () => (await Promise.all(pessoaIds.map((pessoaId) => consultar(api, 'dadosPessoais.obter', { pessoaId })))).filter((d): d is DadosPessoais => !!d),
  });

  const colunas = CAMPOS.filter((c) => campos.has(c));
  const linhas = escalas.map((e) => {
    const p = dados.pessoas.pessoa.get(e.pessoaId);
    const s = dados.periodo.sessao.get(e.sessaoId)!;
    const d = sigilosos.data?.find((x) => x.pessoaId === e.pessoaId);
    const valor: Record<CampoExterno, string> = {
      Nome: p?.nome ?? '',
      Matrícula: p?.matricula ?? '',
      Função: e.papel === 'servidor' ? 'Servidor responsável' : 'Bolsista de apoio',
      'Data e horário': `${formatarData(s.data)} ${s.rotulo ? `(${s.rotulo}) ` : ''}${s.inicio ?? ''}${s.fim ? `–${s.fim}` : ''}`,
      CPF: d ? (podeSigilo ? d.cpf : mascararCpf(d.cpf)) : '',
      Banco: d ? `${d.banco} ag. ${d.agencia} c/c ${d.conta}` : '',
    };
    return colunas.map((c) => valor[c]);
  });

  if (!escalas.length) return <p className="texto-3 pequeno">Ainda não há presença confirmada neste evento.</p>;

  return (
    <div className="pilha">
      <div className="linha">
        {CAMPOS.map((c) => (
          <label key={c} className="cc-caixa pequeno">
            <input
              type="checkbox"
              disabled={SIGILOSOS.includes(c) && !podeSigilo}
              checked={campos.has(c)}
              onChange={(e) => {
                const n = new Set(campos);
                if (e.target.checked) n.add(c);
                else n.delete(c);
                setCampos(n);
              }}
            />
            {c}
          </label>
        ))}
      </div>
      <div className="cc-tabela-caixa folha-impressao">
        <table className="cc-tabela">
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                {l.map((v, k) => (
                  <td key={k}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="linha nao-imprimir">
        <Botao
          onClick={async () => {
            const texto = [colunas.join('\t'), ...linhas.map((l) => l.join('\t'))].join('\n');
            setMsg((await copiarTexto(texto)) ? 'Copiado (cola direto numa planilha).' : 'Não foi possível copiar.');
          }}
        >
          <Copy size={16} aria-hidden /> Copiar
        </Botao>
        <Botao onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir / PDF
        </Botao>
        <Botao
          variante="primario"
          carregando={registrar.isPending}
          onClick={async () => {
            await registrar.mutateAsync({ eventoId: evento.id, campos: colunas });
            setMsg('Envio registrado.');
          }}
        >
          Marcar como enviado
        </Botao>
        {msg && <span className="pequeno texto-2">{msg}</span>}
      </div>
    </div>
  );
}

export function DadosExterno({ dados }: { dados: ReturnType<typeof useDadosPagamentos> }) {
  const externos = dados.periodo.eventos.filter((e) => e.pagamento === 'externo' && e.status === 'ativo');
  if (!externos.length) return <EstadoVazio titulo="Nenhum evento com pagamento externo" />;
  return (
    <div className="pilha">
      <Alerta tom="info">Estes eventos são pagos pela organização. O GestorCC só gera os dados para enviar; não acompanha o pagamento.</Alerta>
      {externos.map((e) => (
        <Cartao key={e.id} titulo={e.nome} acoes={<span className="pequeno texto-2">Pagador: {e.pagadorExterno}</span>}>
          <TabelaExterno evento={e} dados={dados} />
        </Cartao>
      ))}
    </div>
  );
}
