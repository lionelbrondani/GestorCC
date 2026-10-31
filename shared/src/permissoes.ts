export type Modulo =
  | 'eventos'
  | 'escalas'
  | 'pagamentos'
  | 'contratos'
  | 'almoxEstoque'
  | 'almoxSaidas'
  | 'infraestrutura'
  | 'achados'
  | 'mural'
  | 'busca'
  | 'formularios'
  | 'pessoas'
  | 'dadosPessoais'
  | 'configuracoes';

export type Nivel = 'nenhum' | 'ver' | 'editar';
export type Permissoes = Record<Modulo, Nivel>;
export type ModeloPermissao = 'gestor' | 'operacao' | 'eventual';

export const MODULOS: { id: Modulo; nome: string }[] = [
  { id: 'eventos', nome: 'Eventos e agenda' },
  { id: 'escalas', nome: 'Escalas' },
  { id: 'pagamentos', nome: 'Pagamentos' },
  { id: 'contratos', nome: 'Contratos' },
  { id: 'almoxEstoque', nome: 'Almoxarifado — estoque' },
  { id: 'almoxSaidas', nome: 'Almoxarifado — saídas' },
  { id: 'infraestrutura', nome: 'Infraestrutura (ocorrências)' },
  { id: 'achados', nome: 'Achados e perdidos' },
  { id: 'mural', nome: 'Mural de avisos' },
  { id: 'busca', nome: 'Busca inteligente' },
  { id: 'formularios', nome: 'Formulários (links)' },
  { id: 'pessoas', nome: 'Pessoas e acessos' },
  { id: 'dadosPessoais', nome: 'Dados pessoais (CPF/banco)' },
  { id: 'configuracoes', nome: 'Configurações' },
];

export const MODELOS: Record<ModeloPermissao, Permissoes> = {
  gestor: {
    eventos: 'editar',
    escalas: 'editar',
    pagamentos: 'editar',
    contratos: 'editar',
    almoxEstoque: 'editar',
    almoxSaidas: 'editar',
    infraestrutura: 'editar',
    achados: 'editar',
    mural: 'editar',
    busca: 'editar',
    formularios: 'ver',
    pessoas: 'editar',
    dadosPessoais: 'editar',
    configuracoes: 'editar',
  },
  operacao: {
    eventos: 'editar',
    escalas: 'editar',
    pagamentos: 'nenhum',
    contratos: 'nenhum',
    almoxEstoque: 'editar',
    almoxSaidas: 'editar',
    infraestrutura: 'ver',
    achados: 'editar',
    mural: 'editar',
    busca: 'editar',
    formularios: 'ver',
    pessoas: 'nenhum',
    dadosPessoais: 'nenhum',
    configuracoes: 'nenhum',
  },
  eventual: {
    eventos: 'nenhum',
    escalas: 'nenhum',
    pagamentos: 'nenhum',
    contratos: 'nenhum',
    almoxEstoque: 'nenhum',
    almoxSaidas: 'nenhum',
    infraestrutura: 'nenhum',
    achados: 'nenhum',
    mural: 'ver',
    busca: 'nenhum',
    formularios: 'nenhum',
    pessoas: 'nenhum',
    dadosPessoais: 'nenhum',
    configuracoes: 'nenhum',
  },
};

const PESO: Record<Nivel, number> = { nenhum: 0, ver: 1, editar: 2 };

export function pode(p: Permissoes, m: Modulo, nivel: 'ver' | 'editar'): boolean {
  return PESO[p[m] ?? 'nenhum'] >= PESO[nivel];
}

const MODULOS_NAO_GESTAO: Modulo[] = ['mural', 'formularios'];

export function ehGestor(p: Permissoes): boolean {
  return MODULOS.some((m) => !MODULOS_NAO_GESTAO.includes(m.id) && pode(p, m.id, 'ver'));
}
