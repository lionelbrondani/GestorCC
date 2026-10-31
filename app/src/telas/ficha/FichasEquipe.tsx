import { formatarData, formatarDataHora, type FichaPanorama } from '@shared';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../api/cliente';
import { useConsulta } from '../../api/hooks';
import { Abas, Alerta, Botao, Carregando, EstadoVazio, Pagina, Tabela, type ColunaTabela } from '../../componentes';
import { baixar } from '../../util/arquivos';
import { hoje } from '../../util/hoje';
import { resumo } from './Fichas';
import { ResumoFicha } from './ResumoFicha';
import './ficha.css';

const passou = (f: FichaPanorama, dia: string) => f.datas.length > 0 && f.datas[f.datas.length - 1] < dia;

/** Menu "Fichas dos eventos": as fichas enviadas pelos produtores, para toda a equipe ter o panorama de cada evento. */
export function FichasEquipe() {
  const fichas = useConsulta('fichas.panorama', null);
  const [aba, setAba] = useState<'proximas' | 'passadas'>('proximas');

  if (fichas.isLoading) return <Carregando />;
  if (fichas.error) return <Alerta tom="erro">{fichas.error.message}</Alerta>;
  const dia = hoje();
  const todas = fichas.data ?? [];
  const grupos = { proximas: todas.filter((f) => !passou(f, dia)), passadas: todas.filter((f) => passou(f, dia)).reverse() };

  const colunas: ColunaTabela<FichaPanorama>[] = [
    {
      chave: 'evento',
      titulo: 'Evento',
      render: (f) => (
        <span className="pilha-2" style={{ gap: 2 }}>
          <Link to={`/fichas-eventos/${f.eventoId}`} className="negrito">
            {f.evento}
          </Link>
          <span className="pequeno texto-2">{f.datas.map(formatarData).join(', ') || 'sem sessões'}</span>
        </span>
      ),
    },
    { chave: 'responsavel', titulo: 'Responsável', render: (f) => f.responsavel || '—' },
    { chave: 'resumo', titulo: 'Resumo', render: (f) => <span className="pequeno">{resumo(f)}</span> },
  ];

  return (
    <Pagina titulo="Fichas dos eventos" subtitulo="As fichas técnicas enviadas pelos produtores: o panorama de cada evento para toda a equipe.">
      {todas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma ficha enviada ainda" texto="Quando um produtor enviar a ficha técnica do evento, ela aparece aqui." />
      ) : (
        <>
          <Abas
            abas={[
              { id: 'proximas', rotulo: `Próximas (${grupos.proximas.length})` },
              { id: 'passadas', rotulo: `Passadas (${grupos.passadas.length})` },
            ]}
            ativa={aba}
            aoMudar={setAba}
          />
          <Tabela colunas={colunas} linhas={grupos[aba]} chaveLinha={(f) => f.eventoId} vazio="Nenhuma ficha aqui." />
        </>
      )}
    </Pagina>
  );
}

/** Uma ficha enviada, só para ler (sem o contato do responsável). */
export function FichaEquipe() {
  const { eventoId = '' } = useParams();
  const api = useApi();
  const ficha = useConsulta('fichas.panoramaVer', { eventoId });
  const [erro, setErro] = useState('');

  if (ficha.isLoading) return <Carregando />;
  if (ficha.error) return <Alerta tom="erro">{ficha.error.message}</Alerta>;
  const f = ficha.data;
  const voltar = (
    <Link to="/fichas-eventos" className="cc-botao" data-variante="secundario">
      Voltar
    </Link>
  );
  if (!f) return <EstadoVazio titulo="Ficha ainda não enviada" texto="O produtor ainda não enviou a ficha técnica deste evento." acao={voltar} />;

  async function baixarAnexo(a: { id: string; nome: string }) {
    setErro('');
    try {
      const dados = await api.chamar('fichas.panoramaAnexo', { eventoId, anexoId: a.id });
      if (!dados) throw new Error('O arquivo não está mais no Drive.');
      baixar(dados, a.nome);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Pagina
      titulo={`Ficha técnica: ${f.evento.nome}`}
      subtitulo={`${f.evento.sessoes.map((s) => formatarData(s.data)).join(', ')}${f.enviadaEm ? ` · enviada em ${formatarDataHora(f.enviadaEm)}` : ''}`}
      acoes={
        <>
          {voltar}
          <Botao variante="primario" onClick={() => window.print()}>
            <Printer size={16} aria-hidden /> Imprimir
          </Botao>
        </>
      }
    >
      {erro && <Alerta tom="erro">{erro}</Alerta>}
      <ResumoFicha evento={f.evento} dados={f.dados} aoBaixarAnexo={baixarAnexo} semDadosPessoais />
    </Pagina>
  );
}
