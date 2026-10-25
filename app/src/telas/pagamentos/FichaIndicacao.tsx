import { formatarReais, montarFicha, pode, type DadosPessoais, type Ficha, type Lote } from '@shared';
import { useQuery } from '@tanstack/react-query';
import { Copy, Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { consultar, useApi } from '../../api/cliente';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Botao, Carregando } from '../../componentes';
import { copiarTexto } from '../escalas/dadosEscalas';
import type { useDadosPagamentos } from './dadosPagamentos';

function fichaEmTexto(f: Ficha): string {
  const linhas = f.linhas.map((l) => [l.ordem, l.nome, l.matricula, l.cpf, l.banco, l.agencia, l.conta, formatarReais(l.valor)].join('\t'));
  return [
    f.titulo,
    `Período de Referência: ${f.periodoReferencia}`,
    f.iniciativaEdital,
    '',
    ['', 'NOME', 'MATRÍCULA', 'CPF', 'BANCO', 'AGÊNCIA', 'CONTA', 'VALOR (R$)'].join('\t'),
    ...linhas,
    ['', 'TOTAL', '', '', '', '', '', formatarReais(f.total)].join('\t'),
    '',
    f.textoEncaminhamento,
    'Segue abaixo a discriminação dos eventos que cada bolsista atuou:',
    ...f.discriminacao.map((d) => `${d.nome} - ${d.eventos}`),
    `PS: ${f.observacao}`,
    'Cordialmente,',
  ].join('\n');
}

export function FichaHtml({ ficha }: { ficha: Ficha }) {
  return (
    <div className="ficha" id="ficha-indicacao">
      <p style={{ textAlign: 'center' }}>
        <strong>{ficha.titulo}</strong>
      </p>
      <p>Período de Referência: {ficha.periodoReferencia}</p>
      <p>{ficha.iniciativaEdital}</p>
      <table>
        <thead>
          <tr>
            {['', 'NOME', 'MATRÍCULA', 'CPF', 'BANCO', 'AGÊNCIA', 'CONTA', 'VALOR (R$)'].map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ficha.linhas.map((l) => (
            <tr key={l.ordem}>
              <td>{l.ordem}</td>
              <td>{l.nome}</td>
              <td>{l.matricula}</td>
              <td>{l.cpf}</td>
              <td>{l.banco}</td>
              <td>{l.agencia}</td>
              <td>{l.conta}</td>
              <td>{formatarReais(l.valor)}</td>
            </tr>
          ))}
          <tr>
            <td />
            <td>
              <strong>TOTAL</strong>
            </td>
            <td colSpan={5} />
            <td>
              <strong>{formatarReais(ficha.total)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p>{ficha.textoEncaminhamento}</p>
      <p>Segue abaixo a discriminação dos eventos que cada bolsista atuou:</p>
      {ficha.discriminacao.map((d) => (
        <p key={d.nome}>
          {d.nome} - {d.eventos}
        </p>
      ))}
      <p>PS: {ficha.observacao}</p>
      <p>Cordialmente,</p>
    </div>
  );
}

export function FichaIndicacao({ lote, dados }: { lote: Lote; dados: ReturnType<typeof useDadosPagamentos> }) {
  const eu = useEu();
  const api = useApi();
  const podeVer = pode(eu.permissoes, 'dadosPessoais', 'ver');
  const [msg, setMsg] = useState<string | null>(null);
  const pessoasLote = dados.pessoas.lista.filter((p) => p.tipo === 'bolsista');
  const dadosPessoais = useQuery({
    queryKey: ['fichaDados', lote.id, podeVer],
    enabled: podeVer,
    queryFn: async () => (await Promise.all(pessoasLote.map((p) => consultar(api, 'dadosPessoais.obter', { pessoaId: p.id })))).filter((d): d is DadosPessoais => !!d),
  });
  if (podeVer && dadosPessoais.isLoading) return <Carregando texto="Montando a ficha…" />;

  const ficha = montarFicha({
    lote,
    itens: dados.itens,
    pessoas: dados.pessoas.lista,
    dados: dadosPessoais.data ?? [],
    base: dados.base,
    mascarar: !podeVer,
  });

  return (
    <div className="pilha">
      {!podeVer && <Alerta tom="aviso">CPF e dados bancários estão ocultos: seu acesso não inclui "Dados pessoais".</Alerta>}
      <div className="linha nao-imprimir">
        <Botao
          variante="primario"
          onClick={async () => {
            const html = document.getElementById('ficha-indicacao')?.outerHTML ?? '';
            setMsg((await copiarTexto(fichaEmTexto(ficha), html)) ? 'Copiado! Cole no corpo do e-mail.' : 'Não foi possível copiar.');
          }}
        >
          <Copy size={16} aria-hidden /> Copiar para o e-mail
        </Botao>
        <Botao
          onClick={async () => {
            const { baixarArquivo, gerarFichaDocx } = await import('./fichaDocx');
            baixarArquivo(await gerarFichaDocx(ficha), `ficha-indicacao-${lote.id}.docx`);
          }}
        >
          <Download size={16} aria-hidden /> Baixar .docx
        </Botao>
        <Botao onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir / PDF
        </Botao>
        {msg && <span className="pequeno texto-2">{msg}</span>}
      </div>
      <div className="folha-impressao" style={{ padding: 16, border: '1px solid var(--cor-borda)', borderRadius: 10, overflowX: 'auto' }}>
        <FichaHtml ficha={ficha} />
      </div>
    </div>
  );
}
