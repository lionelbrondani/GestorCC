import { describe, expect, it } from 'vitest';
import { textoPrivacidade } from './lgpd';

describe('aviso de privacidade das páginas públicas', () => {
  it('ficha técnica: para que servem os dados do responsável e quando são apagados', () => {
    expect(textoPrivacidade('ficha', 180)).toBe(
      'Os dados do responsável (CPF ou CNPJ, matrícula, e-mail e telefone) servem só para organizar este evento no Centro de Convenções da UFSM e ficam com acesso restrito. ' +
        'Eles são apagados 180 dias depois do evento. Dúvidas sobre os seus dados: centrodeconvencoes@ufsm.br.',
    );
  });

  it('pedido de datas: dados do solicitante e do responsável para a análise e o contrato; recusado, apagados no prazo', () => {
    expect(textoPrivacidade('pedido', 180)).toBe(
      'Os dados do solicitante e do responsável (CNPJ, CPF, endereço, e-mail e telefone) servem só para analisar este pedido e, se ele for aprovado, para o contrato, e ficam com acesso restrito. ' +
        'Se o pedido for recusado, eles são apagados 180 dias depois. Dúvidas sobre os seus dados: centrodeconvencoes@ufsm.br.',
    );
  });

  it('cortesias: nomes e matrículas só para a retirada; sem prazo, não promete apagar', () => {
    expect(textoPrivacidade('cortesias', 0)).toBe(
      'Os nomes e as matrículas servem só para a retirada das cortesias deste evento e ficam com acesso restrito. Dúvidas sobre os seus dados: centrodeconvencoes@ufsm.br.',
    );
  });
});
