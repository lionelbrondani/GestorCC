import { cpfValido, MODELOS, normalizarCpf, normalizarMatricula, pode, type DadosPessoais, type Pessoa } from '@shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePessoas } from '../../api/consultas';
import { useConsulta, useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Alerta, Botao, Campo, Carregando, Cartao, EstadoVazio, Modal, Pagina } from '../../componentes';
import { copiarTexto } from '../escalas/dadosEscalas';
import { PermissoesEditor } from './PermissoesEditor';

const mensagemNovaSenha = (nome: string) =>
  `Olá, ${nome.trim().split(' ')[0]}! Sua senha do GestorCC voltou a ser a sua matrícula. ` +
  `Entre em ${window.location.origin} com o seu e-mail acadêmico e a matrícula, e crie uma senha nova.`;

function pessoaVazia(): Pessoa {
  return {
    id: '', nome: '', nomeCurto: '', emailAcademico: '', matricula: '', tipo: 'bolsista', vinculo: 'eventual',
    experiente: false, escalarMenos: false, ativo: true, permissoes: { ...MODELOS.eventual },
  };
}

function DadosPessoaisCartao({ pessoaId, editar }: { pessoaId: string; editar: boolean }) {
  const q = useConsulta('dadosPessoais.obter', { pessoaId });
  const salvar = useMutacao('dadosPessoais.salvar', ['dadosPessoais.obter']);
  const [d, setD] = useState<DadosPessoais>({ pessoaId, cpf: '', banco: '', agencia: '', conta: '' });
  const [msg, setMsg] = useState<{ tom: 'erro' | 'sucesso'; texto: string } | null>(null);
  useEffect(() => {
    if (q.data) setD(q.data);
  }, [q.data]);
  if (q.isLoading) return <Carregando />;
  const campo = (k: keyof DadosPessoais, rotulo: string, tipo = 'text') => (
    <Campo rotulo={rotulo}>
      {(id) => <input id={id} className="cc-entrada" type={tipo} disabled={!editar} value={(d[k] as string) ?? ''} onChange={(e) => setD({ ...d, [k]: e.target.value })} />}
    </Campo>
  );
  return (
    <Cartao titulo="Dados pessoais e bancários (sigilosos)">
      <div className="pilha">
        <div className="grade-2">
          {campo('cpf', 'CPF')}
          {campo('banco', 'Banco')}
          {campo('agencia', 'Agência')}
          {campo('conta', 'Conta')}
          {campo('nascimento', 'Nascimento', 'date')}
          {campo('camiseta', 'Camiseta')}
        </div>
        {msg && <Alerta tom={msg.tom}>{msg.texto}</Alerta>}
        {editar && (
          <div>
            <Botao
              carregando={salvar.isPending}
              onClick={async () => {
                setMsg(null);
                if (d.cpf && !cpfValido(d.cpf)) return setMsg({ tom: 'erro', texto: 'CPF inválido.' });
                await salvar.mutateAsync({ ...d, cpf: d.cpf ? normalizarCpf(d.cpf)! : '' });
                setMsg({ tom: 'sucesso', texto: 'Dados salvos.' });
              }}
            >
              Salvar dados pessoais
            </Botao>
          </div>
        )}
      </div>
    </Cartao>
  );
}

export function PessoaForm() {
  const { id = '' } = useParams();
  const nova = id === 'nova';
  const eu = useEu();
  const navegar = useNavigate();
  const pessoas = usePessoas();
  const salvar = useMutacao('pessoas.salvar', ['pessoas.listar', 'historico.listar']);
  const redefinir = useMutacao('pessoas.redefinirSenha', ['historico.listar']);
  const [p, setP] = useState<Pessoa | null>(null);
  const [msg, setMsg] = useState<{ tom: 'erro' | 'sucesso'; texto: string } | null>(null);
  const [confirmarSenha, setConfirmarSenha] = useState(false);
  const [mensagemSenha, setMensagemSenha] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!pessoas.isLoading && !p) setP(nova ? pessoaVazia() : pessoas.pessoa.get(id) ?? null);
  }, [pessoas.isLoading, pessoas.pessoa, id, nova, p]);

  if (pessoas.isLoading) return <Carregando />;
  if (!p) return <EstadoVazio titulo="Pessoa não encontrada" acao={<Link to="/pessoas">Voltar</Link>} />;
  const editar = pode(eu.permissoes, 'pessoas', 'editar');
  const set = (parcial: Partial<Pessoa>) => setP({ ...p, ...parcial });
  const texto = (k: keyof Pessoa, rotulo: string, ajuda?: string) => (
    <Campo rotulo={rotulo} ajuda={ajuda}>
      {(i) => <input id={i} className="cc-entrada" disabled={!editar} value={(p[k] as string) ?? ''} onChange={(e) => set({ [k]: e.target.value } as Partial<Pessoa>)} />}
    </Campo>
  );

  async function gravar() {
    setMsg(null);
    if (!p!.nome.trim()) return setMsg({ tom: 'erro', texto: 'Informe o nome.' });
    const matricula = normalizarMatricula(p!.matricula);
    if (!matricula) return setMsg({ tom: 'erro', texto: 'Matrícula inválida: use 9 ou 10 dígitos, sem pontos.' });
    try {
      const salvo = await salvar.mutateAsync({ ...p!, matricula, nomeCurto: p!.nomeCurto || p!.nome.split(' ')[0].toUpperCase() });
      setP(salvo);
      setMsg({ tom: 'sucesso', texto: nova ? 'Pessoa cadastrada. A senha inicial é a matrícula.' : 'Alterações salvas.' });
      if (nova) navegar(`/pessoas/${salvo.id}`, { replace: true });
    } catch (e) {
      setMsg({ tom: 'erro', texto: (e as Error).message });
    }
  }

  return (
    <Pagina
      titulo={nova ? 'Nova pessoa' : p.nome}
      acoes={
        editar && (
          <Botao variante="primario" carregando={salvar.isPending} onClick={gravar}>
            Salvar
          </Botao>
        )
      }
    >
      {msg && <Alerta tom={msg.tom}>{msg.texto}</Alerta>}
      <Cartao titulo="Cadastro">
        <div className="grade-2">
          {texto('nome', 'Nome completo')}
          {texto('nomeCurto', 'Nome na escala', 'Como aparece na escala e no WhatsApp (ex.: ISABELA A.)')}
          {texto('emailAcademico', 'E-mail acadêmico (login)')}
          {texto('emailAlternativo', 'E-mail alternativo')}
          {texto('matricula', 'Matrícula', 'Senha inicial')}
          {texto('siape', 'SIAPE (servidores)')}
          <Campo rotulo="Tipo">
            {(i) => (
              <select id={i} className="cc-entrada" disabled={!editar} value={p.tipo} onChange={(e) => set({ tipo: e.target.value as Pessoa['tipo'] })}>
                <option value="bolsista">Bolsista</option>
                <option value="servidor">Servidor</option>
              </select>
            )}
          </Campo>
          <Campo rotulo="Vínculo">
            {(i) => (
              <select id={i} className="cc-entrada" disabled={!editar} value={p.vinculo} onChange={(e) => set({ vinculo: e.target.value as Pessoa['vinculo'] })}>
                <option value="eventual">Eventual</option>
                <option value="fixo">Fixo</option>
              </select>
            )}
          </Campo>
        </div>
        <div className="linha" style={{ marginTop: 16 }}>
          <label className="cc-caixa">
            <input type="checkbox" disabled={!editar} checked={p.experiente} onChange={(e) => set({ experiente: e.target.checked })} /> Experiente
          </label>
          <label className="cc-caixa">
            <input type="checkbox" disabled={!editar} checked={p.escalarMenos} onChange={(e) => set({ escalarMenos: e.target.checked })} /> Escalar menos
          </label>
          <label className="cc-caixa">
            <input type="checkbox" disabled={!editar} checked={p.ativo} onChange={(e) => set({ ativo: e.target.checked })} /> Ativo (desmarque para bloquear o login)
          </label>
        </div>
      </Cartao>

      <Cartao titulo="Acesso ao sistema">
        <PermissoesEditor valor={p.permissoes} aoMudar={(permissoes) => set({ permissoes })} desabilitado={!editar} />
      </Cartao>

      {!nova && pode(eu.permissoes, 'dadosPessoais', 'ver') && <DadosPessoaisCartao pessoaId={p.id} editar={pode(eu.permissoes, 'dadosPessoais', 'editar')} />}

      {!nova && editar && (
        <Cartao titulo="Senha">
          <div className="linha-entre">
            <span className="texto-2">Volta a senha para a matrícula. A pessoa verá o aviso para trocar no próximo acesso.</span>
            <Botao variante="perigo" onClick={() => setConfirmarSenha(true)}>
              Redefinir senha para a matrícula
            </Botao>
          </div>
        </Cartao>
      )}

      <Modal
        aberto={confirmarSenha}
        titulo="Redefinir senha"
        aoFechar={() => setConfirmarSenha(false)}
        rodape={
          <>
            <Botao onClick={() => setConfirmarSenha(false)}>Cancelar</Botao>
            <Botao
              variante="perigo"
              carregando={redefinir.isPending}
              onClick={async () => {
                await redefinir.mutateAsync({ pessoaId: p.id });
                setConfirmarSenha(false);
                setCopiado(false);
                setMensagemSenha(mensagemNovaSenha(p.nome));
              }}
            >
              Redefinir
            </Botao>
          </>
        }
      >
        <p>
          A senha de <strong>{p.nome}</strong> voltará a ser a matrícula. As sessões abertas serão encerradas.
        </p>
      </Modal>

      <Modal
        aberto={mensagemSenha !== null}
        titulo="Senha redefinida"
        aoFechar={() => setMensagemSenha(null)}
        rodape={
          <>
            <Botao onClick={async () => setCopiado(await copiarTexto(mensagemSenha ?? ''))}>Copiar</Botao>
            <Botao variante="primario" onClick={() => setMensagemSenha(null)}>
              Fechar
            </Botao>
          </>
        }
      >
        <div className="pilha">
          <p>O sistema não envia e-mails. Mande esta mensagem para {p.nome} pelo e-mail ou WhatsApp:</p>
          <Campo rotulo="Mensagem para enviar">
            {(id) => <textarea id={id} className="cc-entrada" rows={4} readOnly value={mensagemSenha ?? ''} />}
          </Campo>
          {copiado && <Alerta tom="info">Copiado! Agora é só colar na conversa.</Alerta>}
        </div>
      </Modal>
    </Pagina>
  );
}
