import { formatarData, formatarDataHora, somarDias, type FichaResumo } from '@shared';
import { Copy, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsulta } from '../../api/hooks';
import { Abas, Alerta, Botao, Carregando, EstadoVazio, Etiqueta, Pagina, Tabela, type ColunaTabela } from '../../componentes';
import { hoje } from '../../util/hoje';
import { linkDaFicha, mensagemDaFicha } from './FichaTecnicaEvento';
import './ficha.css';

type Filtro = 'proximas' | 'aguardando' | 'enviadas' | 'passadas';

const passou = (f: FichaResumo, dia: string) => f.eventoCancelado || (f.datas.length > 0 && f.datas[f.datas.length - 1] < dia);

function Situacao({ f }: { f: FichaResumo }) {
  if (f.eventoCancelado) return <Etiqueta tom="erro">Evento cancelado</Etiqueta>;
  return (
    <span className="pilha-2" style={{ gap: 4 }}>
      {f.status === 'enviada' ? <Etiqueta tom="sucesso">Enviada</Etiqueta> : <Etiqueta tom="aviso">Ainda não enviada</Etiqueta>}
      <span className="pequeno texto-2">
        {f.status === 'enviada' && f.enviadaEm ? `em ${formatarDataHora(f.enviadaEm)} · ` : ''}
        {f.travada ? 'travada' : f.prazo ? `prazo ${formatarData(f.prazo)}` : 'sem data'}
      </span>
    </span>
  );
}

function resumo(f: FichaResumo): string {
  if (f.status !== 'enviada' && !f.responsavel) return '—';
  const partes = [
    f.tipo,
    f.publico !== null && `${f.publico} de público`,
    f.elenco !== null && `${f.elenco} no elenco`,
    f.poltronas > 0 && `${f.poltronas} poltronas reservadas`,
    f.camarins > 0 && `${f.camarins} ${f.camarins === 1 ? 'camarim' : 'camarins'}`,
    f.coffeeBreak && 'coffee break',
  ];
  return partes.filter(Boolean).join(' · ') || '—';
}

/** Menu "Fichas técnicas": todas as fichas, com a situação, um resumo e os links para mandar ou imprimir. */
export function Fichas() {
  const fichas = useConsulta('fichas.listar', null);
  const [filtro, setFiltro] = useState<Filtro>('proximas');
  const [aviso, setAviso] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);

  if (fichas.isLoading) return <Carregando />;
  if (fichas.error) return <Alerta tom="erro">{fichas.error.message}</Alerta>;
  const dia = hoje();
  const todas = fichas.data ?? [];
  const proximas = todas.filter((f) => !passou(f, dia));
  const grupos: Record<Filtro, FichaResumo[]> = {
    proximas,
    aguardando: proximas.filter((f) => f.status !== 'enviada'),
    enviadas: proximas.filter((f) => f.status === 'enviada'),
    passadas: todas.filter((f) => passou(f, dia)).reverse(),
  };

  async function copiar(texto: string, ok: string) {
    setAviso(null);
    try {
      if (!navigator.clipboard) throw new Error('Não foi possível copiar: abra o evento e copie o link à mão.');
      await navigator.clipboard.writeText(texto);
      setAviso({ tom: 'sucesso', texto: ok });
    } catch (e) {
      setAviso({ tom: 'erro', texto: (e as Error).message });
    }
  }

  const colunas: ColunaTabela<FichaResumo>[] = [
    {
      chave: 'evento',
      titulo: 'Evento',
      render: (f) => (
        <span className="pilha-2" style={{ gap: 2 }}>
          <Link to={`/agenda/${f.eventoId}`} className="negrito">
            {f.evento}
          </Link>
          <span className="pequeno texto-2">{f.datas.map(formatarData).join(', ') || 'sem sessões'}</span>
        </span>
      ),
    },
    { chave: 'situacao', titulo: 'Situação', render: (f) => <Situacao f={f} /> },
    { chave: 'responsavel', titulo: 'Responsável', render: (f) => f.responsavel || '—' },
    { chave: 'resumo', titulo: 'Resumo', render: (f) => <span className="pequeno">{resumo(f)}</span> },
    {
      chave: 'acoes',
      titulo: '',
      render: (f) => (
        <span className="linha" style={{ flexWrap: 'nowrap' }}>
          <Botao tamanho="pequeno" onClick={() => copiar(linkDaFicha(f.token), 'Link copiado.')}>
            <Copy size={14} aria-hidden /> Copiar link
          </Botao>
          <Botao tamanho="pequeno" variante="fantasma" onClick={() => copiar(mensagemDaFicha(f.evento, f.token, f.prazo), 'Mensagem copiada. Cole no e-mail ou no WhatsApp do produtor.')}>
            Mensagem
          </Botao>
          <Link to={`/agenda/${f.eventoId}/ficha`} className="cc-botao" data-variante="fantasma" data-tamanho="pequeno">
            <Printer size={14} aria-hidden /> Imprimir
          </Link>
        </span>
      ),
    },
  ];

  return (
    <Pagina titulo="Fichas técnicas" subtitulo="Os links mandados aos produtores e as fichas recebidas. Para gerar um link, abra o evento na Agenda.">
      {todas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma ficha ainda"
          texto="Abra um evento na Agenda e use o cartão Ficha técnica para gerar o link do produtor."
          acao={
            <Link to="/agenda" className="cc-botao" data-variante="primario">
              Ir para a Agenda
            </Link>
          }
        />
      ) : (
        <>
          <div className="fichas-numeros">
            <div>
              <strong>{grupos.enviadas.length}</strong>
              <span>enviadas</span>
            </div>
            <div>
              <strong>{grupos.aguardando.length}</strong>
              <span>aguardando o produtor</span>
            </div>
            <div>
              <strong>{grupos.aguardando.filter((f) => f.prazo && f.prazo >= dia && f.prazo <= somarDias(dia, 7)).length}</strong>
              <span>com prazo nesta semana</span>
            </div>
          </div>
          <Abas
            abas={[
              { id: 'proximas', rotulo: `Próximas (${grupos.proximas.length})` },
              { id: 'aguardando', rotulo: `Aguardando (${grupos.aguardando.length})` },
              { id: 'enviadas', rotulo: `Enviadas (${grupos.enviadas.length})` },
              { id: 'passadas', rotulo: `Passadas (${grupos.passadas.length})` },
            ]}
            ativa={filtro}
            aoMudar={setFiltro}
          />
          {aviso && <Alerta tom={aviso.tom}>{aviso.texto}</Alerta>}
          <Tabela colunas={colunas} linhas={grupos[filtro]} chaveLinha={(f) => f.eventoId} vazio="Nenhuma ficha aqui." />
        </>
      )}
    </Pagina>
  );
}
