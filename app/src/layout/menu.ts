import { pode, type Modulo, type Pessoa } from '@shared';
import { recursoAtivo, type Recurso } from '../recursos';
import {
  Banknote,
  Bell,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FileText,
  Home,
  Megaphone,
  Package,
  Settings,
  UserRound,
  Users,
  Wallet,
  Wrench,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

export interface ItemMenu {
  rota: string;
  rotulo: string;
  icone: LucideIcon;
  modulo?: Modulo;
  /** Área pessoal que só aparece quando o recurso está ligado. */
  recurso?: Recurso;
}

export const ITENS_GESTAO: ItemMenu[] = [
  { rota: '/agenda', rotulo: 'Agenda', icone: CalendarDays, modulo: 'eventos' },
  { rota: '/escalas', rotulo: 'Escalas', icone: ClipboardList, modulo: 'escalas' },
  { rota: '/pagamentos', rotulo: 'Pagamentos', icone: Banknote, modulo: 'pagamentos' },
  { rota: '/contratos', rotulo: 'Contratos', icone: FileSignature, modulo: 'contratos' },
  { rota: '/almox', rotulo: 'Almoxarifado', icone: Package, modulo: 'almoxEstoque' },
  { rota: '/infra', rotulo: 'Infraestrutura', icone: Wrench, modulo: 'infraestrutura' },
  { rota: '/mural', rotulo: 'Mural', icone: Megaphone, modulo: 'mural' },
  { rota: '/pessoas', rotulo: 'Pessoas', icone: Users, modulo: 'pessoas' },
  { rota: '/formularios', rotulo: 'Formulários', icone: FileText, modulo: 'formularios' },
  { rota: '/configuracoes', rotulo: 'Configurações', icone: Settings, modulo: 'configuracoes' },
];

export const ITEM_INICIO: ItemMenu = { rota: '/', rotulo: 'Início', icone: Home };

export const ITENS_PESSOAIS: ItemMenu[] = [
  { rota: '/minhas-escalas', rotulo: 'Minhas escalas', icone: CalendarCheck, recurso: 'escalasPessoais' },
  { rota: '/disponibilidade', rotulo: 'Disponibilidade', icone: ClipboardList, recurso: 'escalasPessoais' },
  { rota: '/ganhos', rotulo: 'Ganhos', icone: Wallet, recurso: 'escalasPessoais' },
  { rota: '/avisos', rotulo: 'Avisos', icone: Bell },
  { rota: '/relatar', rotulo: 'Relatar problema', icone: TriangleAlert, recurso: 'relatar' },
  { rota: '/perfil', rotulo: 'Perfil', icone: UserRound },
];

export function itensVisiveis(p: Pessoa): { gestao: ItemMenu[]; pessoais: ItemMenu[] } {
  const gestao = ITENS_GESTAO.filter((i) => {
    if (!i.modulo) return true;
    if (!recursoAtivo(i.modulo) && !(i.modulo === 'almoxEstoque' && recursoAtivo('almoxSaidas'))) return false;
    if (i.modulo === 'almoxEstoque') return pode(p.permissoes, 'almoxEstoque', 'ver') || pode(p.permissoes, 'almoxSaidas', 'ver');
    if (i.modulo === 'mural') return pode(p.permissoes, 'mural', 'editar');
    return pode(p.permissoes, i.modulo, 'ver');
  });
  const pessoais = ITENS_PESSOAIS.filter((i) => (i.rota !== '/ganhos' || p.tipo === 'bolsista') && (!i.recurso || recursoAtivo(i.recurso)));
  return { gestao, pessoais };
}
