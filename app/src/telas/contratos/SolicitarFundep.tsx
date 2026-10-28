import { formatarReais, montarEmailFundep, valorTotalContrato, type Aditivo, type Contrato } from '@shared';
import { Copy, Mail } from 'lucide-react';
import { useState } from 'react';
import { useApi } from '../../api/cliente';
import { Alerta, Botao, Carregando, Cartao, EstadoVazio, Pagina } from '../../componentes';
import { ModalEmail, type RascunhoEmail } from '../../componentes/ModalEmail';
import { useQueryClient } from '@tanstack/react-query';
import { copiarTexto } from '../escalas/dadosEscalas';
import { AVISO_VERSAO_INICIAL } from './Contratos';
import { INVALIDAR_CONTRATOS, useDadosContratos } from './dadosContratos';

type Item = { chave: string; contrato: Contrato; aditivo?: Aditivo };
const PENDENTE = 'Não enviada p/ emissão';

export function SolicitarFundep() {
  const dados = useDadosContratos();
  const api = useApi();
  const qc = useQueryClient();
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ tom: 'sucesso' | 'erro' | 'info'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoEmail | null>(null);
  if (dados.carregando || !dados.config) return <Carregando />;

  const assinados = dados.contratos.filter((c) => c.statusContrato === 'Assinado');
  const itens: Item[] = [
    ...assinados.filter((c) => c.statusFatura === PENDENTE).map((c) => ({ chave: c.id, contrato: c })),
    ...dados.aditivos
      .filter((a) => a.statusFatura === PENDENTE)
      .map((a) => ({ chave: a.id, contrato: dados.contratos.find((c) => c.id === a.contratoId)!, aditivo: a }))
      .filter((x) => x.contrato && x.contrato.statusContrato === 'Assinado'),
  ];
  const escolhidos = itens.filter((i) => marcados.has(i.chave));
  const contratante = (c: Contrato) => dados.contratantes.find((k) => k.id === c.contratanteId)!;
  const email = escolhidos.length
    ? montarEmailFundep(escolhidos.map((i) => ({ contrato: i.contrato, contratante: contratante(i.contrato), aditivo: i.aditivo })), dados.config)
    : null;

  // vão anexados os PDFs assinados que já estão no sistema (os aditivos não têm PDF próprio)
  const nomeItem = (i: Item) => (i.aditivo ? `Aditivo ${i.aditivo.numero} ao ${i.contrato.numero}` : `Contrato ${i.contrato.numero}`);
  const comPdf = escolhidos.filter((i) => !i.aditivo && i.contrato.pdfAssinado);
  const semPdf = escolhidos.filter((i) => i.aditivo || !i.contrato.pdfAssinado);
  const observacao = [
    comPdf.length ? `Vão anexados os PDFs assinados: ${comPdf.map(nomeItem).join(', ')}.` : 'Nenhum PDF assinado vai anexado.',
    semPdf.length ? `Sem PDF assinado no sistema: ${semPdf.map(nomeItem).join(', ')} (anexe no contrato, no cartão Anexos, ou mande à parte).` : '',
  ].join(' ');

  async function marcarEnviado() {
    setEnviando(true);
    try {
      for (const i of escolhidos) {
        if (i.aditivo) await api.chamar('contratos.salvarAditivo', { ...i.aditivo, statusFatura: 'Enviada p/ emissão' });
        else await api.chamar('contratos.salvar', { ...i.contrato, statusFatura: 'Enviada p/ emissão' });
      }
      await qc.invalidateQueries({ predicate: (q) => (INVALIDAR_CONTRATOS as readonly string[]).includes(q.queryKey[0] as string) });
      setMarcados(new Set());
      setMsg({ tom: 'sucesso', texto: 'Faturas marcadas como "Enviada p/ emissão". Registre o nº da fatura no contrato quando a FUNDEP responder.' });
    } catch (e) {
      setMsg({ tom: 'erro', texto: (e as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pagina titulo="Solicitar faturas à FUNDEP" subtitulo="Monta o e-mail de cadastramento de contratos/clientes para emissão de fatura.">
      <Alerta tom="info">{AVISO_VERSAO_INICIAL}</Alerta>
      {!itens.length ? (
        <EstadoVazio titulo="Nenhuma fatura para pedir" texto='Aparecem aqui contratos e aditivos assinados com fatura "Não enviada p/ emissão".' />
      ) : (
        <div className="grade-2">
          <Cartao titulo="Contratos e aditivos assinados">
            <div className="pilha-2">
              {itens.map((i) => (
                <label key={i.chave} className="cc-caixa">
                  <input
                    type="checkbox"
                    checked={marcados.has(i.chave)}
                    onChange={(e) => {
                      const n = new Set(marcados);
                      if (e.target.checked) n.add(i.chave);
                      else n.delete(i.chave);
                      setMarcados(n);
                    }}
                  />
                  <span>
                    <strong>{i.aditivo ? `Aditivo ${i.aditivo.numero} ao ${i.contrato.numero}` : `Contrato ${i.contrato.numero}`}</strong> ·{' '}
                    {contratante(i.contrato)?.razaoSocial} ·{' '}
                    {formatarReais(i.aditivo ? i.aditivo.valorDelta : valorTotalContrato(i.contrato, []))}
                  </span>
                </label>
              ))}
            </div>
          </Cartao>
          <Cartao titulo="Prévia do e-mail">
            {email ? (
              <div className="pilha">
                <p className="pequeno">
                  <strong>Para:</strong> {email.destinatarios.join(', ')}
                  <br />
                  <strong>Assunto:</strong> {email.assunto}
                </p>
                <div className="texto-whats" style={{ maxHeight: 360 }} dangerouslySetInnerHTML={{ __html: email.corpoHtml }} />
                <div className="linha">
                  <Botao
                    onClick={async () =>
                      setMsg((await copiarTexto(email.corpoTexto, email.corpoHtml)) ? { tom: 'info', texto: 'Copiado! Cole no Gmail e anexe os contratos assinados.' } : { tom: 'erro', texto: 'Não foi possível copiar.' })
                    }
                  >
                    <Copy size={16} aria-hidden /> Copiar formatado
                  </Botao>
                  <Botao
                    onClick={() =>
                      setRascunho({
                        tipo: 'fundep',
                        titulo: 'Pedir as faturas à FUNDEP por e-mail',
                        para: email.destinatarios,
                        assunto: email.assunto,
                        mensagem: email.corpoTexto,
                        html: email.corpoHtml,
                        contratoIds: escolhidos.filter((i) => !i.aditivo).map((i) => i.contrato.id),
                        observacao,
                      })
                    }
                  >
                    <Mail size={16} aria-hidden /> Enviar por e-mail
                  </Botao>
                  <Botao variante="primario" carregando={enviando} onClick={marcarEnviado}>
                    Marcar como enviado
                  </Botao>
                </div>
                <p className="pequeno texto-3">Mande por <strong>Enviar por e-mail</strong> (você confere tudo antes; os PDFs assinados que estão no sistema vão anexados) ou copie e cole no seu e-mail. Depois, use Marcar como enviado.</p>
              </div>
            ) : (
              <p className="texto-3">Selecione ao lado o que vai no e-mail.</p>
            )}
          </Cartao>
        </div>
      )}
      {msg && <Alerta tom={msg.tom}>{msg.texto}</Alerta>}
      <ModalEmail rascunho={rascunho} aoFechar={() => setRascunho(null)} />
    </Pagina>
  );
}
