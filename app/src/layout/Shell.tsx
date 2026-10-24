import type { Pessoa } from '@shared';
import { CalendarCheck, ClipboardList, Home, Menu, Wallet, Bell } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ITEM_INICIO, itensVisiveis, type ItemMenu } from './menu';
import './layout.css';

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

function ListaMenu({ titulo, itens, aoNavegar }: { titulo?: string; itens: ItemMenu[]; aoNavegar?: () => void }) {
  if (!itens.length) return null;
  return (
    <nav className="cc-menu-grupo" aria-label={titulo}>
      {titulo && <div className="cc-menu-grupo-titulo">{titulo}</div>}
      {itens.map((i) => (
        <NavLink key={i.rota} to={i.rota} end={i.rota === '/'} className="cc-menu-item" onClick={aoNavegar}>
          <i.icone size={18} aria-hidden />
          {i.rotulo}
        </NavLink>
      ))}
    </nav>
  );
}

export function MenuLateral({ pessoa }: { pessoa: Pessoa }) {
  const { gestao, pessoais } = itensVisiveis(pessoa);
  return (
    <aside className="cc-menu-lateral">
      <Link to="/" className="cc-marca" aria-label="GestorCC — Início">
        <img src="/logo-cc.png" alt="Centro de Convenções PRE | UFSM" />
      </Link>
      <ListaMenu itens={[ITEM_INICIO]} />
      <ListaMenu titulo="Gestão" itens={gestao} />
      <ListaMenu titulo="Pessoal" itens={pessoais} />
    </aside>
  );
}

export function BarraSuperior({
  pessoa,
  aoSair,
  busca,
  notificacoes,
}: {
  pessoa: Pessoa;
  aoSair: () => void;
  busca?: ReactNode;
  notificacoes?: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  return (
    <header className="cc-barra-superior">
      <Link to="/" className="so-celular" aria-label="Início">
        <img src="/logo-cc.png" alt="" style={{ height: 30, filter: 'invert(1)' }} />
      </Link>
      <div className="cc-espaco">{busca}</div>
      {notificacoes}
      <div className="cc-usuario" ref={ref}>
        <button className="cc-usuario-botao" onClick={() => setAberto((v) => !v)} aria-haspopup="menu" aria-expanded={aberto}>
          <span className="cc-avatar" aria-hidden>
            {iniciais(pessoa.nome)}
          </span>
          <span className="so-desktop negrito">{pessoa.nome.split(' ')[0]}</span>
        </button>
        {aberto && (
          <div className="cc-menu-suspenso" role="menu">
            <div className="pequeno texto-2" style={{ padding: '6px 12px' }}>
              {pessoa.nome}
            </div>
            <Link to="/perfil" role="menuitem" onClick={() => setAberto(false)}>
              Perfil
            </Link>
            <button role="menuitem" onClick={aoSair}>
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export function BarraInferior({ pessoa }: { pessoa: Pessoa }) {
  const [gaveta, setGaveta] = useState(false);
  const local = useLocation();
  useEffect(() => setGaveta(false), [local.pathname]);
  const { gestao, pessoais } = itensVisiveis(pessoa);
  const bolsista = pessoa.tipo === 'bolsista';
  return (
    <>
      <nav className="cc-barra-inferior" aria-label="Navegação principal">
        <NavLink to="/" end>
          <Home size={20} aria-hidden />
          Início
        </NavLink>
        <NavLink to="/minhas-escalas">
          <CalendarCheck size={20} aria-hidden />
          Escalas
        </NavLink>
        <NavLink to="/disponibilidade">
          <ClipboardList size={20} aria-hidden />
          Disponib.
        </NavLink>
        {bolsista ? (
          <NavLink to="/ganhos">
            <Wallet size={20} aria-hidden />
            Ganhos
          </NavLink>
        ) : (
          <NavLink to="/avisos">
            <Bell size={20} aria-hidden />
            Avisos
          </NavLink>
        )}
        <button onClick={() => setGaveta(true)} aria-expanded={gaveta}>
          <Menu size={20} aria-hidden />
          Menu
        </button>
      </nav>
      {gaveta && (
        <>
          <div className="cc-gaveta-fundo" onClick={() => setGaveta(false)} />
          <div className="cc-gaveta" role="dialog" aria-label="Menu">
            <ListaMenu titulo="Gestão" itens={gestao} />
            <ListaMenu titulo="Pessoal" itens={pessoais} />
          </div>
        </>
      )}
    </>
  );
}

export function Shell({
  pessoa,
  aoSair,
  busca,
  notificacoes,
  faixa,
  children,
}: {
  pessoa: Pessoa;
  aoSair: () => void;
  busca?: ReactNode;
  notificacoes?: ReactNode;
  faixa?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="cc-shell">
      <MenuLateral pessoa={pessoa} />
      <BarraSuperior pessoa={pessoa} aoSair={aoSair} busca={busca} notificacoes={notificacoes} />
      <main className="cc-conteudo">
        {faixa}
        {children}
      </main>
      <BarraInferior pessoa={pessoa} />
    </div>
  );
}
