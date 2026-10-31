import { formatarDataHora } from '@shared';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsulta, useMutacao } from '../api/hooks';
import { Botao } from '../componentes';

export function Notificacoes() {
  const q = useConsulta('notificacoes.listar', null);
  const marcar = useMutacao('notificacoes.marcarLidas', ['notificacoes.listar']);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  const lista = q.data ?? [];
  const naoLidas = lista.filter((n) => !n.lida).length;

  return (
    <div className="cc-usuario" ref={ref}>
      <button className="cc-usuario-botao" onClick={() => setAberto((v) => !v)} aria-label={`Notificações (${naoLidas} não lidas)`} aria-expanded={aberto}>
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <Bell size={22} aria-hidden />
          {naoLidas > 0 && (
            <span
              style={{
                position: 'absolute', top: -6, right: -8, minWidth: 18, height: 18, borderRadius: 999, background: 'var(--cor-destaque)',
                color: 'var(--cor-texto)', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 4px',
              }}
            >
              {naoLidas}
            </span>
          )}
        </span>
      </button>
      {aberto && (
        <div className="cc-menu-suspenso" style={{ width: 'min(340px, 90vw)', maxHeight: 420, overflowY: 'auto' }}>
          <div className="linha-entre" style={{ padding: '4px 8px' }}>
            <strong>Notificações</strong>
            {naoLidas > 0 && (
              <Botao tamanho="pequeno" variante="fantasma" onClick={() => marcar.mutate(null)}>
                Marcar todas como lidas
              </Botao>
            )}
          </div>
          {lista.length === 0 && <p className="pequeno texto-3" style={{ padding: 8 }}>Nada por aqui.</p>}
          {lista.map((n) => (
            <Link key={n.id} to={n.link} onClick={() => setAberto(false)} style={{ fontWeight: n.lida ? 400 : 700 }}>
              <div>{n.texto}</div>
              <div className="pequeno texto-3">{formatarDataHora(n.criadaEm)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
