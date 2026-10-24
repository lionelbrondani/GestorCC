import { pode } from '@shared';
import { Link } from 'react-router-dom';
import { useConsulta } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Cartao, Pagina } from '../../componentes';
import { recursoAtivo } from '../../recursos';
import { dataLonga } from '../../util/sessoes';
import { hoje } from '../../util/hoje';
import { CartaoAviso } from '../pessoal/Avisos';

/** Início usado enquanto eventos e escalas ainda não estão ligados aos dados reais. */
export function InicioSimples() {
  const eu = useEu();
  const avisos = useConsulta('avisos.listar', null);
  const atalhos = [
    pode(eu.permissoes, 'pessoas', 'ver') && recursoAtivo('pessoas') && { rota: '/pessoas', texto: 'Pessoas e acessos', dica: 'Cadastrar a equipe e ajustar permissões' },
    pode(eu.permissoes, 'mural', 'editar') && recursoAtivo('mural') && { rota: '/mural', texto: 'Mural de avisos', dica: 'Publicar comunicados para a equipe' },
    { rota: '/avisos', texto: 'Avisos', dica: 'Ler os comunicados' },
    { rota: '/perfil', texto: 'Meu perfil', dica: 'Trocar senha e dados para pagamento' },
  ].filter((a): a is { rota: string; texto: string; dica: string } => !!a);

  return (
    <Pagina titulo={`Olá, ${eu.nome.split(' ')[0]}!`} subtitulo={`Hoje é ${dataLonga(hoje())}.`}>
      <div className="grade-cartoes">
        {atalhos.map((a) => (
          <Link key={a.rota} to={a.rota} style={{ textDecoration: 'none' }}>
            <Cartao>
              <strong>{a.texto}</strong>
              <p className="pequeno texto-2">{a.dica}</p>
            </Cartao>
          </Link>
        ))}
      </div>
      <p className="pequeno texto-3">Agenda, escalas e os demais módulos entram nas próximas etapas.</p>
      {(avisos.data ?? []).filter((a) => a.fixado).map((a) => (
        <CartaoAviso key={a.id} aviso={a} compacto />
      ))}
    </Pagina>
  );
}
