import { fichaVazia, type FichaPublica, type FichaResumo, type FichaTecnica, type FichaTecnicaDados } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersFichas } from '../src/acoes/fichas';
import { agendaMemoria } from '../src/adaptadores/memoria';
import { criarAmbiente } from './apoio';
import { linhaEvento, linhaSessao } from './fabricasApi';

type Ok<T> = { ok: true; dados: T };
type Falha = { ok: false; erro: { codigo: string; mensagem: string } };

function completa(): FichaTecnicaDados {
  return {
    ...fichaVazia([{ id: 's1', data: '2026-11-18' }]),
    tipo: 'Dança', publico: 800, elenco: 350, montagem: '2026-11-18T08:30', desmontagem: '2026-11-18T22:30',
    sessoes: [{ sessaoId: 's1', portas: '19:00', inicio: '19:30', fim: '22:00', intervalo: false, intervaloInicio: '', intervaloFim: '' }],
    responsavel: { vinculo: 'Contratante', vinculoOutro: '', nome: 'Produtora Teste', documento: '00.000.000/0001-00', siapeMatricula: '', email: 'produtora@exemplo.com', telefone: '55 99999-0000' },
    descricaoMontagem: 'Painel no foyer.', locais: ['Palco'], sessaoFotos: false, leituraIngressos: false, ingressoSolidario: false,
    reservarPoltronas: true, grupos: [{ nome: 'Elenco', lugares: ['mezanino:A23'] }], coffeeBreak: false, aceiteRegulamento: true,
  };
}

function ambiente() {
  const amb = criarAmbiente({ handlers: handlersFichas });
  amb.relogio.definir('2026-11-01T10:00');
  amb.repo.inserir('eventos', linhaEvento('e1', 'Show Teste'));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's2', eventoId: 'e1', data: '2026-11-19' }));
  amb.repo.inserir('sessoes', linhaSessao({ id: 's1', eventoId: 'e1', data: '2026-11-18' }));
  amb.repo.inserir('sessoes', linhaSessao({ id: 'sx', eventoId: 'e1', data: '2026-11-20', status: 'cancelada' }));
  const gestor = amb.token('p01');
  const link = (novo = false) => (amb.chamar('fichas.link', { eventoId: 'e1', novo }, { token: gestor }) as Ok<FichaTecnica>).dados;
  const abrir = (token: string) => amb.chamar('ficha.abrir', { token });
  const salvar = (token: string, dados: FichaTecnicaDados, enviar = false) => amb.chamar('ficha.salvar', { token, dados, enviar });
  const obter = () => (amb.chamar('fichas.obter', { eventoId: 'e1' }, { token: gestor }) as Ok<FichaTecnica | null>).dados;
  return { ...amb, gestor, link, abrir, salvar, obter };
}

const doisDias = (d: FichaTecnicaDados): FichaTecnicaDados => ({
  ...d,
  sessoes: [d.sessoes[0], { ...d.sessoes[0], sessaoId: 's2' }],
  desmontagem: '2026-11-19T23:00',
});

describe('ficha técnica: link do produtor', () => {
  it('o gestor gera o link; pedir de novo devolve o mesmo, e um link novo invalida o antigo', () => {
    const amb = ambiente();
    expect(amb.obter()).toBeNull();
    const f = amb.link();
    expect(f).toMatchObject({ eventoId: 'e1', status: 'rascunho', trava: 'auto', travada: false, prazo: '2026-11-16' });
    expect(f.token).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    expect(amb.link().token).toBe(f.token);
    const novo = amb.link(true).token;
    expect(novo).not.toBe(f.token);
    expect(amb.abrir(f.token)).toMatchObject({ ok: false, erro: { codigo: 'LINK', mensagem: 'Este link não vale mais. Peça um novo ao Centro de Convenções.' } });
    expect(amb.abrir(novo).ok).toBe(true);
  });

  it('sem login, o link abre só o evento dele, com uma linha de horário por sessão ativa', () => {
    const amb = ambiente();
    const r = amb.abrir(amb.link().token) as Ok<FichaPublica>;
    expect(r.dados.evento.nome).toBe('Show Teste');
    expect(r.dados.evento.sessoes.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(r.dados.dados.sessoes.map((s) => s.sessaoId)).toEqual(['s1', 's2']);
    expect(r.dados).toMatchObject({ status: 'rascunho', travada: false, prazo: '2026-11-16', linkFolder: '' });
  });

  it('link inexistente ou vazio não abre nada', () => {
    const amb = ambiente();
    amb.link();
    expect(amb.abrir('x'.repeat(43))).toMatchObject({ ok: false, erro: { codigo: 'LINK' } });
    expect(amb.abrir('')).toMatchObject({ ok: false, erro: { codigo: 'LINK' } });
  });

  it('evento cancelado fecha a ficha', () => {
    const amb = ambiente();
    const token = amb.link().token;
    const [e] = amb.repo.listar<{ id: string; status: string }>('eventos');
    amb.repo.atualizar('eventos', { ...e, status: 'cancelado' });
    expect(amb.abrir(token)).toMatchObject({ ok: false, erro: { codigo: 'LINK', mensagem: 'Este evento foi cancelado.' } });
  });
});

describe('ficha técnica: preenchimento', () => {
  it('salva o rascunho; CPF/CNPJ, e-mail e telefone ficam na planilha Sigiloso', () => {
    const amb = ambiente();
    const token = amb.link().token;
    const r = amb.salvar(token, doisDias(completa())) as Ok<FichaPublica>;
    expect(r.dados.status).toBe('rascunho');
    expect(r.dados.dados.responsavel.documento).toBe('00.000.000/0001-00');
    const linha = amb.repo.listar<{ id: string; dados: FichaTecnicaDados }>('fichas')[0];
    expect(linha.dados.responsavel).toMatchObject({ nome: 'Produtora Teste', documento: '', email: '', telefone: '' });
    expect(amb.repo.listar('fichasSigilo')[0]).toMatchObject({ id: 'e1', documento: '00.000.000/0001-00', email: 'produtora@exemplo.com', telefone: '55 99999-0000' });
    expect(amb.obter()!.dados.responsavel.email).toBe('produtora@exemplo.com');
  });

  it('enviar confere tudo: incompleta é recusada, completa vira enviada', () => {
    const amb = ambiente();
    const token = amb.link().token;
    const r = amb.salvar(token, { ...doisDias(completa()), aceiteRegulamento: false, publico: null }, true) as Falha;
    expect(r.erro).toEqual({ codigo: 'FICHA_INCOMPLETA', mensagem: 'Faltam 2 itens: Informe a estimativa de público. É preciso declarar a leitura do regulamento.' });
    const ok = amb.salvar(token, doisDias(completa()), true) as Ok<FichaPublica>;
    expect(ok.dados).toMatchObject({ status: 'enviada', enviadaEm: '2026-11-01T10:00' });
    expect(amb.obter()!.status).toBe('enviada');
  });

  it('o produtor não consegue enfiar anexos que não enviou', () => {
    const amb = ambiente();
    const token = amb.link().token;
    const r = amb.salvar(token, { ...completa(), anexos: [{ id: 'arquivo-de-outra-pessoa', nome: 'x' }] }) as Ok<FichaPublica>;
    expect(r.dados.dados.anexos).toEqual([]);
  });

  it('anexa arquivos (até 5) e o gestor baixa', () => {
    const amb = ambiente();
    const token = amb.link().token;
    const pdf = 'data:application/pdf;base64,JVBERi0=';
    const a = amb.chamar('ficha.anexar', { token, nome: 'projeto.pdf', arquivo: pdf }) as Ok<{ id: string; nome: string }>;
    expect(a.dados.nome).toBe('projeto.pdf');
    expect((amb.abrir(token) as Ok<FichaPublica>).dados.dados.anexos).toEqual([a.dados]);
    expect(amb.chamar('fichas.anexo', { eventoId: 'e1', anexoId: a.dados.id }, { token: amb.gestor })).toEqual({ ok: true, dados: pdf });
    for (let i = 0; i < 4; i++) amb.chamar('ficha.anexar', { token, nome: `f${i}.pdf`, arquivo: pdf });
    expect(amb.chamar('ficha.anexar', { token, nome: 'demais.pdf', arquivo: pdf })).toMatchObject({ ok: false, erro: { codigo: 'ARQUIVO', mensagem: 'Limite de 5 arquivos por ficha.' } });
    expect(amb.chamar('ficha.anexar', { token, nome: 'x.exe', arquivo: 'texto' })).toMatchObject({ ok: false, erro: { codigo: 'ARQUIVO' } });
  });

  it('depois do prazo o produtor não muda mais; o gestor pode destravar ou corrigir', () => {
    const amb = ambiente();
    const token = amb.link().token;
    amb.relogio.definir('2026-11-17T08:00');
    const gestor = amb.token('p01'); // o login do teste vale 7 dias
    expect((amb.abrir(token) as Ok<FichaPublica>).dados.travada).toBe(true);
    expect(amb.salvar(token, completa())).toMatchObject({ ok: false, erro: { codigo: 'TRAVADA', mensagem: 'O prazo da ficha terminou (16/11/2026). Fale com o Centro de Convenções para alterar.' } });
    const corrigida = amb.chamar('fichas.salvar', { eventoId: 'e1', dados: { ...completa(), elenco: 12 } }, { token: gestor }) as Ok<FichaTecnica>;
    expect(corrigida.dados.dados.elenco).toBe(12);
    amb.chamar('fichas.travar', { eventoId: 'e1', trava: 'destravada' }, { token: gestor });
    expect(amb.salvar(token, completa()).ok).toBe(true);
  });

  it('bolsista não vê a ficha (tem dados do responsável)', () => {
    const amb = ambiente();
    amb.link();
    expect(amb.chamar('fichas.obter', { eventoId: 'e1' }, { token: amb.token('p02') })).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
  });
});

describe('ficha técnica: lista do menu', () => {
  it('lista as fichas com o resumo, a situação e o link, na ordem das datas', () => {
    const amb = ambiente();
    amb.repo.inserir('eventos', linhaEvento('e2', 'Peça Antes'));
    amb.repo.inserir('sessoes', linhaSessao({ id: 's9', eventoId: 'e2', data: '2026-11-05' }));
    const t1 = amb.link().token;
    amb.chamar('fichas.link', { eventoId: 'e2', novo: false }, { token: amb.gestor });
    amb.salvar(t1, doisDias(completa()), true);
    const r = amb.chamar('fichas.listar', null, { token: amb.gestor }) as Ok<FichaResumo[]>;
    expect(r.dados.map((f) => f.evento)).toEqual(['Peça Antes', 'Show Teste']);
    expect(r.dados[1]).toMatchObject({
      eventoId: 'e1', datas: ['2026-11-18', '2026-11-19'], status: 'enviada', travada: false, prazo: '2026-11-16', token: t1,
      responsavel: 'Produtora Teste', tipo: 'Dança', publico: 800, elenco: 350, poltronas: 1, camarins: 0, coffeeBreak: false, eventoCancelado: false,
    });
    expect(r.dados[0]).toMatchObject({ status: 'rascunho', responsavel: '', poltronas: 0 });
    expect(JSON.stringify(r.dados)).not.toContain('00.000.000/0001-00');
  });

  it('bolsista não lista fichas', () => {
    const amb = ambiente();
    expect(amb.chamar('fichas.listar', null, { token: amb.token('p02') })).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
  });
});

describe('ficha técnica: lançar na agenda do CC', () => {
  function comAgenda() {
    const agenda = agendaMemoria();
    const amb = criarAmbiente({ handlers: handlersFichas, agenda });
    amb.relogio.definir('2026-11-01T10:00');
    amb.repo.inserir('eventos', linhaEvento('e1', 'Show Teste'));
    amb.repo.inserir('sessoes', linhaSessao({ id: 's1', eventoId: 'e1', data: '2026-11-18', inicio: '19:30', fim: '22:00' }));
    const gestor = amb.token('p01');
    const token = (amb.chamar('fichas.link', { eventoId: 'e1', novo: false }, { token: gestor }) as Ok<FichaTecnica>).dados.token;
    const lancar = () => amb.chamar('fichas.lancarAgenda', { eventoId: 'e1' }, { token: gestor });
    const salvar = (t: string, dados: FichaTecnicaDados) => amb.chamar('ficha.salvar', { token: t, dados, enviar: false });
    return { ...amb, agenda, gestor, token, lancar, salvar };
  }
  const comPassagem = (): FichaTecnicaDados => ({ ...completa(), passagemSom: true, passagemInicio: '2026-11-18T16:00', passagemFim: '2026-11-18T17:30' });

  it('cria as atividades de apoio no evento (sem diária, fora da rodada) e elas vão para a agenda', () => {
    const amb = comAgenda();
    amb.salvar(amb.token, comPassagem());
    amb.lancar();
    const apoio = amb.repo.listar<{ id: string; atividade: string; data: string; inicio: string; fim: string; vagasBolsistas: number }>('sessoes').filter((x) => x.atividade && x.atividade !== 'evento');
    expect(apoio.map((x) => [x.atividade, x.data, x.inicio, x.fim, x.vagasBolsistas])).toEqual([
      ['montagem', '2026-11-18', '08:30', '18:00', 1],
      ['passagemSom', '2026-11-18', '16:00', '17:30', 1],
      ['desmontagem', '2026-11-18', '22:00', '22:30', 1],
    ]);
  });

  it('cria montagem, passagem de som e desmontagem na agenda, sem convidados', () => {
    const amb = comAgenda();
    amb.salvar(amb.token, comPassagem());
    const r = amb.lancar() as Ok<FichaTecnica>;
    expect(r.dados.agenda).toEqual({ lancadoEm: '2026-11-01T10:00', itens: ['montagem', 'passagem', 'desmontagem'] });
    const eventos = [...amb.agenda.eventos.values()];
    expect(eventos.map((e) => e.titulo)).toEqual(['Montagem · Show Teste', 'Passagem de som · Show Teste', 'Desmontagem · Show Teste']);
    expect(eventos[1].quando).toEqual({ diaInteiro: false, inicio: '2026-11-18T16:00', fim: '2026-11-18T17:30' });
    expect(eventos.every((e) => e.convidados.length === 0)).toBe(true);
  });

  it('lançar de novo atualiza os mesmos eventos e tira o que saiu da ficha', () => {
    const amb = comAgenda();
    amb.salvar(amb.token, comPassagem());
    amb.lancar();
    amb.salvar(amb.token, { ...comPassagem(), passagemSom: false, montagem: '2026-11-18T10:00' });
    const r = amb.lancar() as Ok<FichaTecnica>;
    expect(r.dados.agenda?.itens).toEqual(['montagem', 'desmontagem']);
    expect([...amb.agenda.eventos.values()].map((e) => [e.titulo, e.quando.diaInteiro ? '' : e.quando.inicio])).toEqual([
      ['Montagem · Show Teste', '2026-11-18T10:00'],
      ['Desmontagem · Show Teste', '2026-11-18T22:00'],
    ]);
  });

  it('sem montagem nem desmontagem na ficha, avisa', () => {
    const amb = comAgenda();
    expect(amb.lancar()).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO', mensagem: 'Preencha a montagem ou a desmontagem na ficha antes de lançar na agenda.' } });
  });
});
