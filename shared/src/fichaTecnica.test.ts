import { describe, expect, it } from 'vitest';
import { errosDaFicha, fichaTravada, fichaVazia, itensDaAgenda, limparFicha, prazoDaFicha, type FichaTecnicaDados } from './fichaTecnica';

const SESSOES = [{ id: 's1', data: '2026-11-18' }];

function completa(): FichaTecnicaDados {
  return {
    ...fichaVazia(SESSOES),
    tipo: 'Dança',
    sinopse: 'Espetáculo de dança.',
    publico: 800,
    elenco: 350,
    montagem: '2026-11-18T08:30',
    desmontagem: '2026-11-18T22:30',
    sessoes: [{ sessaoId: 's1', portas: '19:00', inicio: '19:30', fim: '22:00', intervalo: true, intervaloInicio: '20:40', intervaloFim: '20:45' }],
    responsavel: { vinculo: 'Contratante', vinculoOutro: '', nome: 'Produtora Teste', documento: '00.000.000/0001-00', siapeMatricula: '', email: 'produtora@exemplo.com', telefone: '55 99999-0000' },
    descricaoMontagem: 'Painel de fotos no foyer.',
    locais: ['Palco', 'Foyer Principal'],
    sessaoFotos: true,
    leituraIngressos: false,
    ingressoSolidario: false,
    camarinsIndividuais: ['Turma A', 'Turma B'],
    camarinsColetivos: ['Elenco'],
    reservarPoltronas: true,
    grupos: [{ nome: 'Elenco', lugares: ['mezanino:A23', 'mezanino:A25'] }],
    coffeeBreak: true,
    coffeeLocal: 'Corredor entre os Camarins',
    coffeeCardapio: 'Água e bolachas.',
    aceiteRegulamento: true,
  };
}

const campos = (d: FichaTecnicaDados) => errosDaFicha(d, SESSOES).map((e) => e.campo);

describe('ficha técnica: validação', () => {
  it('ficha completa não tem erros', () => {
    expect(errosDaFicha(completa(), SESSOES)).toEqual([]);
  });

  it('ficha vazia aponta os obrigatórios de cada etapa', () => {
    const erros = errosDaFicha(fichaVazia(SESSOES), SESSOES);
    expect(new Set(erros.map((e) => e.etapa))).toEqual(new Set(['evento', 'horarios', 'responsavel', 'espacos', 'poltronas', 'coffee', 'revisao']));
    expect(erros.find((e) => e.campo === 'tipo')).toEqual({ etapa: 'evento', campo: 'tipo', mensagem: 'Escolha o tipo do evento.' });
  });

  it('"Outro" pede a descrição', () => {
    expect(campos({ ...completa(), tipo: 'Outro' })).toEqual(['tipoOutro']);
    expect(campos({ ...completa(), responsavel: { ...completa().responsavel, vinculo: 'Outro' } })).toEqual(['responsavel.vinculoOutro']);
  });

  it('público acima da capacidade é erro', () => {
    expect(errosDaFicha({ ...completa(), publico: 1200 }, SESSOES)).toContainEqual({ etapa: 'evento', campo: 'publico', mensagem: 'A capacidade do teatro é de 1.170 pessoas.' });
  });

  it('montagem antes das 8h30 ou depois da abertura das portas é erro', () => {
    expect(campos({ ...completa(), montagem: '2026-11-18T07:00' })).toEqual(['montagem']);
    expect(campos({ ...completa(), montagem: '2026-11-18T19:30' })).toEqual(['montagem']);
  });

  it('horários da sessão precisam estar em ordem', () => {
    const s = completa().sessoes[0];
    const com = (x: Partial<typeof s>) => campos({ ...completa(), sessoes: [{ ...s, ...x }] });
    expect(com({ portas: '19:40' })).toEqual(['sessoes.0.portas']);
    expect(com({ fim: '19:00' })).toEqual(['sessoes.0.fim']);
    expect(com({ intervaloInicio: '22:30' })).toEqual(['sessoes.0.intervaloInicio']);
    expect(com({ intervaloFim: '20:30' })).toEqual(['sessoes.0.intervaloFim']);
    expect(com({ intervalo: false, intervaloInicio: '', intervaloFim: '' })).toEqual([]);
  });

  it('término de madrugada (antes das 6h) conta como o dia seguinte', () => {
    const s = completa().sessoes[0];
    const madrugada = { ...completa(), sessoes: [{ ...s, fim: '00:30', intervaloInicio: '23:40', intervaloFim: '23:50' }], desmontagem: '2026-11-19T01:30' };
    expect(campos(madrugada)).toEqual([]);
    expect(campos({ ...madrugada, desmontagem: '2026-11-18T23:00' })).toEqual(['desmontagem']);
    expect(campos({ ...madrugada, sessoes: [{ ...s, fim: '19:30' }] })).toContain('sessoes.0.fim');
  });

  it('desmontagem antes do fim da última sessão é erro', () => {
    expect(campos({ ...completa(), desmontagem: '2026-11-18T21:00' })).toEqual(['desmontagem']);
  });

  it('servidor da UFSM informa SIAPE ou matrícula', () => {
    expect(campos({ ...completa(), responsavel: { ...completa().responsavel, vinculo: 'Servidor da UFSM' } })).toEqual(['responsavel.siapeMatricula']);
  });

  it('ingresso solidário pede o destino dos alimentos', () => {
    expect(campos({ ...completa(), ingressoSolidario: true })).toEqual(['destinoAlimentos']);
    expect(campos({ ...completa(), ingressoSolidario: true, destinoAlimentos: 'Outro' })).toEqual(['destinoOutro']);
  });

  it('cada camarim precisa de identificação', () => {
    expect(campos({ ...completa(), camarinsIndividuais: ['Turma A', ' '] })).toEqual(['camarinsIndividuais.1']);
  });

  it('reserva de poltronas precisa de pelo menos um lugar, e cada grupo de um nome', () => {
    expect(campos({ ...completa(), grupos: [] })).toEqual(['grupos']);
    expect(campos({ ...completa(), grupos: [{ nome: '', lugares: ['baixa:A01'] }] })).toEqual(['grupos.0.nome']);
  });

  it('coffee break pede local e o que será servido', () => {
    expect(campos({ ...completa(), coffeeLocal: '', coffeeCardapio: '' })).toEqual(['coffeeLocal', 'coffeeCardapio']);
  });

  it('sem aceite do regulamento não envia', () => {
    expect(campos({ ...completa(), aceiteRegulamento: false })).toEqual(['aceiteRegulamento']);
  });
});

describe('ficha técnica: limpeza do que vem de fora', () => {
  it('corta textos, descarta lugares inexistentes, repetidos entre grupos e sessões que não são do evento', () => {
    const suja = {
      ...completa(),
      sinopse: 'x'.repeat(9000),
      sessoes: [...completa().sessoes, { ...completa().sessoes[0], sessaoId: 'outra' }],
      grupos: [
        { nome: 'A', lugares: ['baixa:A01', 'baixa:Z99', 'baixa:A01'] },
        { nome: 'B', lugares: ['baixa:A01', 'baixa:A03'] },
      ],
      camarinsIndividuais: ['1', '2', '3', '4', '5'],
      locais: ['Palco', 'Telhado'],
      extra: 'ignorado',
    } as unknown;
    const d = limparFicha(suja, SESSOES);
    expect(d.sinopse).toHaveLength(5000);
    expect(d.sessoes.map((s) => s.sessaoId)).toEqual(['s1']);
    expect(d.grupos.map((g) => g.lugares)).toEqual([['baixa:A01'], ['baixa:A03']]);
    expect(d.camarinsIndividuais).toHaveLength(4);
    expect(d.locais).toEqual(['Palco']);
    expect(d).not.toHaveProperty('extra');
  });

  it('lixo vira ficha vazia com uma linha de horário por sessão', () => {
    expect(limparFicha(null, SESSOES)).toEqual(fichaVazia(SESSOES));
  });
});

describe('ficha técnica: prazo', () => {
  it('trava sozinha 2 dias antes da primeira sessão', () => {
    expect(prazoDaFicha(['2026-11-20', '2026-11-18'])).toBe('2026-11-16');
    expect(fichaTravada({ trava: 'auto', prazo: '2026-11-16', hoje: '2026-11-16' })).toBe(false);
    expect(fichaTravada({ trava: 'auto', prazo: '2026-11-16', hoje: '2026-11-17' })).toBe(true);
  });

  it('o gestor pode travar ou destravar à mão', () => {
    expect(fichaTravada({ trava: 'travada', prazo: '2026-11-16', hoje: '2026-10-01' })).toBe(true);
    expect(fichaTravada({ trava: 'destravada', prazo: '2026-11-16', hoje: '2026-11-17' })).toBe(false);
  });
});

describe('ficha técnica: montagem e passagem de som', () => {
  it('fim da montagem e passagem de som são opcionais, mas precisam fazer sentido', () => {
    expect(campos({ ...completa(), montagemFim: '2026-11-18T08:00' })).toEqual(['montagemFim']);
    expect(campos({ ...completa(), montagemFim: '2026-11-18T16:00' })).toEqual([]);
    expect(campos({ ...completa(), passagemSom: true })).toEqual(['passagemInicio', 'passagemFim']);
    expect(campos({ ...completa(), passagemSom: true, passagemInicio: '2026-11-18T17:00', passagemFim: '2026-11-18T16:00' })).toEqual(['passagemFim']);
    expect(campos({ ...completa(), passagemSom: true, passagemInicio: '2026-11-18T07:00', passagemFim: '2026-11-18T08:00' })).toEqual(['passagemInicio']);
    expect(campos({ ...completa(), passagemSom: true, passagemInicio: '2026-11-18T16:00', passagemFim: '2026-11-18T17:30' })).toEqual([]);
  });

  it('itens para a agenda do CC: montagem, passagem de som e desmontagem', () => {
    const d = { ...completa(), montagemFim: '2026-11-18T16:00', passagemSom: true, passagemInicio: '2026-11-18T16:00', passagemFim: '2026-11-18T17:30' };
    expect(itensDaAgenda(d, SESSOES)).toEqual([
      { chave: 'montagem', titulo: 'Montagem', inicio: '2026-11-18T08:30', fim: '2026-11-18T16:00' },
      { chave: 'passagem', titulo: 'Passagem de som', inicio: '2026-11-18T16:00', fim: '2026-11-18T17:30' },
      { chave: 'desmontagem', titulo: 'Desmontagem', inicio: '2026-11-18T22:00', fim: '2026-11-18T22:30' },
    ]);
    // sem fim da montagem: vai até 1 hora antes da abertura das portas da primeira sessão
    expect(itensDaAgenda({ ...completa(), passagemSom: false }, SESSOES)[0]).toEqual({ chave: 'montagem', titulo: 'Montagem', inicio: '2026-11-18T08:30', fim: '2026-11-18T18:00' });
    expect(itensDaAgenda(fichaVazia(SESSOES), SESSOES)).toEqual([]);
  });
});
