import { EMAIL_JUNTO, ErroApi, LIMITE_ASSUNTO, LIMITE_DESTINATARIOS, LIMITE_MENSAGEM, MODULO_DO_EMAIL, pode, separarEmails } from '@shared';
import { registrar, type Contexto, type Handlers } from '../nucleo/roteador';

/** Endereços das pessoas escolhidas (só as ativas com e-mail cadastrado), na ordem pedida. */
function emailsDasPessoas(ctx: Contexto, ids: string[]): string[] {
  const pessoas = ctx.portas.repo.listar<{ id: string; emailAcademico: string; ativo: boolean }>('pessoas');
  return ids.map((id) => pessoas.find((p) => p.id === id && p.ativo)?.emailAcademico ?? '').filter(Boolean);
}

/** PDFs assinados dos contratos escolhidos, já guardados no Drive do sistema (nunca um arquivo qualquer do Drive). */
function contratosAssinados(ctx: Contexto, ids: string[]): string[] {
  const contratos = ctx.portas.repo.listar<{ id: string; pdfAssinadoId?: string }>('contratos');
  return ids.map((id) => contratos.find((c) => c.id === id)?.pdfAssinadoId ?? '').filter(Boolean);
}

/**
 * O único lugar do sistema que manda e-mail, e só quando alguém clica em "Enviar e-mail" depois de ver
 * destinatários, assunto e texto. Nenhum gatilho nem outra ação chega aqui.
 */
export const handlersEmails: Handlers = {
  'emails.cota': (_d, ctx) => ({ restante: ctx.portas.email.cotaRestante() }),

  'emails.enviar': ({ tipo, para, pessoaIds, assunto, mensagem, html, contratoIds }, ctx) => {
    const modulo = MODULO_DO_EMAIL[tipo];
    if (!modulo) throw new ErroApi('VALIDACAO', 'Tipo de e-mail desconhecido.');
    if (!pode(ctx.eu!.permissoes, modulo, 'editar')) throw new ErroApi('SEM_PERMISSAO', 'Você não tem permissão para mandar este e-mail.');

    const { validos, invalidos } = separarEmails([...(para ?? []), ...emailsDasPessoas(ctx, pessoaIds ?? [])].join(' '));
    if (invalidos.length) throw new ErroApi('VALIDACAO', `E-mail inválido: ${invalidos.join(', ')}.`);
    if (!validos.length) throw new ErroApi('VALIDACAO', 'Informe para quem vai o e-mail.');
    if (validos.length > LIMITE_DESTINATARIOS) throw new ErroApi('VALIDACAO', `Mande para no máximo ${LIMITE_DESTINATARIOS} pessoas de cada vez.`);
    const titulo = String(assunto ?? '').replace(/\s+/g, ' ').trim();
    const texto = String(mensagem ?? '').trim();
    if (!titulo || titulo.length > LIMITE_ASSUNTO) throw new ErroApi('VALIDACAO', `Escreva um assunto de até ${LIMITE_ASSUNTO} caracteres.`);
    if (!texto || texto.length > LIMITE_MENSAGEM) throw new ErroApi('VALIDACAO', `Escreva uma mensagem de até ${LIMITE_MENSAGEM} caracteres.`);

    const restante = ctx.portas.email.cotaRestante();
    if (validos.length > restante) {
      throw new ErroApi(
        'LIMITE',
        restante > 0
          ? `Hoje o Google ainda deixa mandar ${restante} e-mail(s). Tire alguns destinatários ou mande amanhã.`
          : 'Os e-mails de hoje acabaram (limite do Google). Mande amanhã.',
      );
    }

    // só o pedido à FUNDEP vai formatado e com anexos; os demais são texto simples
    const fundep = tipo === 'fundep';
    const comum = { assunto: titulo, texto, ...(fundep && html ? { html } : {}), anexos: fundep ? contratosAssinados(ctx, contratoIds ?? []) : [] };
    if (EMAIL_JUNTO[tipo]) ctx.portas.email.enviar({ para: validos, ...comum });
    else for (const destino of validos) ctx.portas.email.enviar({ para: [destino], ...comum });

    registrar(ctx, 'email', tipo, `mandou o e-mail "${titulo}" para ${validos.length} ${validos.length === 1 ? 'pessoa' : 'pessoas'}`, null, null);
    return { enviados: validos.length, restante: restante - validos.length };
  },
};
