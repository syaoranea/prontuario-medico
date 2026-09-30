import { RotinaItem } from '../interface/interface';

/**
 * Rotina esporádica — tarefas que não são de todo dia.
 *
 * Regras:
 * - `periodicidade` 0/ausente = tarefa diária (comportamento de sempre).
 * - Tarefa periódica só entra no checklist quando VENCE
 *   (`ultimaConclusao + periodicidade` dias <= hoje).
 * - Uma vez vencida, ela continua aparecendo todo dia até alguém marcar —
 *   e por isso o atraso só cresce, nunca some sozinho.
 * - Nunca concluída = vencida desde já.
 */

export const PERIODICIDADES = [
  { valor: 0, label: 'Todo dia' },
  { valor: 7, label: 'A cada 7 dias' },
  { valor: 15, label: 'A cada 15 dias' },
  { valor: 30, label: 'A cada 30 dias' },
];

export const ehPeriodica = (item: Pick<RotinaItem, 'periodicidade'>) =>
  !!item.periodicidade && item.periodicidade > 0;

export const labelPeriodicidade = (dias?: number) =>
  PERIODICIDADES.find((p) => p.valor === (dias || 0))?.label ?? `A cada ${dias} dias`;

/** Soma dias a uma data ISO, sem passar por UTC (evita virar o dia no fuso BR). */
export const somarDias = (dataISO: string, dias: number): string => {
  const [a, m, d] = dataISO.split('-').map(Number);
  if (!a || !m || !d) return dataISO;
  const base = new Date(a, m - 1, d);
  base.setDate(base.getDate() + dias);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
};

/** Diferença em dias entre duas datas ISO (b - a). */
export const diasEntre = (aISO: string, bISO: string): number => {
  const [a1, a2, a3] = aISO.split('-').map(Number);
  const [b1, b2, b3] = bISO.split('-').map(Number);
  if (!a1 || !b1) return 0;
  const a = new Date(a1, a2 - 1, a3).getTime();
  const b = new Date(b1, b2 - 1, b3).getTime();
  return Math.round((b - a) / 86400000);
};

export interface StatusPeriodico {
  periodica: boolean;
  /** Data em que a tarefa vence (null quando é diária ou nunca foi feita). */
  vencimento: string | null;
  /** Já venceu e ainda não foi marcada? */
  vencida: boolean;
  /** Dias de atraso: 0 no dia do vencimento, cresce a partir do dia seguinte. */
  diasAtraso: number;
  /** Dias que faltam para vencer (negativo quando já venceu). */
  diasRestantes: number;
  /** Nunca foi concluída desde que virou periódica. */
  nuncaFeita: boolean;
}

export const statusPeriodico = (
  item: Pick<RotinaItem, 'periodicidade' | 'ultimaConclusao'>,
  hojeISO: string
): StatusPeriodico => {
  if (!ehPeriodica(item)) {
    return { periodica: false, vencimento: null, vencida: false, diasAtraso: 0, diasRestantes: 0, nuncaFeita: false };
  }

  // Sem registro de conclusão, a tarefa está pendente desde já.
  if (!item.ultimaConclusao) {
    return { periodica: true, vencimento: null, vencida: true, diasAtraso: 0, diasRestantes: 0, nuncaFeita: true };
  }

  const vencimento = somarDias(item.ultimaConclusao, item.periodicidade!);
  const diff = diasEntre(vencimento, hojeISO); // >0 = passou do vencimento
  return {
    periodica: true,
    vencimento,
    vencida: diff >= 0,
    diasAtraso: Math.max(0, diff),
    diasRestantes: -diff,
    nuncaFeita: false,
  };
};

/** A tarefa deve aparecer no checklist deste dia? */
export const apareceNoChecklist = (item: RotinaItem, hojeISO: string) =>
  !ehPeriodica(item) || statusPeriodico(item, hojeISO).vencida;

/**
 * Vira alerta no Dashboard? Só quando passou do dia do vencimento — no próprio
 * dia a equipe ainda tem o plantão inteiro para fazer sem ninguém ser cobrado.
 * Tarefa nunca feita alerta de imediato, porque não há vencimento a esperar.
 */
export const geraAlerta = (item: RotinaItem, hojeISO: string) => {
  const s = statusPeriodico(item, hojeISO);
  return s.periodica && (s.nuncaFeita || s.diasAtraso > 0);
};
