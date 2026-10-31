import { formatarData, formatarReais, pode, type Lote } from '@shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEu } from '../../auth/SessaoContexto';
import { Abas, Botao, Carregando, Etiqueta, Pagina, Tabela } from '../../componentes';
import { DadosExterno } from './DadosExterno';
import { useDadosPagamentos } from './dadosPagamentos';

export const ETIQUETA_LOTE: Record<Lote['status'], { texto: string; tom: 'aviso' | 'sucesso' | 'neutro' }> = {
  enviado: { texto: 'Enviado', tom: 'aviso' },
  pago: { texto: 'Pago', tom: 'sucesso' },
  cancelado: { texto: 'Cancelado', tom: 'neutro' },
};

export function Pagamentos() {
  const eu = useEu();
  const navegar = useNavigate();
  const [aba, setAba] = useState<'lotes' | 'externo'>('lotes');
  const dados = useDadosPagamentos();
  if (dados.carregando) return <Carregando />;

  const total = (l: Lote) => dados.itens.filter((i) => i.loteId === l.id).reduce((acc, i) => acc + i.valor, 0);
  const lotes = [...dados.base.lotes].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  return (
    <Pagina
      titulo="Pagamentos"
      subtitulo="Lotes enviados ao setor de pagamento e eventos pagos por terceiros."
      acoes={
        pode(eu.permissoes, 'pagamentos', 'editar') && (
          <Botao variante="primario" onClick={() => navegar('/pagamentos/novo')}>
            <Plus size={16} aria-hidden /> Novo lote
          </Botao>
        )
      }
    >
      <Abas
        abas={[
          { id: 'lotes', rotulo: 'Lotes' },
          { id: 'externo', rotulo: 'Pagamento externo' },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />
      {aba === 'lotes' ? (
        <Tabela
          colunas={[
            { chave: 'titulo', titulo: 'Lote', render: (l) => <strong>{l.titulo}</strong> },
            { chave: 'periodo', titulo: 'Período', render: (l) => <span className="pequeno">{l.periodoReferencia}</span> },
            { chave: 'status', titulo: 'Situação', render: (l) => <Etiqueta tom={ETIQUETA_LOTE[l.status].tom}>{ETIQUETA_LOTE[l.status].texto}</Etiqueta> },
            { chave: 'total', titulo: 'Total', alinhar: 'direita', render: (l) => <span className="numero">{formatarReais(total(l))}</span> },
            { chave: 'data', titulo: 'Criado / pago', render: (l) => `${formatarData(l.criadoEm.slice(0, 10))}${l.pagoEm ? ` · pago ${formatarData(l.pagoEm)}` : ''}` },
          ]}
          linhas={lotes}
          chaveLinha={(l) => l.id}
          aoClicar={(l) => navegar(`/pagamentos/${l.id}`)}
          vazio="Nenhum lote criado ainda."
        />
      ) : (
        <DadosExterno dados={dados} />
      )}
    </Pagina>
  );
}
