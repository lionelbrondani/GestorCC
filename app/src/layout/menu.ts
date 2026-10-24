import { pode, type Modulo, type Pessoa } from '@shared';
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
  { rota: '/minhas-escalas', rotulo: 'Minhas escalas', icone: CalendarCheck },
  { rota: '/disponibilidade', rotulo: 'Disponibilidade', icone: ClipboardList },
  { rota: '/ganhos', rotulo: 'Ganhos', icone: Wallet },
  { rota: '/avisos', rotulo: 'Avisos', icone: Bell },
  { rota: '/relatar', rotulo: 'Relatar problema', icone: TriangleAlert },
  { rota: '/perfil', rotulo: 'Perfil', icone: UserRound },
];

export function itensVisiveis(p: Pessoa): { gestao: ItemMenu[]; pessoais: ItemMenu[] } {
  const gestao = ITENS_GESTAO.filter((i) => {
    if (!i.modulo) return true;
    if (i.modulo === 'almoxEstoque') return pode(p.permissoes, 'almoxEstoque', 'ver') || pode(p.permissoes, 'almoxSaidas', 'ver');
    if (i.modulo === 'mural') return pode(p.permissoes, 'mural', 'editar');
    return pode(p.permissoes, i.modulo, 'ver');
  });
  const pessoais = ITENS_PESSOAIS.filter((i) => i.rota !== '/ganhos' || p.tipo === 'bolsista');
  return { gestao, pessoais };
}
