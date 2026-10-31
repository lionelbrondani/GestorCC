import { avaliarSaude, formatarDataHora, type SituacaoSaude } from '@shared';
import { useConsulta } from '../../api/hooks';
import { Alerta, Cartao, Etiqueta } from '../../componentes';
import './saude.css';

const ETIQUETA: Record<SituacaoSaude, { tom: 'sucesso' | 'aviso' | 'erro'; texto: string }> = {
  ok: { tom: 'sucesso', texto: 'ok' },
  atencao: { tom: 'aviso', texto: 'atenção' },
  problema: { tom: 'erro', texto: 'problema' },
};

const NOME_TABELA: Record<string, string> = {
  pessoas: 'Pessoas', eventos: 'Eventos', sessoes: 'Sessões', escalas: 'Escalas', contratos: 'Contratos', historico: 'Histórico', notificacoes: 'Avisos do sininho',
};

/** Para quem mantém o GestorCC: o que costuma dar problema, sem precisar abrir o Apps Script. */
export function CartaoSaude() {
  const saude = useConsulta('sistema.saude', null);
  if (saude.isLoading) {
    return (
      <Cartao titulo="Saúde do sistema">
        <p className="texto-3 pequeno">Conferindo…</p>
      </Cartao>
    );
  }
  if (!saude.data) {
    return (
      <Cartao titulo="Saúde do sistema">
        <Alerta tom="erro">Não foi possível conferir agora. {saude.error?.message}</Alerta>
      </Cartao>
    );
  }
  const s = saude.data;
  const itens = avaliarSaude(s);
  return (
    <Cartao titulo="Saúde do sistema" acoes={<span className="pequeno texto-3">API {s.versao}</span>} destaque={itens.some((i) => i.situacao !== 'ok')}>
      <ul className="saude-lista">
        {itens.map((i) => (
          <li key={i.chave}>
            <Etiqueta tom={ETIQUETA[i.situacao].tom}>{ETIQUETA[i.situacao].texto}</Etiqueta>
            <span>
              <strong>{i.titulo}</strong>
              <span className="texto-2"> · {i.texto}</span>
            </span>
          </li>
        ))}
      </ul>
      {s.erros.length > 0 && (
        <details className="saude-erros">
          <summary className="pequeno">Últimos erros ({s.erros.length})</summary>
          <ul className="pequeno">
            {s.erros.map((e, k) => (
              <li key={k}>
                <strong>{formatarDataHora(e.quando)}</strong> · {e.acao}: {e.mensagem}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="pequeno texto-3">Linhas nas planilhas: {s.tabelas.map((t) => `${NOME_TABELA[t.tabela] ?? t.tabela} ${t.linhas}`).join(' · ')}</p>
    </Cartao>
  );
}
