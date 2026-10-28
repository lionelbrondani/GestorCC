import type { Acao, Achado, Entrada } from '@shared';
import { describe, expect, it } from 'vitest';
import { handlersAchados } from '../src/acoes/achados';
import { handlersSistema } from '../src/acoes/sistema';
import { arquivosMemoria } from '../src/adaptadores/memoria';
import { concederModulosNovos } from '../src/instalar';
import { limparDadosPessoais } from '../src/lgpd';
import type { Arquivos } from '../src/nucleo/portas';
import { criarAmbiente } from './apoio';

type Linha = { id: string; [k: string]: unknown };
const FOTO = 'data:image/jpeg;base64,AAAA';
const DADOS = { descricao: 'Guarda-chuva preto', achadoEm: '2026-10-20', local: 'Plateia', eventoId: null, guardadoEm: 'Armário da secretaria', observacoes: '' };

function ambiente() {
  const base = arquivosMemoria();
  const pastas: (string | undefined)[] = [];
  const arquivos: Arquivos = {
    ...base,
    salvarImagem: (dataUrl, nome, pasta) => {
      pastas.push(pasta);
      return base.salvarImagem(dataUrl, nome, pasta);
    },
  };
  const amb = criarAmbiente({ handlers: { ...handlersAchados, ...handlersSistema }, arquivos });
  const gestor = amb.token('p01');
  const resp = <A extends Acao>(acao: A, d: Entrada<A>, token = gestor) => amb.chamar(acao, d, { token });
  const dados = <T,>(acao: Acao, d: unknown, token = gestor): T => {
    const r = amb.chamar(acao, d as never, { token });
    if (!r.ok) throw new Error(`${r.erro.codigo}: ${r.erro.mensagem}`);
    return r.dados as T;
  };
  const linha = (tabela: 'achados' | 'achadosSigilo' | 'permissoes', id: string) => amb.repo.listar<Linha>(tabela).find((l) => l.id === id);
  return { ...amb, base, pastas, gestor, resp, dados, linha };
}

describe('achados e perdidos', () => {
  it('registra com número e com a foto no Drive, na pasta Achados e perdidos; a foto vem por achados.foto', () => {
    const amb = ambiente();
    const a = amb.dados<Achado>('achados.salvar', { dados: DADOS, foto: FOTO });
    expect(a).toMatchObject({ numero: 1, status: 'guardado', temFoto: true, registradoPorId: 'p01', saidaEm: null, descricao: 'Guarda-chuva preto', guardadoEm: 'Armário da secretaria' });
    expect(amb.pastas).toEqual(['Achados e perdidos']);
    expect(amb.dados<Achado[]>('achados.listar', null)).toEqual([a]);
    expect(amb.dados('achados.foto', { id: a.id })).toBe(FOTO);
    expect(amb.dados<Achado>('achados.salvar', { dados: { ...DADOS, descricao: 'Casaco cinza' } })).toMatchObject({ numero: 2, temFoto: false });
  });

  it('confere a descrição e a data em que foi achado', () => {
    const amb = ambiente();
    expect(amb.resp('achados.salvar', { dados: { ...DADOS, descricao: ' ' } })).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO', mensagem: 'Descreva o item (ex.: guarda-chuva preto).' } });
    expect(amb.resp('achados.salvar', { dados: { ...DADOS, achadoEm: '2026-10-25' } })).toMatchObject({ ok: false, erro: { codigo: 'VALIDACAO' } });
  });

  it('editar mantém a foto; uma foto nova apaga a antiga do Drive; null tira a foto', () => {
    const amb = ambiente();
    const a = amb.dados<Achado>('achados.salvar', { dados: DADOS, foto: FOTO });
    const antiga = amb.linha('achados', a.id)!.fotoId as string;
    expect(amb.dados<Achado>('achados.salvar', { id: a.id, dados: { ...DADOS, guardadoEm: 'Gaveta 2' } })).toMatchObject({ numero: 1, guardadoEm: 'Gaveta 2', temFoto: true });
    amb.dados('achados.salvar', { id: a.id, dados: DADOS, foto: 'data:image/jpeg;base64,BBBB' });
    expect(amb.base.lerImagem(antiga)).toBeNull();
    expect(amb.dados('achados.foto', { id: a.id })).toBe('data:image/jpeg;base64,BBBB');
    expect(amb.dados<Achado>('achados.salvar', { id: a.id, dados: DADOS, foto: null }).temFoto).toBe(false);
    expect(amb.base.arquivos.size).toBe(0);
  });

  it('devolver grava quem retirou só na planilha Sigiloso; voltar para os guardados desfaz; descartar guarda o destino', () => {
    const amb = ambiente();
    const a = amb.dados<Achado>('achados.salvar', { dados: DADOS });
    expect(amb.resp('achados.situacao', { id: a.id, status: 'devolvido', data: '2026-10-24', retiradoPor: '' })).toMatchObject({ ok: false, erro: { mensagem: 'Informe quem retirou o item.' } });
    expect(amb.dados<Achado>('achados.situacao', { id: a.id, status: 'devolvido', data: '2026-10-24', retiradoPor: 'Maria Exemplo', contatoRetirada: '(55) 90000-0000' })).toMatchObject({
      status: 'devolvido', saidaEm: '2026-10-24', retiradoPor: 'Maria Exemplo', contatoRetirada: '(55) 90000-0000',
    });
    expect(JSON.stringify(amb.linha('achados', a.id))).not.toContain('Maria');
    expect(amb.linha('achadosSigilo', a.id)).toMatchObject({ retiradoPor: 'Maria Exemplo', contatoRetirada: '(55) 90000-0000' });
    expect(amb.dados<Achado>('achados.situacao', { id: a.id, status: 'guardado', data: '' })).toMatchObject({ status: 'guardado', saidaEm: null, retiradoPor: '' });
    expect(amb.linha('achadosSigilo', a.id)).toMatchObject({ retiradoPor: '', contatoRetirada: '' });
    expect(amb.dados<Achado>('achados.situacao', { id: a.id, status: 'descartado', data: '2026-10-24', destino: 'Doação' })).toMatchObject({
      status: 'descartado', saidaEm: '2026-10-24', destino: 'Doação', retiradoPor: '',
    });
  });

  it('quem só vê não recebe os dados de quem retirou; sem o módulo, não acessa', () => {
    const amb = ambiente();
    const a = amb.dados<Achado>('achados.salvar', { dados: DADOS });
    amb.dados('achados.situacao', { id: a.id, status: 'devolvido', data: '2026-10-24', retiradoPor: 'Maria Exemplo' });
    const bolsista = amb.token('p02');
    expect(amb.resp('achados.listar', null, bolsista)).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
    amb.repo.atualizar('permissoes', { id: 'p02:achados', pessoaId: 'p02', modulo: 'achados', nivel: 'ver' });
    expect(amb.dados<Achado[]>('achados.listar', null, bolsista)[0]).toMatchObject({ status: 'devolvido', retiradoPor: '', contatoRetirada: '' });
    expect(amb.resp('achados.salvar', { dados: DADOS }, bolsista)).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
  });

  it('LGPD: depois do prazo da saída, apaga a foto e quem retirou; os guardados ficam como estão', () => {
    const amb = ambiente();
    const antigo = amb.dados<Achado>('achados.salvar', { dados: { ...DADOS, achadoEm: '2026-06-01' }, foto: FOTO });
    const recente = amb.dados<Achado>('achados.salvar', { dados: DADOS, foto: FOTO });
    const guardado = amb.dados<Achado>('achados.salvar', { dados: { ...DADOS, achadoEm: '2026-01-10' }, foto: FOTO });
    amb.dados('achados.situacao', { id: antigo.id, status: 'devolvido', data: '2026-07-01', retiradoPor: 'Maria Exemplo' });
    amb.dados('achados.situacao', { id: recente.id, status: 'devolvido', data: '2026-10-24', retiradoPor: 'João Exemplo' });
    const fotoAntiga = amb.linha('achados', antigo.id)!.fotoId as string;
    const ctx = { portas: amb.portas, eu: null, idRequisicao: '' };
    expect(limparDadosPessoais(ctx).achados).toBe(1);
    expect(amb.base.lerImagem(fotoAntiga)).toBeNull();
    expect(amb.linha('achadosSigilo', antigo.id)).toMatchObject({ retiradoPor: '', contatoRetirada: '' });
    const lista = amb.dados<Achado[]>('achados.listar', null);
    expect(lista.find((x) => x.id === antigo.id)).toMatchObject({ status: 'devolvido', temFoto: false, dadosApagadosEm: '2026-10-24' });
    expect(lista.find((x) => x.id === recente.id)).toMatchObject({ temFoto: true, retiradoPor: 'João Exemplo' });
    expect(lista.find((x) => x.id === guardado.id)).toMatchObject({ status: 'guardado', temFoto: true });
    expect(limparDadosPessoais(ctx).achados).toBe(0);
  });

  it('instalar: quem edita eventos passa a editar os achados; quem já tem a permissão fica como está', () => {
    const amb = ambiente();
    for (const id of ['p01:achados', 'p02:achados']) amb.repo.remover('permissoes', id);
    expect(concederModulosNovos(amb.repo)).toBe(2);
    expect(amb.linha('permissoes', 'p01:achados')).toMatchObject({ pessoaId: 'p01', modulo: 'achados', nivel: 'editar' });
    expect(amb.linha('permissoes', 'p02:achados')).toMatchObject({ nivel: 'nenhum' });
    expect(concederModulosNovos(amb.repo)).toBe(0);
  });
});
