import { EstadoVazio, Pagina } from '../../componentes';
import { DO_SETOR } from '@shared';

/** Execução orçamentária: aba reservada; os campos e relatórios serão definidos com a coordenação. */
export function Orcamento() {
  return (
    <Pagina titulo="Execução orçamentária" subtitulo={`Acompanhamento do orçamento ${DO_SETOR}.`}>
      <EstadoVazio
        titulo="Em configuração"
        texto="Esta área vai acompanhar a execução do orçamento (receitas, despesas e saldos). Os campos serão definidos com a coordenação."
      />
    </Pagina>
  );
}
