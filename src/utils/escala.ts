/**
 * Regras da escala compartilhadas entre a tela de Escala e o Encerrar Plantão.
 *
 * Saber quem deveria trabalhar num dia/turno envolve quatro camadas — vigência
 * do registro, folga/falta, cobertura e troca — e elas precisam responder igual
 * nas duas telas. Por isso moram aqui, e não dentro de um componente.
 */

export type Turno = 'diurno' | 'noturno';

export interface EscalaItem {
  id: string;
  tecnicoId?: string;
  tecnicoNome: string;
  inicial: string;
  paridade: 'par' | 'impar';
  turno: Turno;
  inicio?: string;      // ISO — vale a partir de (ausente = desde sempre)
  fim?: string | null;  // ISO — vale até, inclusive (ausente/null = em vigor)
}

export interface Folga {
  tecnicoId: string;
  tecnicoNome: string;
  data: string; // ISO
  turno: Turno;
  tipo?: 'folga' | 'falta';
  avisou?: boolean;
  motivo?: string;
  cobertoPor?: string;
  cobertoPorNome?: string;
}

export interface TrocaPlantao {
  id: string;
  origemTecnicoId: string;
  origemTecnicoNome: string;
  origemData: string;
  origemTurno: Turno;
  destinoTecnicoId: string;
  destinoTecnicoNome: string;
  destinoData: string;
  destinoTurno: Turno;
  criadoEm: string;
  criadoPorNome: string;
  observacao?: string;
}

/** Registros antigos guardavam o id do técnico no próprio id do documento. */
export const tecnicoIdDe = (e: EscalaItem) => e.tecnicoId || e.id;

/** A vigência cobre aquela data? Sem `inicio`, o registro vale desde sempre. */
export const vigenteEm = (e: EscalaItem, dataISO: string) =>
  (!e.inicio || dataISO >= e.inicio) && (!e.fim || dataISO <= e.fim);

export const chaveSlot = (tecnicoId: string, data: string, turno: string) => `${tecnicoId}_${data}_${turno}`;

export const ehFalta = (f?: Folga) => f?.tipo === 'falta';
export const rotuloAusencia = (f?: Folga) => (ehFalta(f) ? 'Falta' : 'Folga');
export const rotuloTurno = (t: string) => (t === 'noturno' ? 'Noturno' : 'Diurno');

export const iniciaisDe = (nome: string) => {
  const p = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
};

export const isoDe = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

export interface EsperadoNoPlantao {
  tecnicoId: string;
  nome: string;
  origem: 'escala' | 'cobertura' | 'troca';
  /** Para cobertura e troca: de quem é o plantão originalmente. */
  noLugarDe?: string;
}

/**
 * Quem deveria trabalhar num dia/turno, já considerando tudo:
 * escala vigente por paridade, menos quem está de folga/falta, menos quem
 * trocou aquele plantão, mais quem entrou por cobertura ou por troca.
 */
export const escaladosEm = (
  escala: EscalaItem[],
  folgas: Record<string, Folga>,
  trocas: TrocaPlantao[],
  dataISO: string,
  turno: Turno
): EsperadoNoPlantao[] => {
  const dia = Number(dataISO.split('-')[2]);
  if (!dia) return [];
  const paridade = dia % 2 === 0 ? 'par' : 'impar';

  const saiuPorTroca = new Set<string>();
  trocas.forEach((t) => {
    saiuPorTroca.add(chaveSlot(t.origemTecnicoId, t.origemData, t.origemTurno));
    saiuPorTroca.add(chaveSlot(t.destinoTecnicoId, t.destinoData, t.destinoTurno));
  });

  const lista: EsperadoNoPlantao[] = [];

  escala.forEach((e) => {
    if ((e.turno || 'diurno') !== turno) return;
    if (e.paridade !== paridade) return;
    if (!vigenteEm(e, dataISO)) return;
    const tid = tecnicoIdDe(e);
    if (folgas[`${tid}_${dataISO}`]) return;                    // de folga ou faltou
    if (saiuPorTroca.has(chaveSlot(tid, dataISO, turno))) return; // cedeu por troca
    lista.push({ tecnicoId: tid, nome: e.tecnicoNome, origem: 'escala' });
  });

  Object.values(folgas).forEach((f) => {
    if (f.data !== dataISO || (f.turno || 'diurno') !== turno || !f.cobertoPor) return;
    lista.push({
      tecnicoId: f.cobertoPor,
      nome: f.cobertoPorNome ?? '',
      origem: 'cobertura',
      noLugarDe: f.tecnicoNome,
    });
  });

  trocas.forEach((t) => {
    if (t.origemData === dataISO && t.origemTurno === turno) {
      lista.push({ tecnicoId: t.destinoTecnicoId, nome: t.destinoTecnicoNome, origem: 'troca', noLugarDe: t.origemTecnicoNome });
    }
    if (t.destinoData === dataISO && t.destinoTurno === turno) {
      lista.push({ tecnicoId: t.origemTecnicoId, nome: t.origemTecnicoNome, origem: 'troca', noLugarDe: t.destinoTecnicoNome });
    }
  });

  return lista;
};
