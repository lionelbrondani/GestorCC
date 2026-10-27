import { EstadoVazio, Pagina } from '../../componentes';

/** Execução orçamentária: aba reservada; os campos e relatórios serão definidos com a coordenação. */
export function Orcamento() {
  return (
    <Pagina titulo="Execução orçamentária" subtitulo="Acompanhamento do orçamento do Centro de Convenções.">
      <EstadoVazio
        titulo="Em configuração"
        texto="Esta área vai acompanhar a execução do orçamento (receitas, despesas e saldos). Os campos serão definidos com a coordenação."
      />
    </Pagina>
  );
}
