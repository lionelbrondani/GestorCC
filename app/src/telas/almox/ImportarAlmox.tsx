import type { Saida } from '@shared';
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { useMutacao } from '../../api/hooks';
import { Alerta, Botao, Modal } from '../../componentes';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Importa o catálogo antigo (BD_Almox) colado nas abas IMPORTAR_ALMOX e IMPORTAR_AUTORIZADOS da planilha Dados. */
export function ImportarAlmox() {
  const [aberto, setAberto] = useState(false);
  const [resultado, setResultado] = useState<Saida<'almox.importar'> | null>(null);
  const importar = useMutacao('almox.importar', ['almox.listar']);

  function fechar() {
    setAberto(false);
    setResultado(null);
    importar.reset();
  }

  return (
    <>
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        <FileSpreadsheet size={16} aria-hidden /> Importar da planilha
      </Botao>
      <Modal
        aberto={aberto}
        titulo="Importar da planilha"
        aoFechar={fechar}
        rodape={
          resultado ? (
            <Botao variante="primario" onClick={fechar}>
              Concluir
            </Botao>
          ) : (
            <>
              <Botao variante="fantasma" onClick={fechar}>
                Cancelar
              </Botao>
              <Botao variante="primario" carregando={importar.isPending} onClick={async () => setResultado(await importar.mutateAsync(null))}>
                Importar agora
              </Botao>
            </>
          )
        }
      >
        <div className="pilha-3">
          <p className="texto-2">
            Lê as abas IMPORTAR_ALMOX (COD, NOME_ALMOX, NOME_COMUM, UNIDADE, VALOR, CATEGORIA, QTD_MINIMA, SALA, STATUS, SALDO) e IMPORTAR_AUTORIZADOS
            (NOME), na planilha Dados. Itens com código já cadastrado ficam como estão; o saldo de cada item novo entra como ajuste inicial.
          </p>
          {importar.error && <Alerta tom="erro">{importar.error.message}</Alerta>}
          {resultado && (
            <>
              <Alerta tom="sucesso">
                {`${plural(resultado.itens, 'item', 'itens')} e ${plural(resultado.autorizados, 'autorizado externo', 'autorizados externos')} importados.`}
              </Alerta>
              {resultado.problemas.length > 0 && (
                <ul className="pilha-2">
                  {resultado.problemas.map((p) => (
                    <li key={p.linha}>{`Linha ${p.linha}: ${p.mensagem}`}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
