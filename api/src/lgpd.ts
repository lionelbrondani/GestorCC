import { somarDias, type DataISO, type PessoaCortesia } from '@shared';
import { configAtual } from './acoes/sistema';
import { registrar, type Contexto } from './nucleo/historico';

type LinhaSessao = { id: string; eventoId: string; data: DataISO; status: string };
type LinhaDestino = { id: string; eventoId: string; apagadoEm?: string; atualizadoPor?: string };
type LinhaSigiloCortesias = { id: string; pessoas: PessoaCortesia[] | null };
type LinhaFicha = { id: string; dados: { responsavel?: Record<string, unknown> } | null; dadosApagadosEm?: string; atualizadoPor?: string };
type LinhaSigiloFicha = { id: string; documento: string; email: string; telefone: string };

const semCarimbo = <T extends { atualizadoPor?: string }>({ atualizadoPor: _p, ...l }: T) => l;

/** Último dia de cada evento: a última sessão não cancelada (ou a última de todas, se todas foram canceladas). */
function fimDosEventos(sessoes: LinhaSessao[]): Map<string, DataISO> {
  const fim = new Map<string, { ativa: DataISO; qualquer: DataISO }>();
  for (const s of sessoes) {
    const atual = fim.get(s.eventoId) ?? { ativa: '', qualquer: '' };
    fim.set(s.eventoId, {
      ativa: s.status !== 'cancelada' && s.data > atual.ativa ? s.data : atual.ativa,
      qualquer: s.data > atual.qualquer ? s.data : atual.qualquer,
    });
  }
  return new Map([...fim].map(([id, f]) => [id, f.ativa || f.qualquer]));
}

/**
 * LGPD: apaga os dados pessoais que só servem ao evento, alguns dias depois dele (Configurações; 0 = nunca).
 * - Cortesias: os nomes e as matrículas; o destino guarda quantos eram, para o relatório continuar certo.
 * - Ficha técnica: documento, matrícula/SIAPE, e-mail e telefone do responsável; o nome fica.
 * Roda depois do backup diário; cada limpeza entra no histórico uma vez só.
 */
export function limparDadosPessoais(ctx: Contexto): { cortesias: number; fichas: number } {
  const { repo, relogio } = ctx.portas;
  const hoje = relogio.hoje();
  const { diasGuardarCortesias, diasGuardarFicha } = configAtual(ctx);
  const fim = fimDosEventos(repo.listar<LinhaSessao>('sessoes'));
  const venceu = (eventoId: string, dias: number) => dias > 0 && fim.has(eventoId) && somarDias(fim.get(eventoId)!, dias) < hoje;
  const feito = { cortesias: 0, fichas: 0 };

  const sigiloCortesias = new Map(repo.listar<LinhaSigiloCortesias>('cortesiasSigilo').map((s) => [s.id, s]));
  for (const d of repo.listar<LinhaDestino>('cortesiasDestinos')) {
    if (d.apagadoEm || !venceu(d.eventoId, diasGuardarCortesias)) continue;
    const sigilo = sigiloCortesias.get(d.id);
    if (sigilo) repo.atualizar('cortesiasSigilo', { ...sigilo, pessoas: [] });
    repo.atualizar('cortesiasDestinos', { ...semCarimbo(d), trava: 'travada', apagadoEm: hoje, nomesApagados: sigilo?.pessoas?.length ?? 0 });
    registrar(ctx, 'cortesias', d.id, `apagou os nomes das cortesias (LGPD, ${diasGuardarCortesias} dias depois do evento)`, null, null);
    feito.cortesias++;
  }

  const sigiloFichas = new Map(repo.listar<LinhaSigiloFicha>('fichasSigilo').map((s) => [s.id, s]));
  for (const f of repo.listar<LinhaFicha>('fichas')) {
    if (f.dadosApagadosEm || !venceu(f.id, diasGuardarFicha)) continue;
    const sigilo = sigiloFichas.get(f.id);
    if (sigilo) repo.atualizar('fichasSigilo', { ...sigilo, documento: '', email: '', telefone: '' });
    const dados = f.dados ? { ...f.dados, responsavel: { ...f.dados.responsavel, documento: '', siapeMatricula: '', email: '', telefone: '' } } : f.dados;
    repo.atualizar('fichas', { ...semCarimbo(f), dados, dadosApagadosEm: hoje });
    registrar(ctx, 'ficha', f.id, `apagou os dados pessoais do responsável (LGPD, ${diasGuardarFicha} dias depois do evento)`, null, null);
    feito.fichas++;
  }
  return feito;
}
