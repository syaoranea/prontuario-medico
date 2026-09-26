import { MovimentoSuprimento, Suprimento } from '../interface/interface';

/**
 * Regras de saldo do estoque.
 *
 * O saldo NUNCA é um campo gravado: é sempre a soma dos movimentos daquele
 * suprimento. Isso mantém o histórico íntegro (movimento é imutável) e deixa a
 * baixa automática e o ajuste manual conviverem sem um sobrescrever o outro.
 */

export type NivelEstoque = 'ok' | 'atencao' | 'critico' | 'zerado';

export const TIPO_LABEL: Record<MovimentoSuprimento['tipo'], string> = {
  entrada: 'Entrada',
  consumo: 'Consumo',
  ajuste: 'Ajuste',
  contagem: 'Contagem',
};

export const CATEGORIA_LABEL: Record<Suprimento['categoria'], string> = {
  material: 'Material',
  medicamento: 'Medicamento',
  higiene: 'Higiene',
};

/** Soma dos movimentos por suprimentoId. */
export const saldosPorSuprimento = (movimentos: MovimentoSuprimento[]): Record<string, number> => {
  const saldos: Record<string, number> = {};
  movimentos.forEach((m) => {
    saldos[m.suprimentoId] = (saldos[m.suprimentoId] ?? 0) + (Number(m.quantidade) || 0);
  });
  return saldos;
};

/** Quantos dias o saldo ainda cobre. null quando não há consumo diário definido. */
export const diasRestantes = (saldo: number, consumoDiario: number): number | null => {
  if (!consumoDiario || consumoDiario <= 0) return null;
  return Math.floor(saldo / consumoDiario);
};

/** Semáforo do card: zerado, crítico (metade do alerta), atenção, ok. */
export const nivelDe = (saldo: number, dias: number | null, alertaDias: number): NivelEstoque => {
  if (saldo <= 0) return 'zerado';
  if (dias === null) return 'ok';
  if (dias <= Math.ceil(alertaDias / 2)) return 'critico';
  if (dias <= alertaDias) return 'atencao';
  return 'ok';
};

/** Converte uma entrada informada em embalagens para unidades de consumo. */
export const emUnidades = (quantidade: number, emEmbalagens: boolean, sup: Suprimento): number => {
  if (!emEmbalagens) return quantidade;
  return quantidade * (sup.qtdPorEmbalagem || 1);
};

/** Necessidade mensal para pedir ao convênio (base 31 dias). */
export const necessidadeMensal = (consumoDiario: number, dias = 31): number =>
  Math.ceil(consumoDiario * dias);

/** Formata quantidade sem casas decimais desnecessárias (6,5 un / 13 un). */
export const formatarQtd = (valor: number): string =>
  Number.isInteger(valor) ? String(valor) : valor.toFixed(1).replace('.', ',');
