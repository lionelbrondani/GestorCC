import type { Contrato } from '@shared';
import { Download, ExternalLink, FileText, Upload } from 'lucide-react';
import { useState } from 'react';
import { useApi } from '../../api/cliente';
import { useMutacao } from '../../api/hooks';
import { Alerta, Botao, Cartao, Carregando, Modal } from '../../componentes';
import { INVALIDAR_CONTRATOS } from './dadosContratos';

type TipoDocumento = 'contrato' | 'termo' | 'piano';
const DOCUMENTOS: { tipo: TipoDocumento; rotulo: string }[] = [
  { tipo: 'contrato', rotulo: 'Gerar contrato' },
  { tipo: 'termo', rotulo: 'Gerar termo de autorização' },
  { tipo: 'piano', rotulo: 'Formulário do piano' },
];
const ANEXOS = [
  { tipo: 'assinado' as const, rotulo: 'contrato assinado', campo: 'pdfAssinado' as const },
  { tipo: 'fatura' as const, rotulo: 'fatura', campo: 'pdfFatura' as const },
];

const lerComoDataUrl = (f: File) =>
  new Promise<string>((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => falha(new Error('Não foi possível ler o arquivo.'));
    r.readAsDataURL(f);
  });

function baixar(dataUrl: string, nome: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = nome;
  a.click();
}

/** Documentos gerados dos modelos do Google Docs e PDFs anexados ao contrato (spec 9.2 e 9.6). */
export function DocumentosContrato({ contrato, editar }: { contrato: Contrato; editar: boolean }) {
  const api = useApi();
  const gerar = useMutacao('documentos.gerar', []);
  const anexar = useMutacao('contratos.anexar', [...INVALIDAR_CONTRATOS]);
  const [aberto, setAberto] = useState<(typeof DOCUMENTOS)[number] | null>(null);
  const [msg, setMsg] = useState<{ tom: 'erro' | 'sucesso'; texto: string } | null>(null);
  const nomeBase = contrato.numero.replace('/', '-');

  async function abrirDocumento(d: (typeof DOCUMENTOS)[number]) {
    gerar.reset();
    setAberto(d);
    await gerar.mutateAsync({ contratoId: contrato.id, tipo: d.tipo }).catch(() => undefined);
  }

  async function enviar(tipo: 'assinado' | 'fatura', arquivo: File | undefined) {
    if (!arquivo) return;
    setMsg(null);
    try {
      await anexar.mutateAsync({ contratoId: contrato.id, tipo, arquivo: await lerComoDataUrl(arquivo) });
      setMsg({ tom: 'sucesso', texto: 'PDF anexado.' });
    } catch (e) {
      setMsg({ tom: 'erro', texto: (e as Error).message });
    }
  }

  async function baixarAnexo(tipo: 'assinado' | 'fatura') {
    setMsg(null);
    const dados = await api.chamar('contratos.anexo', { contratoId: contrato.id, tipo }).catch((e: Error) => setMsg({ tom: 'erro', texto: e.message }));
    if (dados) baixar(dados, `Contrato ${nomeBase} - ${tipo}.pdf`);
  }

  return (
    <>
      {editar && (
        <Cartao titulo="Documentos">
          <div className="linha">
            {DOCUMENTOS.map((d) => (
              <Botao key={d.tipo} onClick={() => abrirDocumento(d)}>
                <FileText size={16} aria-hidden /> {d.rotulo}
              </Botao>
            ))}
          </div>
        </Cartao>
      )}

      <Cartao titulo="Anexos">
        <div className="pilha-2">
          {ANEXOS.map((a) => (
            <div key={a.tipo} className="linha-entre">
              <span>{contrato[a.campo] ? `PDF da ${a.rotulo} anexado.` : `Sem PDF da ${a.rotulo}.`}</span>
              <span className="linha">
                {contrato[a.campo] && (
                  <Botao tamanho="pequeno" onClick={() => baixarAnexo(a.tipo)}>
                    <Download size={14} aria-hidden /> Baixar
                  </Botao>
                )}
                {editar && (
                  <label className="cc-botao" data-variante="secundario" data-tamanho="pequeno">
                    <Upload size={14} aria-hidden /> {contrato[a.campo] ? 'Trocar' : 'Enviar'}
                    <input
                      type="file"
                      accept="application/pdf"
                      aria-label={`Enviar ${a.rotulo} (PDF)`}
                      style={{ display: 'none' }}
                      onChange={(e) => enviar(a.tipo, e.target.files?.[0])}
                    />
                  </label>
                )}
              </span>
            </div>
          ))}
          {anexar.isPending && <Carregando />}
          {msg && <Alerta tom={msg.tom}>{msg.texto}</Alerta>}
        </div>
      </Cartao>

      <Modal aberto={!!aberto} titulo={aberto?.rotulo ?? ''} aoFechar={() => setAberto(null)} rodape={<Botao onClick={() => setAberto(null)}>Fechar</Botao>}>
        {gerar.isPending && <Carregando />}
        {gerar.error && <Alerta tom="erro">{gerar.error.message}</Alerta>}
        {gerar.data && (
          <div className="pilha-2">
            <p>Documento criado a partir do modelo, já com os dados deste contrato. Revise antes de enviar.</p>
            <div className="linha">
              <a className="cc-botao" data-variante="primario" href={gerar.data.url} target="_blank" rel="noreferrer">
                <ExternalLink size={16} aria-hidden /> Abrir no Google Docs
              </a>
              <a className="cc-botao" data-variante="secundario" href={gerar.data.docx} download={`${aberto?.rotulo.replace('Gerar ', '')} ${nomeBase}.docx`}>
                <Download size={16} aria-hidden /> Baixar .docx
              </a>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
