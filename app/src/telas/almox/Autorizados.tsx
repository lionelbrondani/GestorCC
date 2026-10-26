import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useConsulta, useMutacao } from '../../api/hooks';
import { Alerta, Botao, Carregando, Cartao, Etiqueta, Tabela } from '../../componentes';

const INVALIDAR = ['almox.autorizados', 'almox.listar'] as const;

/** Pessoas de fora da equipe que podem retirar material: incluir, renomear e desativar. */
export function Autorizados() {
  const lista = useConsulta('almox.autorizados', null);
  const salvar = useMutacao('almox.salvarAutorizado', [...INVALIDAR]);
  const [novo, setNovo] = useState('');
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [msg, setMsg] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);

  async function executar(dados: { id: string; nome: string; ativo: boolean }, ok: string) {
    setMsg(null);
    try {
      await salvar.mutateAsync(dados);
      setMsg({ tom: 'sucesso', texto: ok });
      return true;
    } catch (e) {
      setMsg({ tom: 'erro', texto: (e as Error).message });
      return false;
    }
  }

  if (lista.isLoading) return <Carregando />;
  const todos = lista.data ?? [];

  return (
    <Cartao titulo="Autorizados a retirar" acoes={<span className="pequeno texto-2">A equipe do sistema já pode retirar; aqui ficam as pessoas de fora.</span>}>
      <form
        className="linha"
        style={{ alignItems: 'flex-end' }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await executar({ id: '', nome: novo, ativo: true }, `${novo.trim()} pode retirar material.`)) setNovo('');
        }}
      >
        <input className="cc-entrada" aria-label="Nome de quem pode retirar" placeholder="Nome (ex.: técnico da produtora)" value={novo} onChange={(e) => setNovo(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <Botao type="submit" variante="primario" carregando={salvar.isPending && !editando}>
          <Plus size={16} aria-hidden /> Adicionar
        </Botao>
      </form>
      {msg && <Alerta tom={msg.tom}>{msg.texto}</Alerta>}
      <Tabela
        colunas={[
          {
            chave: 'nome',
            titulo: 'Nome',
            render: (a) =>
              editando?.id === a.id ? (
                <input
                  className="cc-entrada"
                  aria-label={`Novo nome de ${a.nome}`}
                  autoFocus
                  value={editando.nome}
                  onChange={(e) => setEditando({ id: a.id, nome: e.target.value })}
                  onKeyDown={async (e) => {
                    if (e.key === 'Escape') setEditando(null);
                    if (e.key === 'Enter' && (await executar({ id: a.id, nome: editando.nome, ativo: a.ativo }, 'Nome alterado.'))) setEditando(null);
                  }}
                />
              ) : (
                <span className="negrito">{a.nome}</span>
              ),
          },
          { chave: 'ativo', titulo: 'Situação', render: (a) => (a.ativo ? <Etiqueta tom="sucesso">Pode retirar</Etiqueta> : <Etiqueta>Desativado</Etiqueta>) },
          {
            chave: 'acoes',
            titulo: '',
            render: (a) => (
              <span className="linha" style={{ flexWrap: 'nowrap' }}>
                {editando?.id === a.id ? (
                  <Botao tamanho="pequeno" onClick={async () => (await executar({ id: a.id, nome: editando.nome, ativo: a.ativo }, 'Nome alterado.')) && setEditando(null)}>
                    Salvar
                  </Botao>
                ) : (
                  <Botao tamanho="pequeno" variante="fantasma" onClick={() => setEditando({ id: a.id, nome: a.nome })}>
                    Renomear
                  </Botao>
                )}
                <Botao tamanho="pequeno" variante="fantasma" onClick={() => executar({ id: a.id, nome: a.nome, ativo: !a.ativo }, a.ativo ? `${a.nome} desativado.` : `${a.nome} pode retirar de novo.`)}>
                  {a.ativo ? 'Desativar' : 'Reativar'}
                </Botao>
              </span>
            ),
          },
        ]}
        linhas={todos}
        chaveLinha={(a) => a.id}
        vazio="Ninguém de fora cadastrado. Adicione acima ou digite o nome direto na Saída."
      />
    </Cartao>
  );
}
