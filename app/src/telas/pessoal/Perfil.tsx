import { cpfValido, normalizarCpf, type DadosPessoais } from '@shared';
import { useEffect, useState } from 'react';
import { useConsulta, useMutacao } from '../../api/hooks';
import { FormTrocarSenha } from '../../auth/AvisoSenha';
import { useEu, useSessao } from '../../auth/SessaoContexto';
import { Alerta, Botao, Campo, Cartao, Pagina } from '../../componentes';

function FormDadosPessoais({ pessoaId }: { pessoaId: string }) {
  const q = useConsulta('dadosPessoais.obter', { pessoaId });
  const salvar = useMutacao('dadosPessoais.salvar', ['dadosPessoais.obter']);
  const [dados, setDados] = useState<DadosPessoais>({ pessoaId, cpf: '', banco: '', agencia: '', conta: '' });
  const [msg, setMsg] = useState<{ tom: 'erro' | 'sucesso'; texto: string } | null>(null);

  useEffect(() => {
    if (q.data) setDados(q.data);
  }, [q.data]);

  const campo = (k: keyof DadosPessoais) => ({
    value: (dados[k] as string) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDados({ ...dados, [k]: e.target.value }),
  });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!cpfValido(dados.cpf)) return setMsg({ tom: 'erro', texto: 'CPF inválido. Confira os números.' });
    try {
      await salvar.mutateAsync({ ...dados, cpf: normalizarCpf(dados.cpf)! });
      setMsg({ tom: 'sucesso', texto: 'Dados salvos.' });
    } catch (err) {
      setMsg({ tom: 'erro', texto: (err as Error).message });
    }
  }

  return (
    <form className="pilha" onSubmit={enviar}>
      <div className="grade-2">
        <Campo rotulo="CPF">{(id) => <input id={id} className="cc-entrada" inputMode="numeric" {...campo('cpf')} />}</Campo>
        <Campo rotulo="Banco">{(id) => <input id={id} className="cc-entrada" {...campo('banco')} />}</Campo>
        <Campo rotulo="Agência">{(id) => <input id={id} className="cc-entrada" {...campo('agencia')} />}</Campo>
        <Campo rotulo="Conta (com dígito)">{(id) => <input id={id} className="cc-entrada" {...campo('conta')} />}</Campo>
        <Campo rotulo="Tamanho de camiseta">{(id) => <input id={id} className="cc-entrada" {...campo('camiseta')} />}</Campo>
        <Campo rotulo="Data de nascimento">{(id) => <input id={id} className="cc-entrada" type="date" {...campo('nascimento')} />}</Campo>
      </div>
      <p className="pequeno texto-2">Ao alterar dados bancários, os gestores serão avisados. Só você e quem cuida dos pagamentos veem estes dados.</p>
      {msg && <Alerta tom={msg.tom}>{msg.texto}</Alerta>}
      <div>
        <Botao type="submit" variante="primario" carregando={salvar.isPending}>
          Salvar dados
        </Botao>
      </div>
    </form>
  );
}

export function Perfil() {
  const eu = useEu();
  const { marcarSenhaTrocada } = useSessao();
  const [trocada, setTrocada] = useState(false);
  return (
    <Pagina titulo="Perfil" subtitulo={`${eu.nome} · ${eu.emailAcademico}`}>
      <div className="grade-2">
        <Cartao titulo="Trocar senha">
          {trocada ? (
            <Alerta tom="sucesso">Senha alterada com sucesso.</Alerta>
          ) : (
            <FormTrocarSenha
              aoConcluir={() => {
                setTrocada(true);
                marcarSenhaTrocada();
              }}
            />
          )}
        </Cartao>
        <Cartao titulo="Meus dados para pagamento">
          <FormDadosPessoais pessoaId={eu.id} />
        </Cartao>
      </div>
    </Pagina>
  );
}
