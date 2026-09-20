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