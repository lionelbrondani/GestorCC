import { CheckCircle2, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/cliente';
import { useConsulta } from '../../api/hooks';
import { normalizar } from '../../busca/buscaComum';
import { Alerta, Botao, Campo, Carregando, Cartao } from '../../componentes';
import { SETOR } from '@shared';
import '../ficha/ficha.css';
// a armadilha de robô e o cartão de "registrado" usam os estilos da página de pedido de data
import '../pedido/pedido.css';
import './almox.css';

type Escolhido = { cod: string; nome: string; unidade: string; qtd: number };

/**
 * Página do QR code colado na porta do almoxarifado: qualquer pessoa da equipe lança a retirada, sem login,
 * no nome que digitar. A chave vem no link do código; com um QR antigo, a página só avisa.
 */
export function RetiradaQr() {
  const [params] = useSearchParams();
  const chave = params.get('k') ?? '';
  const api = useApi();
  const dados = useConsulta('retirada.abrir', { chave });
  const [nome, setNome] = useState('');
  const [busca, setBusca] = useState('');
  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([]);
  const [finalidade, setFinalidade] = useState('');
  const [site, setSite] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);

  const termo = normalizar(busca);
  const achados = termo.length >= 2 ? (dados.data?.itens ?? []).filter((i) => !escolhidos.some((e) => e.cod === i.cod) && normalizar(`${i.nome} ${i.cod}`).includes(termo)).slice(0, 8) : [];
  const mudarQtd = (cod: string, qtd: number) => setEscolhidos(escolhidos.map((e) => (e.cod === cod ? { ...e, qtd } : e)));

  async function registrar() {
    setErro(null);
    if (nome.trim().length < 3) return setErro('Escreva o seu nome.');
    if (!escolhidos.length) return setErro('Escolha pelo menos um item.');
    if (!finalidade.trim()) return setErro('Conte para que é a retirada.');
    setEnviando(true);
    try {
      await api.chamar('retirada.registrar', { chave, nome, itens: escolhidos.map((e) => ({ cod: e.cod, qtd: e.qtd })), finalidade, ...(site ? { site } : {}) });
      setFeito(true);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  function novaRetirada() {
    setEscolhidos([]);
    setFinalidade('');
    setBusca('');
    setFeito(false);
  }

  return (
    <div className="ficha-pagina">
      <header className="ficha-topo">
        <img src="/logo-branco.png" alt={SETOR.logoAlt} />
        <strong>Almoxarifado</strong>
      </header>
      <main className="ficha-conteudo retirada-qr">
        <h1>Retirada de material</h1>
        {dados.isLoading ? (
          <Carregando />
        ) : dados.error ? (
          <Alerta tom="erro">{(dados.error as Error).message}</Alerta>
        ) : feito ? (
          <Cartao destaque>
            <div className="pedido-enviado">
              <CheckCircle2 size={36} aria-hidden />
              <p>Retirada registrada. Obrigado!</p>
              <Botao onClick={novaRetirada}>Nova retirada</Botao>
            </div>
          </Cartao>
        ) : (
          <Cartao>
            <div className="pilha">
              <Campo rotulo="Seu nome">{(id) => <input id={id} className="cc-entrada" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />}</Campo>
              <Campo rotulo="Procurar item" ajuda="Pelo nome ou pelo código da etiqueta.">
                {(id) => <input id={id} className="cc-entrada" type="search" placeholder="ex.: fita, pilha" value={busca} onChange={(e) => setBusca(e.target.value)} />}
              </Campo>
              {achados.length > 0 && (
                <ul className="retirada-qr-achados">
                  {achados.map((i) => (
                    <li key={i.cod}>
                      <Botao
                        variante="fantasma"
                        aria-label={`Incluir ${i.nome}`}
                        onClick={() => {
                          setEscolhidos([...escolhidos, { ...i, qtd: 1 }]);
                          setBusca('');
                        }}
                      >
                        <Plus size={16} aria-hidden /> {i.nome} <span className="pequeno texto-2">· {i.unidade}</span>
                      </Botao>
                    </li>
                  ))}
                </ul>
              )}
              {escolhidos.length > 0 && (
                <ul className="retirada-qr-escolhidos">
                  {escolhidos.map((e) => (
                    <li key={e.cod}>
                      <span>
                        <strong>{e.nome}</strong> <span className="pequeno texto-2">({e.unidade})</span>
                      </span>
                      <input
                        className="cc-entrada"
                        type="number"
                        min={1}
                        aria-label={`Quantidade de ${e.nome}`}
                        value={e.qtd || ''}
                        onChange={(ev) => mudarQtd(e.cod, Math.max(0, Math.round(Number(ev.target.value))))}
                      />
                      <Botao tamanho="pequeno" variante="fantasma" aria-label={`Tirar ${e.nome}`} onClick={() => setEscolhidos(escolhidos.filter((x) => x.cod !== e.cod))}>
                        <Minus size={16} aria-hidden />
                      </Botao>
                    </li>
                  ))}
                </ul>
              )}
              <Campo rotulo="Para quê?" ajuda="ex.: ensaio do coral, manutenção do camarim 2">
                {(id) => <input id={id} className="cc-entrada" maxLength={200} value={finalidade} onChange={(e) => setFinalidade(e.target.value)} />}
              </Campo>
              {/* armadilha para robôs: escondida das pessoas e dos leitores de tela */}
              <div className="pedido-armadilha" aria-hidden="true">
                <label>
                  Site
                  <input tabIndex={-1} autoComplete="off" value={site} onChange={(e) => setSite(e.target.value)} />
                </label>
              </div>
              {erro && <Alerta tom="erro">{erro}</Alerta>}
              <Botao variante="primario" carregando={enviando} onClick={registrar}>
                Registrar retirada
              </Botao>
            </div>
          </Cartao>
        )}
      </main>
    </div>
  );
}
