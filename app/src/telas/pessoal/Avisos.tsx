import { formatarData, type Aviso } from '@shared';
import { Pin } from 'lucide-react';
import { useConsulta, useMutacao } from '../../api/hooks';
import { useEu } from '../../auth/SessaoContexto';
import { Botao, Carregando, Cartao, EstadoVazio, Etiqueta, Pagina } from '../../componentes';

export function CartaoAviso({ aviso, compacto }: { aviso: Aviso; compacto?: boolean }) {
  const eu = useEu();
  const confirmar = useMutacao('avisos.confirmarLeitura', ['avisos.listar']);
  const lido = aviso.leituras.includes(eu.id);
  return (
    <Cartao destaque={aviso.fixado}>
      <div className="pilha-2">
        <div className="linha-entre">
          <h3 className="linha">
            {aviso.fixado && <Pin size={16} aria-label="Fixado" />}
            {aviso.titulo}
          </h3>
          <span className="pequeno texto-3">{formatarData(aviso.criadoEm.slice(0, 10))}</span>
        </div>
        <p style={{ whiteSpace: 'pre-line' }} className={compacto ? 'pequeno' : undefined}>
          {aviso.texto}
        </p>
        {aviso.pedeConfirmacao &&
          (lido ? (
            <Etiqueta tom="sucesso">Leitura confirmada</Etiqueta>
          ) : (
            <div>
              <Botao variante="primario" tamanho="pequeno" carregando={confirmar.isPending} onClick={() => confirmar.mutate({ avisoId: aviso.id })}>
                Confirmar leitura
              </Botao>
            </div>
          ))}
      </div>
    </Cartao>
  );
}

export function Avisos() {
  const q = useConsulta('avisos.listar', null);
  if (q.isLoading) return <Carregando />;
  const avisos = q.data ?? [];
  return (
    <Pagina titulo="Avisos" subtitulo="Comunicados da equipe do Centro de Convenções.">
      {avisos.length === 0 ? (
        <EstadoVazio titulo="Nenhum aviso por enquanto" />
      ) : (
        <div className="pilha">
          {avisos.map((a) => (
            <CartaoAviso key={a.id} aviso={a} />
          ))}
        </div>
      )}
    </Pagina>
  );
}
