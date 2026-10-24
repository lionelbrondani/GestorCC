import { normalizarCpf, normalizarMatricula, type DadosPessoais, type Pessoa } from '@shared';
import { dataParaTexto } from './tabelas/serializacao';

export type LinhaImportacao = Record<string, unknown>;
type DadosSemPessoa = Omit<DadosPessoais, 'pessoaId'>;

export interface ResultadoImportacao {
  novas: { pessoa: Omit<Pessoa, 'id' | 'permissoes'>; dados: DadosSemPessoa }[];
  atualizacoes: { pessoaId: string; dados: DadosSemPessoa }[];
  problemas: { linha: number; mensagem: string }[];
}

const texto = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return dataParaTexto(v).slice(0, 10);
  if (typeof v === 'number') return Number.isInteger(v) ? v.toFixed(0) : String(v);
  return String(v).trim();
};

/** Lê a aba IMPORTAR_PESSOAS (cabeçalhos: NOME, EMAIL, MATRICULA, TIPO, VINCULO, CPF, BANCO, AGENCIA, CONTA, CAMISETA, NASCIMENTO). */
export function prepararImportacao(linhas: LinhaImportacao[], existentes: Pessoa[]): ResultadoImportacao {
  const r: ResultadoImportacao = { novas: [], atualizacoes: [], problemas: [] };
  const porMatricula = new Map(existentes.map((p) => [p.matricula, p]));
  // o e-mail é o login: não pode repetir entre pessoas ativas, nem entre as linhas novas
  const emailsUsados = new Set(existentes.filter((p) => p.ativo).map((p) => p.emailAcademico.trim().toLowerCase()));
  const linhaDaMatricula = new Map<string, number>();

  linhas.forEach((bruta, i) => {
    const numero = i + 2; // linha 1 é o cabeçalho
    const l: Record<string, string> = {};
    for (const [k, v] of Object.entries(bruta)) l[k.trim().toUpperCase()] = texto(v);
    const problema = (mensagem: string) => r.problemas.push({ linha: numero, mensagem });

    if (!l.NOME) return problema('Nome em branco.');
    const matricula = normalizarMatricula(l.MATRICULA ?? '');
    if (!matricula) problema(`Matrícula ilegível (${l.MATRICULA || 'vazia'}); confira a célula e use só números.`);

    let cpf = '';
    if (l.CPF) {
      const normal = normalizarCpf(l.CPF);
      if (normal) cpf = normal;
      else problema(`CPF inválido (${l.CPF}); a pessoa entra sem CPF.`);
    }
    if (!matricula) return;
    const anterior = linhaDaMatricula.get(matricula);
    if (anterior) return problema(`Matrícula ${matricula} repetida na lista (já usada na linha ${anterior}).`);
    linhaDaMatricula.set(matricula, numero);

    const dados: DadosSemPessoa = {
      cpf, banco: l.BANCO ?? '', agencia: l.AGENCIA ?? '', conta: l.CONTA ?? '', camiseta: l.CAMISETA ?? '', nascimento: l.NASCIMENTO ?? '',
    };
    const existente = porMatricula.get(matricula);
    if (existente) {
      r.atualizacoes.push({ pessoaId: existente.id, dados });
      return;
    }
    const email = (l.EMAIL ?? '').toLowerCase();
    if (!email) return problema('E-mail em branco.');
    if (emailsUsados.has(email)) return problema(`E-mail ${email} já é de outra pessoa.`);
    emailsUsados.add(email);
    r.novas.push({
      pessoa: {
        nome: l.NOME,
        nomeCurto: l.NOME.split(/\s+/)[0].toUpperCase(),
        emailAcademico: email,
        matricula,
        tipo: l.TIPO?.toLowerCase() === 'servidor' ? 'servidor' : 'bolsista',
        vinculo: l.VINCULO?.toLowerCase() === 'fixo' ? 'fixo' : 'eventual',
        experiente: false,
        escalarMenos: false,
        ativo: true,
      },
      dados,
    });
  });
  return r;
}
