import { formatarReais, type Ficha } from '@shared';
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';

const borda = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const bordas = { top: borda, bottom: borda, left: borda, right: borda };

function celula(texto: string, negrito = false): TableCell {
  return new TableCell({
    borders: bordas,
    children: [new Paragraph({ children: [new TextRun({ text: texto, bold: negrito, size: 18, font: 'Arial' })] })],
  });
}

export async function gerarFichaDocx(f: Ficha): Promise<Blob> {
  const cabecalho = ['', 'NOME', 'MATRÍCULA', 'CPF', 'BANCO', 'AGÊNCIA', 'CONTA', 'VALOR (R$)'];
  const linhas = [
    new TableRow({ tableHeader: true, children: cabecalho.map((c) => celula(c, true)) }),
    ...f.linhas.map(
      (l) =>
        new TableRow({
          children: [String(l.ordem), l.nome, l.matricula, l.cpf, l.banco, l.agencia, l.conta, formatarReais(l.valor)].map((t) => celula(t)),
        }),
    ),
    new TableRow({ children: ['', 'TOTAL', '', '', '', '', '', formatarReais(f.total)].map((t) => celula(t, true)) }),
  ];

  const p = (texto: string, opcoes: { negrito?: boolean; centro?: boolean } = {}) =>
    new Paragraph({
      alignment: opcoes.centro ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [new TextRun({ text: texto, bold: opcoes.negrito, font: 'Arial', size: 20 })],
    });

  const doc = new Document({
    sections: [
      {
        children: [
          p(f.titulo, { negrito: true, centro: true }),
          p(`Período de Referência: ${f.periodoReferencia}`),
          p(f.iniciativaEdital),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: linhas }),
          p(''),
          p(f.textoEncaminhamento),
          p('Segue abaixo a discriminação dos eventos que cada bolsista atuou:'),
          ...f.discriminacao.map((d) => p(`${d.nome}${d.eventos ? ` - ${d.eventos}` : ' -'}`)),
          p(`PS: ${f.observacao}`),
          p('Cordialmente,'),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}

export function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
