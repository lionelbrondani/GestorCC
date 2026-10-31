import { useEffect, useId, useState } from 'react';
import { Alerta, Botao } from '../../componentes';

/** Lê QR ou código de barras pela câmera traseira e devolve o texto lido. */
export function LeitorCodigo({ aoLer, aoFechar }: { aoLer: (texto: string) => void; aoFechar: () => void }) {
  const id = useId().replace(/:/g, '');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let parar: (() => void) | null = null;
    let ativo = true;
    import('html5-qrcode')
      .then(({ Html5Qrcode }) => {
        if (!ativo) return;
        const leitor = new Html5Qrcode(`leitor-${id}`);
        parar = () => void leitor.stop().catch(() => undefined);
        return leitor.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (texto) => {
            aoLer(texto);
            parar?.();
          },
          () => undefined,
        );
      })
      .catch(() => setErro('Não foi possível abrir a câmera. Verifique a permissão do navegador.'));
    return () => {
      ativo = false;
      parar?.();
    };
  }, [id, aoLer]);

  return (
    <div className="pilha-2">
      <div id={`leitor-${id}`} className="leitor" />
      {erro && <Alerta tom="erro">{erro}</Alerta>}
      <div>
        <Botao tamanho="pequeno" onClick={aoFechar}>
          Fechar câmera
        </Botao>
      </div>
    </div>
  );
}
