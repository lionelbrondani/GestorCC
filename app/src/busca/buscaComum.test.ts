import { MODELOS, type Achado, type AlmoxItem, type Contrato, type Evento, type Pessoa } from '@shared';
import { buscaComum } from './buscaComum';

const pessoa = (id: string, nome: string): Pessoa => ({
  id, nome, nomeCurto: nome.toUpperCase(), emailAcademico: '', matricula: '', tipo: 'bolsista', vinculo: 'eventual',
  experiente: false, escalarMenos: false, ativo: true, permissoes: MODELOS.eventual,
});
const dados = {
  pessoas: [pessoa('p1', 'Heloá Martins'), pessoa('p2', 'Bruno Lemos')],
  eventos: [{ id: 'e1', nome: 'Helô em Concerto', tipo: 'Show/Concerto', organizador: '', contatoOrganizador: '', pagamento: 'interno', instrumento: 'contrato', status: 'ativo' } as Evento],
  itens: [{ cod: '1001', nomeAlmox: 'FITA CREPE', nomeComum: 'Fita crepe', unidade: 'Rolo', valor: 100, categoria: 'Expediente', qtdMinima: 1, sala: '', status: 'Ativo', saldo: 3 } as AlmoxItem],
  contratos: [{ id: 'c1', numero: '21/2026', eventoId: 'e1' } as Contrato],
};

describe('buscaComum', () => {
  it('encontra sem acento e sem diferenciar maiúsculas', () => {
    const r = buscaComum('helo', dados, MODELOS.gestor);
    expect(r.map((x) => x.titulo)).toEqual(expect.arrayContaining(['Heloá Martins', 'Helô em Concerto']));
  });

  it('respeita as permissões', () => {
    expect(buscaComum('fita', dados, MODELOS.eventual)).toEqual([]);
    expect(buscaComum('21/2026', dados, MODELOS.operacao)).toEqual([]);
    expect(buscaComum('fita', dados, MODELOS.operacao)).toHaveLength(1);
  });

  it('acha os achados e perdidos pela descrição, para quem tem o módulo', () => {
    const achados = [{ id: 'a1', numero: 7, descricao: 'Guarda-chuva preto', achadoEm: '2026-10-20', status: 'guardado' } as Achado];
    for (const termo of ['guarda-chuva', 'guarda chuva']) {
      expect(buscaComum(termo, { ...dados, achados }, MODELOS.gestor)).toEqual([
        { tipo: 'achado', titulo: '#7 Guarda-chuva preto', subtitulo: 'Guardado · achado em 20/10/2026', link: '/achados?item=a1' },
      ]);
    }
    expect(buscaComum('guarda-chuva', { ...dados, achados }, MODELOS.eventual)).toEqual([]);
  });

  it('limita a 8 resultados', () => {
    const muitos = { ...dados, pessoas: Array.from({ length: 20 }, (_, i) => pessoa(`x${i}`, `Ana ${i}`)) };
    expect(buscaComum('ana', muitos, MODELOS.gestor)).toHaveLength(8);
  });
});
