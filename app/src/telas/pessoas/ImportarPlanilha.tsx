import type { Saida } from '@shared';
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { useMutacao } from '../../api/hooks';
import { Alerta, Botao, Modal } from '../../componentes';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Importação em lote: lê a aba IMPORTAR_PESSOAS da planilha Sigiloso. */
export function ImportarPlanilha() {
  const [aberto, setAberto] = useState(false);
  const [resultado, setResultado] = useState<Saida<'pessoas.importar'> | null>(null);
  const importar = useMutacao('pessoas.importar', ['pessoas.listar']);

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
            Lê as linhas da aba IMPORTAR_PESSOAS, na planilha Sigiloso. Quem já tem cadastro (mesma matrícula) só tem os dados pessoais completados; quem é novo entra com o modelo
            Eventual e a matrícula como senha inicial.
          </p>
          {importar.error && <Alerta tom="erro">{importar.error.message}</Alerta>}
          {resultado && (
            <>
              <Alerta tom="sucesso">
                {`${plural(resultado.importadas, 'pessoa nova', 'pessoas novas')} e ${plural(resultado.atualizadas, 'atualizada', 'atualizadas')}.`}
              </Alerta>
              {resultado.problemas.length > 0 && (
                <ul className="pilha-2">
                  {resultado.problemas.map((p) => (
                    <li key={p.linha}>{`Linha ${p.linha}: ${p.mensagem}`}</li>
                  ))}
                </ul>
              )}
              <p className="pequeno texto-2">Depois de conferir, apague as linhas da aba IMPORTAR_PESSOAS: ela guarda CPF e dados bancários.</p>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
