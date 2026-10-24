import { somarDias, type DataISO } from '@shared';

/**
 * "Hoje" do protótipo. Os dados de exemplo foram montados em torno de 24/10/2026,
 * então o app usa essa data para que telas e dados combinem. Na fase 1 passa a ser a data real.
 */
let hojeAtual: DataISO = '2026-10-24';

export function definirHoje(d: DataISO) {
  hojeAtual = d;
}

export function hoje(): DataISO {
  return hojeAtual;
}

/** Data e hora atual no formato 'AAAA-MM-DDTHH:MM' (data do protótipo + hora real). */
export function agora(): string {
  return `${hojeAtual}T${new Date().toTimeString().slice(0, 5)}`;
}

/** Janela padrão de consulta: de N dias atrás até M dias à frente. */
export function janela(antes = 120, depois = 120): { de: DataISO; ate: DataISO } {
  return { de: somarDias(hojeAtual, -antes), ate: somarDias(hojeAtual, depois) };
}
