import { ExternalLink } from 'lucide-react';
import { useConsulta } from '../../api/hooks';
import { Carregando, Cartao, EstadoVazio, Pagina } from '../../componentes';

export function Formularios() {
  const q = useConsulta('config.obter', null);
  if (q.isLoading) return <Carregando />;
  const links = q.data?.linksFormularios ?? [];
  return (
    <Pagina titulo="Formulários" subtitulo="Formulários externos do setor. A visualização das respostas chega numa próxima etapa.">
      {!links.length ? (
        <EstadoVazio titulo="Nenhum formulário cadastrado" texto="Cadastre os links em Configurações." />
      ) : (
        <div className="grade-cartoes">
          {links.map((l) => (
            <Cartao key={l.url} titulo={l.nome}>
              <a href={l.url} target="_blank" rel="noreferrer" className="cc-botao" data-variante="secundario">
                <ExternalLink size={16} aria-hidden /> Abrir formulário
              </a>
            </Cartao>
          ))}
        </div>
      )}
    </Pagina>
  );
}
