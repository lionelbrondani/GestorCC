import { descreverLugares, formatarData, formatarDataHora, type AnexoFicha, type FichaPublica, type FichaTecnicaDados } from '@shared';
import type { ReactNode } from 'react';
import { nomesDaLista } from './ListaNomes';
import { corDoGrupo } from './MapaPoltronas';

type Evento = FichaPublica['evento'];

const simNao = (v: boolean | null) => (v === null ? '—' : v ? 'Sim' : 'Não');
const ou = (v: ReactNode) => (v === '' || v === null || v === undefined ? '—' : v);

function Item({ rotulo, children, largo }: { rotulo: string; children: ReactNode; largo?: boolean }) {
  return (
    <div className="resumo-item" data-largo={largo || undefined}>
      <dt>{rotulo}</dt>
      <dd>{ou(children)}</dd>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="resumo-secao">
      <h3>{titulo}</h3>
      <dl>{children}</dl>
    </section>
  );
}

const textoLongo = (t: string) => (t.trim() ? <span className="resumo-texto">{t}</span> : '');

/** A ficha em texto corrido, por seção (revisão do produtor, tela do gestor e impressão). */
export function ResumoFicha({ evento, dados: d, aoBaixarAnexo }: { evento: Evento; dados: FichaTecnicaDados; aoBaixarAnexo?: (a: AnexoFicha) => void }) {
  const r = d.responsavel;
  const nomeSessao = (id: string) => {
    const s = evento.sessoes.find((x) => x.id === id);
    return s ? `${formatarData(s.data)}${s.rotulo ? ` · ${s.rotulo}` : ''}` : 'Sessão';
  };
  return (
    <div className="resumo-ficha">
      <Secao titulo="O evento">
        <Item rotulo="Nome">{evento.nome}</Item>
        <Item rotulo="Tipo">{d.tipo === 'Outro' ? `Outro: ${d.tipoOutro}` : d.tipo}</Item>
        <Item rotulo="Público estimado">{d.publico ?? ''}</Item>
        <Item rotulo="Pessoas no elenco">{d.elenco ?? ''}</Item>
        <Item rotulo="Sinopse" largo>
          {textoLongo(d.sinopse)}
        </Item>
        {d.anexos.length > 0 && (
          <Item rotulo="Arquivos" largo>
            {d.anexos.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ', '}
                {aoBaixarAnexo ? (
                  <button type="button" className="link-botao" onClick={() => aoBaixarAnexo(a)}>
                    {a.nome}
                  </button>
                ) : (
                  a.nome
                )}
              </span>
            ))}
          </Item>
        )}
      </Secao>

      <Secao titulo="Horários">
        <Item rotulo="Montagem">{d.montagem && formatarDataHora(d.montagem)}</Item>
        <Item rotulo="Desmontagem">{d.desmontagem && formatarDataHora(d.desmontagem)}</Item>
        {d.sessoes.map((h) => (
          <Item key={h.sessaoId} rotulo={nomeSessao(h.sessaoId)} largo>
            {`Portas ${h.portas || '—'} · Início ${h.inicio || '—'} · Término ${h.fim || '—'} · ` +
              (h.intervalo ? `Intervalo ${h.intervaloInicio || '—'}–${h.intervaloFim || '—'}` : h.intervalo === false ? 'Sem intervalo' : 'Intervalo: —')}
          </Item>
        ))}
      </Secao>

      <Secao titulo="Responsável e equipe">
        <Item rotulo="Nome">{r.nome}</Item>
        <Item rotulo="Vínculo">{r.vinculo === 'Outro' ? `Outro: ${r.vinculoOutro}` : r.vinculo}</Item>
        <Item rotulo="CPF ou CNPJ">{r.documento}</Item>
        {r.siapeMatricula && <Item rotulo="SIAPE ou matrícula">{r.siapeMatricula}</Item>}
        <Item rotulo="E-mail">{r.email}</Item>
        <Item rotulo="Telefone">{r.telefone}</Item>
        <Item rotulo="O que será montado" largo>
          {textoLongo(d.descricaoMontagem)}
        </Item>
        <Item rotulo={`Equipe de montagem (portaria) · ${nomesDaLista(d.equipeMontagem).length} pessoas`} largo>
          {nomesDaLista(d.equipeMontagem).length > 0 && (
            <ol className="resumo-nomes">
              {nomesDaLista(d.equipeMontagem).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ol>
          )}
        </Item>
      </Secao>

      <Secao titulo="Espaços e público">
        <Item rotulo="Locais">{d.locais.join(', ')}</Item>
        <Item rotulo="Sessão de fotos">{simNao(d.sessaoFotos)}</Item>
        <Item rotulo="Leitura de ingressos">{simNao(d.leituraIngressos)}</Item>
        <Item rotulo="Ingresso solidário">
          {d.ingressoSolidario ? `Sim · ${d.destinoAlimentos === 'Outro' ? d.destinoOutro : d.destinoAlimentos || 'destino não informado'}` : simNao(d.ingressoSolidario)}
        </Item>
      </Secao>

      <Secao titulo="Camarins">
        <Item rotulo={`Individuais (${d.camarinsIndividuais.length})`} largo>
          {d.camarinsIndividuais.map((n, i) => `${i + 1}: ${n}`).join(' · ')}
        </Item>
        <Item rotulo={`Coletivos (${d.camarinsColetivos.length})`} largo>
          {d.camarinsColetivos.map((n, i) => `${i + 1}: ${n}`).join(' · ')}
        </Item>
      </Secao>

      <Secao titulo="Poltronas reservadas">
        {d.reservarPoltronas ? (
          <>
            {d.grupos
              .map((g, i) => ({ g, i }))
              .filter(({ g }) => g.lugares.length)
              .map(({ g, i }) => (
                <Item key={i} rotulo={`${g.nome || 'Sem nome'} (${g.lugares.length})`} largo>
                  <span className="linha" style={{ alignItems: 'baseline', flexWrap: 'nowrap' }}>
                    <span className="resumo-cor" style={{ background: corDoGrupo(i) }} aria-hidden />
                    <span>{descreverLugares(g.lugares)}</span>
                  </span>
                </Item>
              ))}
            {d.observacoesPoltronas && (
              <Item rotulo="Observações" largo>
                {textoLongo(d.observacoesPoltronas)}
              </Item>
            )}
          </>
        ) : (
          <Item rotulo="Reserva">{simNao(d.reservarPoltronas)}</Item>
        )}
      </Secao>

      <Secao titulo="Coffee break">
        <Item rotulo="Haverá coffee break">{simNao(d.coffeeBreak)}</Item>
        {d.coffeeBreak && (
          <>
            <Item rotulo="Onde">{d.coffeeLocal}</Item>
            <Item rotulo="O que será servido" largo>
              {textoLongo(d.coffeeCardapio)}
            </Item>
          </>
        )}
      </Secao>
    </div>
  );
}
