import { ROTULO_PRIORIDADE, ROTULO_STATUS_OCORRENCIA, type PrioridadeOcorrencia, type StatusOcorrencia } from '@shared';
import { Etiqueta, type TomEtiqueta } from '../../componentes';

export const INVALIDAR_INFRA = ['infra.listar', 'notificacoes.listar', 'historico.listar'] as const;

const TOM_STATUS: Record<StatusOcorrencia, TomEtiqueta> = {
  nova: 'destaque',
  analise: 'info',
  chamado: 'aviso',
  atendimento: 'info',
  resolvida: 'sucesso',
  naoProcede: 'neutro',
};
const TOM_PRIORIDADE: Record<PrioridadeOcorrencia, TomEtiqueta> = { baixa: 'neutro', media: 'info', alta: 'aviso', urgente: 'erro' };

export function EtiquetaStatus({ status }: { status: StatusOcorrencia }) {
  return <Etiqueta tom={TOM_STATUS[status]}>{ROTULO_STATUS_OCORRENCIA[status]}</Etiqueta>;
}

export function EtiquetaPrioridade({ prioridade }: { prioridade: PrioridadeOcorrencia }) {
  return <Etiqueta tom={TOM_PRIORIDADE[prioridade]}>{ROTULO_PRIORIDADE[prioridade]}</Etiqueta>;
}

/** Reduz a foto para no máximo 1024 px (JPEG) antes de enviar. */
export function reduzirFoto(arquivo: File, maximo = 1024): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onerror = () => rejeitar(new Error('Não consegui ler a foto.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => rejeitar(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        const escala = Math.min(1, maximo / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * escala);
        c.height = Math.round(img.height * escala);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolver(c.toDataURL('image/jpeg', 0.72));
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  });
}
