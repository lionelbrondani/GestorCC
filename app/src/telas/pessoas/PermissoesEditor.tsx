import { MODELOS, MODULOS, type ModeloPermissao, type Nivel, type Permissoes } from '@shared';

const NIVEIS: { id: Nivel; rotulo: string }[] = [
  { id: 'nenhum', rotulo: 'Nenhum' },
  { id: 'ver', rotulo: 'Ver' },
  { id: 'editar', rotulo: 'Editar' },
];

const NOMES_MODELO: Record<ModeloPermissao, string> = { gestor: 'Gestor', operacao: 'Operação', eventual: 'Eventual' };

export function modeloDe(p: Permissoes): ModeloPermissao | 'personalizado' {
  const achado = (Object.keys(MODELOS) as ModeloPermissao[]).find((m) => MODULOS.every((x) => MODELOS[m][x.id] === p[x.id]));
  return achado ?? 'personalizado';
}

export function PermissoesEditor({
  valor,
  aoMudar,
  desabilitado,
}: {
  valor: Permissoes;
  aoMudar: (p: Permissoes) => void;
  desabilitado?: boolean;
}) {
  const modelo = modeloDe(valor);
  return (
    <div className="pilha">
      <div className="cc-campo" style={{ maxWidth: 320 }}>
        <label htmlFor="modelo-permissao">Aplicar modelo</label>
        <select
          id="modelo-permissao"
          className="cc-entrada"
          disabled={desabilitado}
          value={modelo}
          onChange={(e) => e.target.value !== 'personalizado' && aoMudar({ ...MODELOS[e.target.value as ModeloPermissao] })}
        >
          {(Object.keys(MODELOS) as ModeloPermissao[]).map((m) => (
            <option key={m} value={m}>
              {NOMES_MODELO[m]}
            </option>
          ))}
          <option value="personalizado">Personalizado</option>
        </select>
      </div>
      <div className="cc-tabela-caixa">
        <table className="cc-tabela">
          <thead>
            <tr>
              <th>Módulo</th>
              {NIVEIS.map((n) => (
                <th key={n.id} style={{ textAlign: 'center' }}>
                  {n.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULOS.map((m) => (
              <tr key={m.id}>
                <td>{m.nome}</td>
                {NIVEIS.map((n) => (
                  <td key={n.id} style={{ textAlign: 'center' }}>
                    <input
                      type="radio"
                      name={`perm-${m.id}`}
                      aria-label={`${m.nome}: ${n.rotulo}`}
                      disabled={desabilitado}
                      checked={valor[m.id] === n.id}
                      onChange={() => aoMudar({ ...valor, [m.id]: n.id })}
                      style={{ width: 18, height: 18, accentColor: 'var(--cor-texto)' }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pequeno texto-3">Toda pessoa ativa sempre acessa Início, Minhas escalas, Disponibilidade, Ganhos (bolsistas), Avisos e Perfil.</p>
    </div>
  );
}
