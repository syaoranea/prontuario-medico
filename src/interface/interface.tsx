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
    mensagem: string;
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
    data: string;
    valor: number;
  }

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