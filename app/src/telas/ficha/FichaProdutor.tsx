import { formatarData, formatarDataHora, type FichaPublica } from '@shared';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../../api/cliente';
import { useConsulta } from '../../api/hooks';
import { Alerta, Botao, Carregando, EstadoVazio } from '../../componentes';
import { lerComoDataUrl } from '../../util/arquivos';
import { FormularioFicha } from './FormularioFicha';
import { ResumoFicha } from './ResumoFicha';
import './ficha.css';

/** Página pública do link da ficha técnica: o produtor preenche sem login, só a ficha do evento dele. */
export function FichaProdutor() {
  const { token = '' } = useParams();
  const api = useApi();
  const qc = useQueryClient();
  const ficha = useConsulta('ficha.abrir', { token });
  const [editando, setEditando] = useState(false);
  const atualizar = (f: FichaPublica) => qc.setQueryData(['ficha.abrir', { token }], f);

  let conteudo;
  if (ficha.isLoading) conteudo = <Carregando texto="Abrindo a ficha…" />;
  else if (ficha.error || !ficha.data) {
    conteudo = <EstadoVazio titulo="Não foi possível abrir a ficha" texto={ficha.error?.message ?? 'Tente de novo em instantes.'} />;
  } else {
    const f = ficha.data;
    const prazo = f.prazo ? formatarData(f.prazo) : null;
    if (f.travada) {
      conteudo = (
        <>
          <Alerta tom="aviso">O prazo para alterar esta ficha terminou{prazo ? ` em ${prazo}` : ''}. Para mudar algo, fale com o Centro de Convenções.</Alerta>
          <ResumoFicha evento={f.evento} dados={f.dados} />
        </>
      );
    } else if (f.status === 'enviada' && !editando) {
      conteudo = (
        <>
          <Alerta tom="sucesso">
            <span className="linha" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <CheckCircle2 size={20} aria-hidden style={{ flex: 'none' }} />
              <span>
                <strong>Ficha enviada{f.enviadaEm ? ` em ${formatarDataHora(f.enviadaEm)}` : ''}.</strong> Obrigado! Você ainda pode corrigir pelo mesmo link
                {prazo ? ` até ${prazo}` : ''}.
              </span>
            </span>
          </Alerta>
          <div className="linha">
            <Botao variante="primario" onClick={() => setEditando(true)}>
              Corrigir a ficha
            </Botao>
            <Botao onClick={() => window.print()}>Imprimir</Botao>
          </div>
          <ResumoFicha evento={f.evento} dados={f.dados} />
        </>
      );
    } else {
      conteudo = (
        <>
          {f.status === 'rascunho' && (
            <Alerta tom="info">
              Preencha com calma: cada etapa fica salva ao continuar, e você pode fechar e voltar por este mesmo link
              {prazo ? `. Prazo para enviar e corrigir: ${prazo}` : ''}.
            </Alerta>
          )}
          <FormularioFicha
            evento={f.evento}
            inicial={f.dados}
            modo="produtor"
            linkFolder={f.linkFolder}
            aoSalvar={async (dados, enviar) => {
              const r = await api.chamar('ficha.salvar', { token, dados, enviar });
              atualizar(r);
              if (enviar) {
                setEditando(false);
                window.scrollTo?.({ top: 0 });
              }
            }}
            aoAnexar={async (arquivo) => api.chamar('ficha.anexar', { token, nome: arquivo.name, arquivo: await lerComoDataUrl(arquivo) })}
          />
        </>
      );
    }
  }

  return (
    <div className="ficha-pagina">
      <header className="ficha-topo">
        <img src="/logo-cc.png" alt="" />
        <div>
          <strong>Ficha técnica</strong>
          <small>Centro de Convenções · PRE | UFSM</small>
        </div>
      </header>
      <main className="ficha-conteudo">
        {ficha.data && <h1>{ficha.data.evento.nome}</h1>}
        {conteudo}
      </main>
    </div>
  );
}
