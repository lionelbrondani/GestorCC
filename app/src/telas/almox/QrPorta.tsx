import { Printer, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useConsulta, useMutacao } from '../../api/hooks';
import { Alerta, Botao, Carregando, Modal } from '../../componentes';
import { DO_SETOR } from '@shared';

/** Aba "QR da porta": cartaz A4 com o QR da retirada de material, para colar na porta do almoxarifado. */
export function QrPorta() {
  const qr = useConsulta('almox.qr', {});
  const trocar = useMutacao('almox.qr', ['almox.qr', 'historico.listar']);
  const [imagem, setImagem] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const link = qr.data ? `${window.location.origin}/retirada?k=${qr.data.chave}` : '';

  useEffect(() => {
    if (!link) return;
    let vivo = true;
    QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((svg) => vivo && setImagem(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))
      .catch(() => vivo && setImagem(null));
    return () => {
      vivo = false;
    };
  }, [link]);

  if (qr.isLoading) return <Carregando />;

  return (
    <div className="pilha">
      <div className="linha nao-imprimir">
        <Botao variante="primario" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir cartaz
        </Botao>
        <Botao onClick={() => setConfirmar(true)}>
          <RefreshCw size={16} aria-hidden /> Gerar QR novo
        </Botao>
        <span className="pequeno texto-2">Qualquer pessoa da equipe lança a retirada pelo celular, sem login. As retiradas avisam no sininho.</span>
      </div>
      <div className="qr-porta">
        <h1>Retirada de material</h1>
        <p className="qr-porta-sub">Almoxarifado {DO_SETOR}</p>
        {imagem && <img className="qr-porta-codigo" src={imagem} alt="QR code da retirada de material" />}
        <ol>
          <li>Aponte a câmera do celular para o código.</li>
          <li>Escreva seu nome, escolha os itens e a quantidade.</li>
          <li>Diga para que é e toque em Registrar retirada.</li>
        </ol>
        <p className="qr-porta-link">{link}</p>
      </div>
      <Modal
        aberto={confirmar}
        titulo="Gerar QR novo"
        aoFechar={() => setConfirmar(false)}
        rodape={
          <>
            <Botao onClick={() => setConfirmar(false)}>Cancelar</Botao>
            <Botao
              variante="perigo"
              carregando={trocar.isPending}
              onClick={async () => {
                await trocar.mutateAsync({ novo: true });
                setConfirmar(false);
              }}
            >
              Gerar e invalidar o antigo
            </Botao>
          </>
        }
      >
        <Alerta tom="aviso">O cartaz que está na porta para de funcionar. Imprima e cole o novo logo em seguida.</Alerta>
      </Modal>
    </div>
  );
}
