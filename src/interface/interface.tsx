export interface Agendamento {
  id: string;
  tipo: 'consulta' | 'exame' | 'procedimento' | 'medicamento';
  titulo: string;
  data: string;
  hora: string;
  duracao: string;
  local: string;
  endereco: string;
  profissional: string;
  especialidade: string;
  observacoes: string;
  status: 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'pendente';
  prioridade: string;
  mensagem?: string;
}

export interface Metrica {
  id: string;
  nome: string;
  descricao: string;
  unidade: string;
  corGrafico: string;
  meta?: {
    min?: number;
    max?: number;
    alvo?: number;
  };
  registros: MetricaData[];
  ultimaAtualizacao: string;
}

export interface MetricaData {
  id?: string;
  data: string;
  valor: number;
}

export interface Medicamento {
  id: string;
  nome: string;
  dosagem: string;
  instrucoes: string;
  frequencia: string;
  horarios: string[];
  inicio: string;
  fim: string | null;
  estoque: number;
  medico: string;
  status: 'ativo' | 'pausado' | 'finalizado';
}

export interface Profissional {
  id: string;
  nome: string;
  tipo: 'Médico' | 'Fisioterapeuta' | 'Enfermeiro' | 'Cuidador';
  especialidade?: string;
  registro?: string; // CRM, COREN, etc
  contato: string;
  email?: string;
  pix?: string;
  foto?: string;
}

export interface Tecnico {
  id: string;
  nome: string;
  telefone?: string;
  registro?: string; // COREN
  turnoPreferencial?: 'manha' | 'noite' | 'ambos';
  ativo: boolean;
}

export interface RotinaItem {
  id: string;
  turno: 'manha' | 'noite';
  secao: string;
  horario: string;
  descricao: string;
  responsavel: 'tecnico' | 'enfermeiro' | 'paciente' | 'fisioterapeuta' | 'urgencia';
  ordem: number;
  ativo: boolean;
}

export interface ItemExecucao {
  rotinaItemId: string;
  concluido: boolean;
  observacao: string;
  horarioConcluido?: string;
}

/** Item de consumo do home care (sonda, luva, pró-pé, soro...). */
export interface Suprimento {
  id: string;
  nome: string;
  categoria: 'material' | 'medicamento' | 'higiene';
  /** Unidade de consumo: 'un', 'pc', 'bolsa', 'ampola'... */
  unidade: string;
  /** Embalagem de compra, quando o item vem em caixa/pacote. */
  unidadeCompra?: string;
  /** Quantas unidades vêm em cada embalagem de compra. */
  qtdPorEmbalagem?: number;
  /** Quantidade consumida por dia — base da baixa automática (fase 2). */
  consumoDiario: number;
  /** Avisar quando faltarem menos que estes dias de estoque. */
  alertaDias: number;
  ativo: boolean;
}

/**
 * Livro-razão do estoque: o saldo é a SOMA dos movimentos, nunca um campo
 * sobrescrito. `quantidade` é sempre assinada (entra positivo, sai negativo).
 * Movimento é imutável — erro se corrige com outro movimento.
 */
export interface MovimentoSuprimento {
  id: string;
  suprimentoId: string;
  tipo: 'entrada' | 'consumo' | 'ajuste' | 'contagem';
  quantidade: number;
  data: string; // YYYY-MM-DD
  origem: 'automatico' | 'manual' | 'dispensacao';
  quem: string;
  quemNome: string;
  criadoEm: string;
  observacao?: string;
}

export interface RotinaExecucao {
  id: string;
  data: string; // YYYY-MM-DD
  turno: 'manha' | 'noite';
  auxiliar: string;
  itens: ItemExecucao[];
  observacaoGeral: string;
  criadoEm: string;
  atualizadoEm: string;
  /** Quando a técnica fechou o card de parabéns do plantão 100% (ISO). */
  parabensVistoEm?: string;
}