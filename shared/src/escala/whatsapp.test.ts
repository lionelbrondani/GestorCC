import { describe, expect, it } from 'vitest';
import { evento, sessao } from '../teste/fabricas';
import { linkWhatsapp, textoConvocacao, textoLembreteRodada, textoWhatsappIndividual, textoWhatsappSessao } from './whatsapp';

const ev = evento({ nome: 'CORAÇÃO DE POTRO' });

describe('textos de WhatsApp', () => {
  it('sessão completa', () => {
    const t = textoWhatsappSessao(ev, sessao({ data: '2026-10-02', chegada: '18:30' }), ['SERVIDORA A'], ['ANA', 'BIA']);
    expect(t).toBe(
      'Olá pessoal, segue a escala do dia 02/10/2026 (sexta-feira) - CORAÇÃO DE POTRO\n\n' +
        'Servidor(es) responsável(is):\n- SERVIDORA A\n\n' +
        'Bolsistas escalados:\n- ANA\n- BIA\n\n' +
        'Vocês deverão comparecer ao Centro de Convenções às 18:30.',
    );
  });

  it('sem bolsistas e sem horário', () => {
    const t = textoWhatsappSessao(ev, sessao({ chegada: null, inicio: null, fim: null, horarioADefinir: true }), [], []);
    expect(t).toContain('- (Nenhum bolsista escalado)');
    expect(t).toContain('horário a definir');
    expect(t).not.toContain('Servidor(es)');
  });

  it('inclui o rótulo da sessão', () => {
    expect(textoWhatsappSessao(ev, sessao({ rotulo: 'Manhã' }), [], ['ANA'])).toContain('CORAÇÃO DE POTRO – Manhã');
  });

  it('individual', () => {
    const t = textoWhatsappIndividual('ANA', [{ evento: ev, sessao: sessao({ data: '2026-10-02', chegada: '18:30' }) }]);
    expect(t).toContain('Olá *ANA*, segue a sua escala de eventos:');
    expect(t).toContain('📌 *CORAÇÃO DE POTRO*\n🗓️ Data: 02/10/2026 (sexta-feira)\n⏰ Chegada CC: 18:30');
    expect(t).toContain('Por favor, confirme o recebimento desta mensagem! ✅');
  });

  it('convocação', () => {
    const t = textoConvocacao(ev, sessao({ data: '2026-10-02', chegada: '18:30' }), 3, '2026-10-01T18:00');
    expect(t).toBe(
      'Precisamos de mais 3 bolsista(s) para *CORAÇÃO DE POTRO* em 02/10/2026 (sexta-feira), chegada às 18:30. ' +
        'Quem puder, marque disponibilidade no GestorCC até 01/10/2026 às 18:00.',
    );
  });

  it('lembrete de rodada', () => {
    const t = textoLembreteRodada({ id: 'r', nome: 'Dezembro/2026', prazo: '2026-11-25T23:59', status: 'aberta', sessaoIds: [] }, ['ANA', 'BIA']);
    expect(t).toBe('Lembrete: a disponibilidade de *Dezembro/2026* fecha em 25/11/2026 às 23:59. Ainda faltam responder: ANA, BIA.');
  });

  it('link', () => expect(linkWhatsapp('a b')).toBe('https://wa.me/?text=a%20b'));
});
