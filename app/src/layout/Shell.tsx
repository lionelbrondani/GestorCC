import type { Pessoa } from '@shared';
import { CalendarCheck, ClipboardList, Home, Menu, Wallet, Bell } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { recursoAtivo } from '../recursos';
import './sobre.css';
import { CREDITO, ITEM_INICIO, itensVisiveis, type ItemMenu } from './menu';
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

export function MenuLateral({ pessoa, aoAbrirSobre }: { pessoa: Pessoa; aoAbrirSobre?: () => void }) {
  const { gestao, pessoais } = itensVisiveis(pessoa);
  return (
    <aside className="cc-menu-lateral">
      <Link to="/" className="cc-marca" aria-label="GestorCC — Início">
        <img src="/logo-cc-branco.png" alt="Centro de Convenções PRE | UFSM" />
      </Link>
      <ListaMenu itens={[ITEM_INICIO]} />
      <ListaMenu titulo="Gestão" itens={gestao} />
      <ListaMenu titulo="Pessoal" itens={pessoais} />
      <p className="cc-credito">
        {CREDITO}
        {aoAbrirSobre && (
          <>
            {' · '}
            <button type="button" onClick={aoAbrirSobre}>
              Sobre
            </button>
          </>
        )}
      </p>
    </aside>
  );
}

export function BarraSuperior({
  pessoa,
  aoSair,
  busca,
  notificacoes,
  aoAbrirSobre,
}: {
  pessoa: Pessoa;
  aoSair: () => void;
  busca?: ReactNode;
  notificacoes?: ReactNode;
  aoAbrirSobre?: () => void;
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
        <img src="/logo-cc-escuro.png" alt="Centro de Convenções PRE | UFSM" style={{ height: 28, width: 'auto' }} />
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
            {aoAbrirSobre && (
              <button
                role="menuitem"
                onClick={() => {
                  setAberto(false);
                  aoAbrirSobre();
                }}
              >
                Sobre o GestorCC
              </button>
            )}
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
  const escalas = recursoAtivo('escalasPessoais');
  return (
    <>
      <nav className="cc-barra-inferior" aria-label="Navegação principal">
        <NavLink to="/" end>
          <Home size={20} aria-hidden />
          Início
        </NavLink>
        {escalas && (
          <NavLink to="/minhas-escalas">
            <CalendarCheck size={20} aria-hidden />
            Escalas
          </NavLink>
        )}
        {escalas && (
          <NavLink to="/disponibilidade">
            <ClipboardList size={20} aria-hidden />
            Disponib.
          </NavLink>
        )}
        {bolsista && recursoAtivo('pagamentos') ? (
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
  aoAbrirSobre,
  children,
}: {
  pessoa: Pessoa;
  aoSair: () => void;
  busca?: ReactNode;
  notificacoes?: ReactNode;
  faixa?: ReactNode;
  aoAbrirSobre?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="cc-shell">
      <MenuLateral pessoa={pessoa} aoAbrirSobre={aoAbrirSobre} />
      <BarraSuperior pessoa={pessoa} aoSair={aoSair} busca={busca} notificacoes={notificacoes} aoAbrirSobre={aoAbrirSobre} />
      <main className="cc-conteudo">
        {faixa}
        {children}
      </main>
      <BarraInferior pessoa={pessoa} />
    </div>
  );
}
