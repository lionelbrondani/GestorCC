import { Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useConsulta } from '../../api/hooks';
import { Botao, Campo, Carregando, Cartao } from '../../componentes';

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function Etiquetas() {
  const q = useConsulta('almox.listar', null);
  const [busca, setBusca] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [imagens, setImagens] = useState<Record<string, string>>({});

  useEffect(() => {
    let ativo = true;
    Promise.all([...marcados].map(async (cod) => [cod, await QRCode.toDataURL(cod, { margin: 1, width: 220 })] as const))
      .then((pares) => ativo && setImagens(Object.fromEntries(pares)))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [marcados]);

  if (q.isLoading || !q.data) return <Carregando />;
  const ativos = q.data.itens.filter((i) => i.status === 'Ativo');
  const lista = ativos.filter((i) => !busca || sem(`${i.cod} ${i.nomeComum} ${i.nomeAlmox}`).includes(sem(busca)));
  const escolhidos = ativos.filter((i) => marcados.has(i.cod));
  const alternar = (cod: string, ligar: boolean) => {
    const n = new Set(marcados);
    if (ligar) n.add(cod);
    else n.delete(cod);
    setMarcados(n);
  };

  return (
    <div className="grade-2">
      <Cartao titulo="Escolha os itens" className="nao-imprimir">
        <div className="pilha-2">
          <Campo rotulo="Buscar">{(id) => <input id={id} className="cc-entrada" value={busca} onChange={(e) => setBusca(e.target.value)} />}</Campo>
          <div className="linha">
            <Botao tamanho="pequeno" onClick={() => setMarcados(new Set(lista.map((i) => i.cod)))}>
              Marcar todos da lista
            </Botao>
            <Botao tamanho="pequeno" variante="fantasma" onClick={() => setMarcados(new Set())}>
              Limpar
            </Botao>
          </div>
          <div className="pilha-2" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {lista.map((i) => (
              <label key={i.cod} className="cc-caixa pequeno">
                <input type="checkbox" checked={marcados.has(i.cod)} onChange={(e) => alternar(i.cod, e.target.checked)} />[{i.cod}] {i.nomeComum || i.nomeAlmox}
              </label>
            ))}
          </div>
        </div>
      </Cartao>
      <Cartao
        titulo={`Etiquetas (${escolhidos.length})`}
        acoes={
          <Botao tamanho="pequeno" variante="primario" disabled={!escolhidos.length} onClick={() => window.print()}>
            <Printer size={14} aria-hidden /> Imprimir
          </Botao>
        }
      >
        <div className="etiquetas-grade folha-impressao">
          {escolhidos.map((i) => (
            <div key={i.cod} className="etiqueta-qr">
              {imagens[i.cod] && <img src={imagens[i.cod]} alt={`QR do código ${i.cod}`} />}
              <div>
                <strong>{i.cod}</strong>
              </div>
              <div>{i.nomeComum || i.nomeAlmox}</div>
            </div>
          ))}
        </div>
      </Cartao>
    </div>
  );
}
