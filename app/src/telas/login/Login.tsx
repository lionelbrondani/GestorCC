import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useSessao } from '../../auth/SessaoContexto';
import { MODO_PROTOTIPO } from '../../ambiente';
import { Alerta, Botao, Campo, Modal } from '../../componentes';
import { CREDITO } from '../../layout/menu';
import './login.css';

function Padrao() {
  // Composição de losangos inspirada nas peças gráficas do CC.
  return (
    <svg className="login-padrao" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect x="250" y="-40" width="180" height="180" transform="rotate(45 340 50)" fill="#2e2e2e" />
      <rect x="300" y="120" width="90" height="90" transform="rotate(45 345 165)" fill="#F5C518" />
      <rect x="-60" y="380" width="220" height="220" transform="rotate(45 50 490)" fill="#2e2e2e" />
      <rect x="120" y="470" width="80" height="80" transform="rotate(45 160 510)" fill="#F5C518" />
      <rect x="40" y="90" width="50" height="50" transform="rotate(45 65 115)" fill="#3a3a3a" />
    </svg>
  );
}

export function Login() {
  const { sessao, entrar } = useSessao();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [esqueci, setEsqueci] = useState(false);

  const voltar = params.get('voltar') || '/';
  if (sessao) return <Navigate to={voltar} replace />;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
      navegar(voltar, { replace: true });
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <div className="login-faixa">
        <img src="/logo-cc-escuro.png" alt="Centro de Convenções PRE | UFSM" className="login-logo" />
        <div className="login-marca">
          <span>GestorCC</span>
        </div>
      </div>
      <div className="login-palco">
        <Padrao />
        <form className="login-cartao" onSubmit={enviar}>
          <div>
            <h1>GestorCC</h1>
            <p className="texto-2">Entre com seu e-mail acadêmico.</p>
          </div>
          <Campo rotulo="E-mail acadêmico">
            {(id) => (
              <input id={id} className="cc-entrada" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            )}
          </Campo>
          <Campo rotulo="Senha" ajuda="No primeiro acesso, a senha é a sua matrícula.">
            {(id) => (
              <input id={id} className="cc-entrada" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            )}
          </Campo>
          {erro && <Alerta tom="erro">{erro}</Alerta>}
          <Botao type="submit" variante="primario" carregando={enviando}>
            Entrar
          </Botao>
          <button type="button" className="login-esqueci" onClick={() => setEsqueci(true)}>
            Esqueci minha senha
          </button>
          {MODO_PROTOTIPO && (
            <p className="pequeno texto-3">
              Protótipo com dados fictícios. Contas de exemplo: gestor@ufsm.br / 1000000001 · bolsista@acad.ufsm.br / 2026000001
            </p>
          )}
        </form>
        <p className="login-credito">{CREDITO}</p>
      </div>
      <Modal
        aberto={esqueci}
        titulo="Esqueci minha senha"
        aoFechar={() => setEsqueci(false)}
        rodape={<Botao onClick={() => setEsqueci(false)}>Fechar</Botao>}
      >
        <p>
          Peça a um gestor para redefinir sua senha. Ela volta a ser a sua matrícula, e você cria uma nova ao entrar.
        </p>
      </Modal>
    </div>
  );
}
