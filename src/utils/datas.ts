import dayjs, { Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/pt-br';

dayjs.extend(customParseFormat);
dayjs.locale('pt-br');

/**
 * Utilitário central de datas.
 *
 * Contexto: as coleções antigas gravaram datas em formatos diferentes
 * (YYYY-MM-DD, DD/MM/YYYY, Timestamp do Firestore, ISO completo). Estas funções
 * TOLERAM todos esses formatos na LEITURA e produzem uma saída consistente.
 *
 * Padrão de GRAVAÇÃO para campos só-data daqui em diante: `YYYY-MM-DD` (ISO,
 * ordenável como string e sem ambiguidade dia/mês). Ver `paraISO` / `hojeISO`.
 */

type FirestoreTimestampLike = { toDate: () => Date };
export type EntradaData = string | number | Date | FirestoreTimestampLike | null | undefined;

const ehTimestamp = (v: unknown): v is FirestoreTimestampLike =>
  typeof v === 'object' && v !== null && typeof (v as FirestoreTimestampLike).toDate === 'function';

// Formatos conhecidos usados historicamente no app, tentados em modo estrito.
const FORMATOS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'YYYY-MM-DDTHH:mm', 'DD/MM/YYYY HH:mm'];

/** Converte qualquer formato usado no app em um Dayjs válido — ou null. */
export function parseData(valor: EntradaData): Dayjs | null {
  if (valor === null || valor === undefined || valor === '') return null;

  if (ehTimestamp(valor)) {
    const d = dayjs(valor.toDate());
    return d.isValid() ? d : null;
  }
  if (valor instanceof Date || typeof valor === 'number') {
    const d = dayjs(valor);
    return d.isValid() ? d : null;
  }

  const s = String(valor).trim();
  for (const f of FORMATOS) {
    const d = dayjs(s, f, true);
    if (d.isValid()) return d;
  }
  // Fallback: deixa o dayjs tentar interpretar (ISO completo, etc.)
  const d = dayjs(s);
  return d.isValid() ? d : null;
}

/** Padrão de gravação: 'YYYY-MM-DD' (string vazia se não parsear). */
export function paraISO(valor: EntradaData): string {
  const d = parseData(valor);
  return d ? d.format('YYYY-MM-DD') : '';
}

/** Exibição BR: '30/09/2025'. Se não parsear, devolve o valor original (não perde dado). */
export function formatarDataBR(valor: EntradaData): string {
  const d = parseData(valor);
  if (d) return d.format('DD/MM/YYYY');
  return valor ? String(valor) : '—';
}

/** Exibição BR com hora: '30/09/2025 14:05'. */
export function formatarDataHoraBR(valor: EntradaData): string {
  const d = parseData(valor);
  if (d) return d.format('DD/MM/YYYY HH:mm');
  return valor ? String(valor) : '—';
}

/** Exibição por extenso: '30 de setembro de 2025'. */
export function formatarDataExtenso(valor: EntradaData): string {
  const d = parseData(valor);
  if (d) return d.format('D [de] MMMM [de] YYYY');
  return valor ? String(valor) : '—';
}

/** Chave numérica para ordenar (0 quando inválida). */
export function ordinalData(valor: EntradaData): number {
  const d = parseData(valor);
  return d ? d.valueOf() : 0;
}

/** Data local de hoje em ISO. Evita o bug do toISOString() (que usa UTC). */
export function hojeISO(): string {
  return dayjs().format('YYYY-MM-DD');
}

/**
 * true se a data de fim (com 1 dia de tolerância) ainda não passou.
 * Usado para decidir se um medicamento continua "vigente".
 */
export function dataFimVigente(valor: EntradaData): boolean {
  const d = parseData(valor);
  if (!d) return true; // sem data de fim válida => mantém como vigente
  return !d.add(1, 'day').isBefore(dayjs().startOf('day'));
}

/**
 * true se a data ainda não passou e falta MENOS de um mês para ela
 * (hoje <= data < hoje + 1 mês). Usado para lembrar consultas que se aproximam.
 */
export function faltaMenosDeUmMes(valor: EntradaData): boolean {
  const d = parseData(valor);
  if (!d) return false;
  const hoje = dayjs().startOf('day');
  const alvo = d.startOf('day');
  return !alvo.isBefore(hoje) && alvo.isBefore(hoje.add(1, 'month'));
}
