import { Bug, Heart, Lightbulb } from 'lucide-react';
import { O_SETOR, SETOR } from '@shared';
import { useState } from 'react';
import { Botao, Losango, Modal } from '../componentes';
import './sobre.css';

/** Para onde vão as sugestões e os erros: quem desenvolveu, ou o próprio setor. */
export const EMAIL_DESENVOLVEDOR = SETOR.credito.email || SETOR.email;
export const REPOSITORIO = SETOR.credito.repositorio;
const CHAVE_VISTO = 'gestorcc-sobre-visto-v1';

/** Texto do "Sobre": quem fez, por quê, código aberto e para onde mandar sugestões e erros. */
export function ConteudoSobre() {
  return (
    <div className="sobre">
      <div className="sobre-marca">
        <img src="/logo-escuro.png" alt={SETOR.logoAlt} />
        <Losango tamanho={28} />
      </div>
      <p>
        O <strong>GestorCC</strong> {SETOR.credito.sobre}
      </p>
      <p>
        O objetivo é <strong>diminuir a sobrecarga de trabalho do setor</strong>: agenda, escalas, pagamentos, contratos, fichas técnicas, almoxarifado e
        prédio num lugar só. O <strong>código é aberto</strong>
        {REPOSITORIO ? (
          <>
            :{' '}
            <a href={REPOSITORIO} target="_blank" rel="noreferrer">
              {REPOSITORIO.replace(/^https?:\/\//, '')}
            </a>
            .
          </>
        ) : (
          '.'
        )}
      </p>
      <ul className="sobre-cartoes">
        <li>
          <Lightbulb size={22} aria-hidden />
          <span>
            <strong>Sugestões</strong>
            <small>Ideias para melhorar o sistema são bem-vindas.</small>
          </span>
        </li>
        <li>
          <Bug size={22} aria-hidden />
          <span>
            <strong>Erros e bugs</strong>
            <small>Conte o que aconteceu e, se puder, mande um print.</small>
          </span>
        </li>
      </ul>
      <p className="sobre-email">
        Envie para{' '}
        <a href={`mailto:${EMAIL_DESENVOLVEDOR}?subject=${encodeURIComponent('GestorCC: sugestão ou erro')}`}>{EMAIL_DESENVOLVEDOR}</a>
      </p>
      <p className="sobre-rodape">
        Feito com <Heart size={14} aria-hidden fill="currentColor" /> para {O_SETOR}
      </p>
    </div>
  );
}

export function ModalSobre({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  return (
    <Modal aberto={aberto} titulo="Sobre o GestorCC" aoFechar={aoFechar} rodape={<Botao variante="primario" onClick={aoFechar}>Entendi</Botao>}>
      <ConteudoSobre />
    </Modal>
  );
}

/** Abre o "Sobre" sozinho no primeiro acesso de cada navegador. */
export function useSobrePrimeiroAcesso(): [boolean, () => void, () => void] {
  const [aberto, setAberto] = useState(() => {
    try {
      return !localStorage.getItem(CHAVE_VISTO);
    } catch {
      return false;
    }
  });
  const fechar = () => {
    setAberto(false);
    try {
      localStorage.setItem(CHAVE_VISTO, '1');
    } catch {
      // armazenamento indisponível: só não lembra que já viu
    }
  };
  return [aberto, () => setAberto(true), fechar];
}
