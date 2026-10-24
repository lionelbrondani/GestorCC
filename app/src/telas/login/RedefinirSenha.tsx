import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/cliente';
import { Alerta, Botao, Campo } from '../../componentes';
import './login.css';

export function RedefinirSenha() {
  const api = useApi();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<{ texto: string; linkInvalido?: boolean } | null>(null);
  const [feito, setFeito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (nova.length < 8) return setErro({ texto: 'A nova senha deve ter pelo menos 8 caracteres.' });
    if (nova !== confirma) return setErro({ texto: 'A confirmação não confere com a nova senha.' });
    setEnviando(true);
    try {
      await api.chamar('auth.redefinirSenha', { token, nova });
      setFeito(true);
    } catch (err) {
      const e2 = err as Error & { codigo?: string };
      setErro({ texto: e2.message, linkInvalido: e2.codigo === 'LINK_INVALIDO' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <div className="login-faixa">
        <img src="/logo-cc.png" alt="Centro de Convenções PRE | UFSM" className="login-logo" />
        <div className="login-marca">
          <span>GestorCC</span>
          <small>Centro de Convenções · PRE | UFSM</small>
        </div>
      </div>
      <div className="login-palco">
        <form className="login-cartao" onSubmit={enviar}>
          <div>
            <h1>Nova senha</h1>
            <p className="texto-2">Escolha uma senha com pelo menos 8 caracteres.</p>
          </div>
          {feito ? (
            <>
              <Alerta tom="sucesso">Senha alterada. Entre com a nova senha.</Alerta>
              <Link to="/entrar" className="cc-botao" data-variante="primario">
                Entrar
              </Link>
            </>
          ) : (
            <>
              <Campo rotulo="Nova senha">
                {(id) => <input id={id} className="cc-entrada" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} />}
              </Campo>
              <Campo rotulo="Confirme a nova senha">
                {(id) => <input id={id} className="cc-entrada" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} />}
              </Campo>
              {erro && (
                <Alerta tom="erro">
                  <div className="pilha-2">
                    <span>{erro.texto}</span>
                    {erro.linkInvalido && (
                      <Link to="/entrar" className="cc-botao" data-variante="secundario" data-tamanho="pequeno" style={{ alignSelf: 'flex-start' }}>
                        Pedir novo link
                      </Link>
                    )}
                  </div>
                </Alerta>
              )}
              <Botao type="submit" variante="primario" carregando={enviando}>
                Salvar nova senha
              </Botao>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
