import { pode } from '@shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePessoas } from '../../api/consultas';
import { useEu } from '../../auth/SessaoContexto';
import { Botao, Campo, Carregando, Etiqueta, Pagina, Tabela } from '../../componentes';
import { modeloDe } from './PermissoesEditor';

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const NOME_MODELO = { gestor: 'Gestor', operacao: 'Operação', eventual: 'Eventual', personalizado: 'Personalizado' } as const;

export function Pessoas() {
  const eu = useEu();
  const navegar = useNavigate();
  const pessoas = usePessoas();
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [vinculo, setVinculo] = useState('');
  const [ativo, setAtivo] = useState('sim');
  if (pessoas.isLoading) return <Carregando />;

  const lista = pessoas.lista
    .filter((p) => (!tipo || p.tipo === tipo) && (!vinculo || p.vinculo === vinculo) && (ativo === '' || p.ativo === (ativo === 'sim')))
    .filter((p) => !busca || sem(`${p.nome} ${p.emailAcademico} ${p.matricula}`).includes(sem(busca)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <Pagina
      titulo="Pessoas e acessos"
      subtitulo="Cadastro da equipe, perfis de acesso e dados para pagamento."
      acoes={
        pode(eu.permissoes, 'pessoas', 'editar') && (
          <Botao variante="primario" onClick={() => navegar('/pessoas/nova')}>
            <Plus size={16} aria-hidden /> Nova pessoa
          </Botao>
        )
      }
    >
      <div className="linha" style={{ alignItems: 'flex-end' }}>
        <Campo rotulo="Buscar">{(id) => <input id={id} className="cc-entrada" value={busca} placeholder="Nome, e-mail ou matrícula" onChange={(e) => setBusca(e.target.value)} />}</Campo>
        <Campo rotulo="Tipo">
          {(id) => (
            <select id={id} className="cc-entrada" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              <option value="servidor">Servidor</option>
              <option value="bolsista">Bolsista</option>
            </select>
          )}
        </Campo>
        <Campo rotulo="Vínculo">
          {(id) => (
            <select id={id} className="cc-entrada" value={vinculo} onChange={(e) => setVinculo(e.target.value)}>
              <option value="">Todos</option>
              <option value="fixo">Fixo</option>
              <option value="eventual">Eventual</option>
            </select>
          )}
        </Campo>
        <Campo rotulo="Situação">
          {(id) => (
            <select id={id} className="cc-entrada" value={ativo} onChange={(e) => setAtivo(e.target.value)}>
              <option value="sim">Ativos</option>
              <option value="nao">Inativos</option>
              <option value="">Todos</option>
            </select>
          )}
        </Campo>
      </div>
      <Tabela
        colunas={[
          {
            chave: 'nome',
            titulo: 'Nome',
            render: (p) => (
              <span className="pilha-2" style={{ gap: 0 }}>
                <strong>{p.nome}</strong>
                <span className="pequeno texto-3">{p.emailAcademico}</span>
              </span>
            ),
          },
          { chave: 'tipo', titulo: 'Tipo', render: (p) => `${p.tipo === 'servidor' ? 'Servidor' : 'Bolsista'} ${p.vinculo === 'fixo' ? 'fixo' : 'eventual'}` },
          { chave: 'perfil', titulo: 'Acesso', render: (p) => <Etiqueta tom="info">{NOME_MODELO[modeloDe(p.permissoes)]}</Etiqueta> },
          {
            chave: 'marcas',
            titulo: '',
            render: (p) => (
              <span className="linha">
                {p.experiente && <Etiqueta>experiente</Etiqueta>}
                {p.escalarMenos && <Etiqueta tom="aviso">escalar menos</Etiqueta>}
                {!p.ativo && <Etiqueta tom="neutro">inativo</Etiqueta>}
              </span>
            ),
          },
        ]}
        linhas={lista}
        chaveLinha={(p) => p.id}
        aoClicar={(p) => navegar(`/pessoas/${p.id}`)}
      />
    </Pagina>
  );
}
