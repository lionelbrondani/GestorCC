import { formatarData, textoPrivacidade, type CortesiasPublica, type PessoaCortesia } from '@shared';
import { AvisoPrivacidade } from '../ficha/AvisoPrivacidade';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../../api/cliente';
import { useConsulta } from '../../api/hooks';
import { Alerta, Botao, Carregando, Cartao, EstadoVazio } from '../../componentes';
import '../ficha/ficha.css';
import { errosDasLinhas, ListaPessoas } from './ListaPessoas';
import './cortesias.css';

/** Página pública do link de cortesias: o destino (ex.: Casa do Estudante) lança quem vai receber, sem login. */
export function CortesiasDestino() {
  const { token = '' } = useParams();
  const api = useApi();
  const qc = useQueryClient();
  const dados = useConsulta('cortesia.abrir', { token });
  const [pessoas, setPessoas] = useState<PessoaCortesia[]>([]);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    if (dados.data) setPessoas(dados.data.pessoas);
  }, [dados.data]);

  async function salvar(d: CortesiasPublica) {
    setTentou(true);
    setAviso(null);
    if (errosDasLinhas(pessoas, d.destino.pedirMatricula).length) return setAviso({ tom: 'erro', texto: 'Confira as linhas destacadas.' });
    setSalvando(true);
    try {
      const r = await api.chamar('cortesia.salvar', { token, pessoas });
      qc.setQueryData(['cortesia.abrir', { token }], r);
      setAviso({ tom: 'sucesso', texto: `Lista salva às ${new Date().toTimeString().slice(0, 5)}. Você pode voltar por este link para corrigir.` });
    } catch (e) {
      setAviso({ tom: 'erro', texto: (e as Error).message });
    } finally {
      setSalvando(false);
    }
  }

  let conteudo;
  if (dados.isLoading) conteudo = <Carregando texto="Abrindo a lista…" />;
  else if (dados.error || !dados.data) conteudo = <EstadoVazio titulo="Não foi possível abrir a lista" texto={dados.error?.message ?? 'Tente de novo em instantes.'} />;
  else {
    const d = dados.data;
    const q = d.destino.quantidade;
    conteudo = (
      <>
        <h1>{d.evento.nome}</h1>
        <p className="texto-2" style={{ margin: 0 }}>
          {d.evento.datas.map(formatarData).join(', ')}
        </p>
        <Cartao destaque>
          <p className="cortesias-destaque">
            Você recebeu <strong>{q} {q === 1 ? 'cortesia' : 'cortesias'}</strong> para distribuir à <strong>{d.destino.nome}</strong>.
          </p>
          <p style={{ margin: 0 }}>
            {d.travada
              ? `O prazo para lançar os nomes terminou${d.prazo ? ` em ${formatarData(d.prazo)}` : ''}. Para mudar algo, fale com o Centro de Convenções.`
              : `Informe abaixo quem vai receber${d.destino.pedirMatricula ? ' (nome e matrícula)' : ''}. Você pode salvar e voltar por este mesmo link${d.prazo ? ` até ${formatarData(d.prazo)}` : ''}.`}
          </p>
        </Cartao>
        <Cartao>
          <ListaPessoas
            pessoas={pessoas}
            aoMudar={setPessoas}
            quantidade={q}
            pedirMatricula={d.destino.pedirMatricula}
            mostrarErros={tentou}
            somenteLeitura={d.travada}
          />
          {aviso && <Alerta tom={aviso.tom}>{aviso.texto}</Alerta>}
          {!d.travada && (
            <div className="cortesias-rodape">
              <Botao variante="primario" carregando={salvando} onClick={() => salvar(d)}>
                Salvar lista
              </Botao>
            </div>
          )}
        </Cartao>
      </>
    );
  }

  return (
    <div className="ficha-pagina">
      <header className="ficha-topo">
        <img src="/logo-cc-branco.png" alt="Centro de Convenções PRE | UFSM" className="so-tela" />
        <img src="/logo-cc-escuro.png" alt="" className="so-impressao" />
        <strong>Cortesias</strong>
      </header>
      <main className="ficha-conteudo" style={{ maxWidth: 760 }}>
        {conteudo}
        {dados.data && <AvisoPrivacidade texto={textoPrivacidade('cortesias', dados.data.diasGuardarDados)} />}
      </main>
    </div>
  );
}
