import { Bug, Heart, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { Botao, Losango, Modal } from '../componentes';
import './sobre.css';

export const EMAIL_DESENVOLVEDOR = 'lionel.brondani@acad.ufsm.br';
export const REPOSITORIO = 'https://github.com/lionelbrondani/GestorCC';
const CHAVE_VISTO = 'gestorcc-sobre-visto-v1';

/** Texto do "Sobre": quem fez, por quê, código aberto e para onde mandar sugestões e erros. */
export function ConteudoSobre() {
  return (
    <div className="sobre">
      <div className="sobre-marca">
        <img src="/logo-cc-escuro.png" alt="Centro de Convenções PRE | UFSM" />
        <Losango tamanho={28} />
      </div>
      <p>
        O <strong>GestorCC</strong> foi desenvolvido por <strong>Lionel Brondani</strong>, bolsista do Centro de Convenções da UFSM, de forma{' '}
        <strong>gratuita</strong> e <strong>sem visar benefícios próprios</strong>.
      </p>
      <p>
        O objetivo é <strong>diminuir a sobrecarga de trabalho do setor</strong>: agenda, escalas, pagamentos, contratos, fichas técnicas, almoxarifado e
        prédio num lugar só. O <strong>código é aberto</strong>:{' '}
        <a href={REPOSITORIO} target="_blank" rel="noreferrer">
          github.com/lionelbrondani/GestorCC
        </a>
        .
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
        Feito com <Heart size={14} aria-hidden fill="currentColor" /> para o Centro de Convenções · PRE | UFSM
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
