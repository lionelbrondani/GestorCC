/** Contato do setor para quem quer saber o que é feito com os seus dados. */
export const EMAIL_PRIVACIDADE = 'centrodeconvencoes@ufsm.br';

/** Quantos dias depois do evento os dados pessoais são apagados, se a configuração ainda não disser. */
export const DIAS_GUARDAR_CORTESIAS = 90;
export const DIAS_GUARDAR_FICHA = 180;

/** Aviso das páginas públicas (ficha técnica e cortesias): para que servem os dados e quando são apagados (0 = nunca). */
export function textoPrivacidade(pagina: 'ficha' | 'cortesias', diasGuardar: number): string {
  const para =
    pagina === 'ficha'
      ? 'Os dados do responsável (CPF ou CNPJ, matrícula, e-mail e telefone) servem só para organizar este evento no Centro de Convenções da UFSM e ficam com acesso restrito.'
      : 'Os nomes e as matrículas servem só para a retirada das cortesias deste evento e ficam com acesso restrito.';
  const prazo = diasGuardar > 0 ? ` Eles são apagados ${diasGuardar} dias depois do evento.` : '';
  return `${para}${prazo} Dúvidas sobre os seus dados: ${EMAIL_PRIVACIDADE}.`;
}
