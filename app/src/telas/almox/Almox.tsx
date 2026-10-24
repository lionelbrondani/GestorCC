import { pode } from '@shared';
import { useSearchParams } from 'react-router-dom';
import { useEu } from '../../auth/SessaoContexto';
import { Abas, Pagina } from '../../componentes';
import { Estoque } from './Estoque';
import { Etiquetas } from './Etiquetas';
import { PainelAlmox } from './PainelAlmox';
import { Pedidos } from './Pedidos';
import { Saida } from './Saida';
import './almox.css';

type Aba = 'estoque' | 'saida' | 'pedidos' | 'painel' | 'etiquetas';

export function Almox() {
  const eu = useEu();
  const [params, setParams] = useSearchParams();
  const veEstoque = pode(eu.permissoes, 'almoxEstoque', 'ver');
  const fazSaida = pode(eu.permissoes, 'almoxSaidas', 'editar');
  const abas = [
    veEstoque && { id: 'estoque' as const, rotulo: 'Estoque' },
    fazSaida && { id: 'saida' as const, rotulo: 'Saída' },
    veEstoque && { id: 'pedidos' as const, rotulo: 'Pedidos' },
    veEstoque && { id: 'painel' as const, rotulo: 'Painel' },
    veEstoque && { id: 'etiquetas' as const, rotulo: 'Etiquetas QR' },
  ].filter((a): a is { id: Aba; rotulo: string } => !!a);
  const aba = (abas.find((a) => a.id === params.get('aba'))?.id ?? abas[0]?.id) as Aba;

  return (
    <Pagina titulo="Almoxarifado" subtitulo="Estoque, retiradas e pedidos do Centro de Convenções.">
      <Abas abas={abas} ativa={aba} aoMudar={(a) => setParams({ aba: a }, { replace: true })} />
      {aba === 'estoque' && <Estoque />}
      {aba === 'saida' && <Saida />}
      {aba === 'pedidos' && <Pedidos />}
      {aba === 'painel' && <PainelAlmox />}
      {aba === 'etiquetas' && <Etiquetas />}
    </Pagina>
  );
}
