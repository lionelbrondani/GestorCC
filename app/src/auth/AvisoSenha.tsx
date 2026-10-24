import { pode } from '@shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutacao } from '../api/hooks';
import { Alerta, Botao, Campo, Modal } from '../componentes';
import { useSessao } from './SessaoContexto';

export function FormTrocarSenha({ aoConcluir }: { aoConcluir: () => void }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const trocar = useMutacao('auth.trocarSenha', []);
  const { atualizarToken } = useSessao();

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (nova.length < 8) return setErro('A nova senha deve ter pelo menos 8 caracteres.');
    if (nova !== confirma) return setErro('A confirmação não confere com a nova senha.');
    try {
      const r = await trocar.mutateAsync({ atual, nova });
      atualizarToken(r.token);
      aoConcluir();
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  return (
    <form className="pilha" onSubmit={enviar}>
      <Campo rotulo="Senha atual" ajuda="No primeiro acesso, é a sua matrícula.">
        {(id) => <input id={id} className="cc-entrada" type="password" value={atual} onChange={(e) => setAtual(e.target.value)} autoComplete="current-password" />}
      </Campo>
      <Campo rotulo="Nova senha" ajuda="Pelo menos 8 caracteres.">
        {(id) => <input id={id} className="cc-entrada" type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoComplete="new-password" />}
      </Campo>
      <Campo rotulo="Confirme a nova senha">
        {(id) => <input id={id} className="cc-entrada" type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" />}
      </Campo>
      {erro && <Alerta tom="erro">{erro}</Alerta>}
      <div>
        <Botao type="submit" variante="primario" carregando={trocar.isPending}>
          Salvar nova senha
        </Botao>
      </div>
    </form>
  );
}

export function AvisoSenha() {
  const { sessao, marcarSenhaTrocada } = useSessao();
  const [dispensado, setDispensado] = useState(false);
  if (!sessao?.senhaInicial) return null;

  const obrigatorio = pode(sessao.pessoa.permissoes, 'dadosPessoais', 'editar');
  if (obrigatorio) {
    return (
      <Modal aberto titulo="Troque sua senha para continuar" aoFechar={() => undefined}>
        <div className="pilha">
          <p className="texto-2">
            Seu acesso inclui CPF e dados bancários da equipe. Por segurança, defina uma senha própria antes de continuar.
          </p>
          <FormTrocarSenha aoConcluir={marcarSenhaTrocada} />
        </div>
      </Modal>
    );
  }

  if (dispensado) return null;
  return (
    <div className="cc-faixa-aviso" style={{ marginBottom: 16 }}>
      <Alerta tom="destaque">
        <div className="linha-entre">
          <span>Você ainda usa a senha inicial. Recomendamos trocá-la.</span>
          <span className="linha">
            <Link to="/perfil" className="cc-botao" data-variante="primario" data-tamanho="pequeno">
              Trocar agora
            </Link>
            <Botao variante="fantasma" tamanho="pequeno" onClick={() => setDispensado(true)}>
              Agora não
            </Botao>
          </span>
        </div>
      </Alerta>
    </div>
  );
}
