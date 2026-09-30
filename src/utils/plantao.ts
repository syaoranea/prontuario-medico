import { EscalaItem, Folga, TrocaPlantao, Turno, escaladosEm, isoDe } from './escala';

/**
 * Qual plantão está acontecendo agora.
 *
 * Diurno vai das 7h às 19h do mesmo dia; noturno das 19h às 7h do dia seguinte.
 * Por isso, quem encerra às 6h da manhã está encerrando o plantão NOTURNO DE
 * ONTEM — é o erro mais fácil de cometer aqui, e o que embaralharia o calendário.
 */
export const plantaoDeAgora = (agora: Date = new Date()): { data: string; turno: Turno } => {
  const iso = (d: Date) => isoDe(d.getFullYear(), d.getMonth(), d.getDate());
  const h = agora.getHours();

  if (h >= 7 && h < 19) return { data: iso(agora), turno: 'diurno' };
  if (h >= 19) return { data: iso(agora), turno: 'noturno' };

  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  return { data: iso(ontem), turno: 'noturno' };
};

/** O plantão já acabou? Só depois disso faz sentido cobrar o relatório. */
export const plantaoTerminou = (dataISO: string, turno: Turno, agora: Date = new Date()): boolean => {
  const [a, m, d] = dataISO.split('-').map(Number);
  if (!a || !m || !d) return false;
  const fim = new Date(a, m - 1, d);
  if (turno === 'diurno') {
    fim.setHours(19, 0, 0, 0);
  } else {
    fim.setDate(fim.getDate() + 1);
    fim.setHours(7, 0, 0, 0);
  }
  return agora >= fim;
};

export type StatusPlantao = 'encerrado' | 'pendente' | 'futuro' | 'sem-escala';

export const STATUS_PLANTAO: Record<StatusPlantao, { label: string; chip: string; ponto: string }> = {
  encerrado: { label: 'Encerrado', chip: 'bg-emerald-100 text-emerald-700', ponto: 'bg-emerald-500' },
  pendente: { label: 'Relatório pendente', chip: 'bg-red-100 text-red-700', ponto: 'bg-red-500' },
  futuro: { label: 'Ainda não aconteceu', chip: 'bg-gray-100 text-gray-500', ponto: 'bg-gray-300' },
  'sem-escala': { label: 'Ninguém escalado', chip: 'bg-gray-50 text-gray-400', ponto: 'bg-gray-200' },
};

export interface DadosPlantoes {
  escala: EscalaItem[];
  folgas: Record<string, Folga>;
  trocas: TrocaPlantao[];
  /** Chaves `{data}_{turno}` dos plantões já encerrados. */
  encerrados: Set<string>;
}

/**
 * Status de um plantão. "Pendente" exige as três coisas: o plantão já terminou,
 * tinha gente escalada e não há registro de encerramento. Assim não se cobra
 * relatório de plantão futuro nem de dia em que ninguém trabalharia.
 */
export const statusPlantao = (
  dados: DadosPlantoes,
  dataISO: string,
  turno: Turno,
  agora: Date = new Date()
): StatusPlantao => {
  if (dados.encerrados.has(`${dataISO}_${turno}`)) return 'encerrado';
  if (!plantaoTerminou(dataISO, turno, agora)) return 'futuro';
  if (escaladosEm(dados.escala, dados.folgas, dados.trocas, dataISO, turno).length === 0) return 'sem-escala';
  return 'pendente';
};

export interface PlantaoPendente {
  data: string;
  turno: Turno;
  /** Quem deveria ter encerrado, pela escala. */
  quem: string;
  /** Dias inteiros desde que o plantão terminou. */
  diasAtraso: number;
}

/**
 * Todos os plantões pendentes num intervalo de datas. Fonte única usada pelo
 * calendário e pelo alerta do Dashboard — as duas telas nunca discordam.
 */
export const plantoesPendentes = (
  dados: DadosPlantoes,
  deISO: string,
  ateISO: string,
  agora: Date = new Date()
): PlantaoPendente[] => {
  const pendentes: PlantaoPendente[] = [];
  const [a, m, d] = deISO.split('-').map(Number);
  if (!a) return pendentes;

  const cursor = new Date(a, m - 1, d);
  let guarda = 0;
  while (guarda++ < 400) {
    const dataISO = isoDe(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    if (dataISO > ateISO) break;

    (['diurno', 'noturno'] as Turno[]).forEach((turno) => {
      if (statusPlantao(dados, dataISO, turno, agora) !== 'pendente') return;
      const fim = new Date(cursor);
      if (turno === 'diurno') fim.setHours(19, 0, 0, 0);
      else { fim.setDate(fim.getDate() + 1); fim.setHours(7, 0, 0, 0); }
      pendentes.push({
        data: dataISO,
        turno,
        quem: escaladosEm(dados.escala, dados.folgas, dados.trocas, dataISO, turno).map((x) => x.nome).join(', '),
        diasAtraso: Math.floor((agora.getTime() - fim.getTime()) / 86400000),
      });
    });

    cursor.setDate(cursor.getDate() + 1);
  }
  return pendentes;
};
