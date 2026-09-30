import React, { useEffect, useState } from 'react';
import { AlertTriangle, FileText, Pill, Calendar, ArrowRight, Coffee, MessageSquare, UserX, Repeat, CalendarX } from 'lucide-react';
import { Agendamento } from '../../interface/interface';
import { formatarDataBR } from '../../utils/datas';

export interface FolgaAlerta {
  id: string;
  tecnicoNome: string;
  data: string;
  turno?: 'diurno' | 'noturno';
  /** Ausente = folga (registros antigos). 'falta' = não compareceu ao plantão. */
  tipo?: 'folga' | 'falta';
}

/** Observação deixada pela técnica no checklist do plantão. */
export interface ObservacaoAlerta {
  id: string;
  tecnicoNome: string;
  data: string; // ISO (YYYY-MM-DD)
  turno: 'manha' | 'noite';
  observacaoGeral: string;
  itensComObservacao: number;
}

/** Tarefa esporádica da rotina que passou do prazo sem ser marcada. */
export interface RotinaPendenteAlerta {
  id: string;
  descricao: string;
  turno: 'manha' | 'noite';
  periodicidade: number;
  diasAtraso: number;
  nuncaFeita: boolean;
  vencimento: string | null;
}

/** Plantão que terminou, tinha gente escalada e não teve relatório enviado. */
export interface PlantaoPendenteAlerta {
  id: string;
  data: string;
  turno: 'diurno' | 'noturno';
  quem: string;
  diasAtraso: number;
}

interface AlertaWidgetProps {
  alertas: Agendamento[];
  folgas?: FolgaAlerta[];
  onFazerCobertura?: (folga: FolgaAlerta) => void;
  observacoes?: ObservacaoAlerta[];
  onVerObservacao?: (observacao: ObservacaoAlerta) => void;
  rotinasPendentes?: RotinaPendenteAlerta[];
  onVerRotina?: () => void;
  plantoesPendentes?: PlantaoPendenteAlerta[];
  onVerPlantoes?: () => void;
}

interface Alerta {
  id: number;
  tipo: 'exame' | 'medicamento' | 'consulta';
  mensagem: string;
  data: string;
  prioridade: 'alta' | 'media' | 'baixa';
}

const alertas: Alerta[] = [
  {
    id: 1,
    tipo: 'exame',
    mensagem: 'Resultados de exame de sangue disponíveis',
    data: '25/06/2025',
    prioridade: 'alta',
  },
  {
    id: 2,
    tipo: 'medicamento',
    mensagem: 'Reposição de medicamento necessária: Losartana',
    data: '30/06/2025',
    prioridade: 'media',
  },
  {
    id: 3,
    tipo: 'consulta',
    mensagem: 'Confirme sua consulta com Dr. João Santos',
    data: '27/06/2025',
    prioridade: 'baixa',
  },
  {
    id: 4,
    tipo: 'medicamento',
    mensagem: 'Você não tomou seu medicamento: Atorvastatina',
    data: 'Hoje',
    prioridade: 'alta',
  },
];

const AlertasWidget: React.FC<AlertaWidgetProps> = ({
  alertas,
  folgas,
  onFazerCobertura,
  observacoes,
  onVerObservacao,
  rotinasPendentes,
  onVerRotina,
  plantoesPendentes,
  onVerPlantoes,
  }) => {

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <AlertTriangle size={20} className="text-amber-500 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800">Alertas e Lembretes</h2>
        </div>
        <button className="text-sm text-primary-600 hover:text-primary-700">Ver todos</button>
      </div>

      {/* Plantões sem relatório enviado */}
      {plantoesPendentes && plantoesPendentes.length > 0 && (
        <div className="space-y-3 mb-3">
          {plantoesPendentes.map((p) => (
            <div key={p.id} className="p-4 border rounded-lg bg-red-50 border-red-100 flex items-start space-x-3">
              <div className="p-2 rounded-full bg-red-100 text-red-600 shrink-0">
                <CalendarX size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">Relatório de plantão pendente</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatarDataBR(p.data)} · {p.turno === 'noturno' ? 'Noturno' : 'Diurno'}
                  {p.quem ? ` · ${p.quem}` : ''} · {p.diasAtraso} dia(s) sem envio
                </p>
              </div>
              <button
                onClick={() => onVerPlantoes?.()}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              >
                Ver
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tarefas esporádicas da rotina que passaram do prazo. Visível para
          todos os papéis — é cobrança da casa inteira, não de uma pessoa. */}
      {rotinasPendentes && rotinasPendentes.length > 0 && (
        <div className="space-y-3 mb-3">
          {rotinasPendentes.map((r) => (
            <div key={r.id} className="p-4 border rounded-lg bg-red-50 border-red-100 flex items-start space-x-3">
              <div className="p-2 rounded-full bg-red-100 text-red-600 shrink-0">
                <Repeat size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  Rotina de {r.periodicidade} dias pendente
                </p>
                <p className="text-sm text-gray-700 mt-0.5">{r.descricao}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {r.turno === 'noite' ? 'Turno da noite' : 'Turno da manhã'}
                  {r.nuncaFeita
                    ? ' · nunca realizada'
                    : ` · ${r.diasAtraso} dia(s) de atraso${r.vencimento ? ` (venceu em ${formatarDataBR(r.vencimento)})` : ''}`}
                </p>
              </div>
              <button
                onClick={() => onVerRotina?.()}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              >
                Ver rotina
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Observações deixadas pela técnica no checklist do plantão */}
      {observacoes && observacoes.length > 0 && (
        <div className="space-y-3 mb-3">
          {observacoes.map((o) => (
            <div key={o.id} className="p-4 border rounded-lg bg-blue-50 border-blue-100 flex items-start space-x-3">
              <div className="p-2 rounded-full bg-blue-100 text-blue-600 shrink-0">
                <MessageSquare size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  {o.tecnicoNome || 'A técnica'} deixou uma observação no plantão
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatarDataBR(o.data)} · {o.turno === 'noite' ? 'Noite' : 'Manhã'}
                </p>
                {o.observacaoGeral && (
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-line line-clamp-3">{o.observacaoGeral}</p>
                )}
                {o.itensComObservacao > 0 && (
                  <p className="text-xs text-blue-700 mt-1">
                    +{o.itensComObservacao} observação(ões) em itens do checklist
                  </p>
                )}
              </div>
              <button
                onClick={() => onVerObservacao?.(o)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              >
                Ver observação
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Folgas solicitadas aguardando cobertura */}
      {folgas && folgas.length > 0 && (
        <div className="space-y-3 mb-3">
          {folgas.map((f) => {
            const falta = f.tipo === 'falta';
            return (
            <div key={f.id} className={`p-4 border rounded-lg flex items-start space-x-3 ${falta ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
              <div className={`p-2 rounded-full shrink-0 ${falta ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                {falta ? <UserX size={18} /> : <Coffee size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  {falta ? `${f.tecnicoNome} não compareceu ao plantão` : `${f.tecnicoNome} solicitou folga`}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatarDataBR(f.data)}{f.turno ? ` · ${f.turno === 'noturno' ? 'Noturno' : 'Diurno'}` : ''}
                </p>
              </div>
              <button
                onClick={() => onFazerCobertura?.(f)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              >
                Fazer cobertura
              </button>
            </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
  {/*       {alertas.map((alerta) => (
          <div 
            key={alerta.id} 
            className={`p-4 border rounded-lg flex items-start space-x-3 ${
              alerta.prioridade === 'alta' 
                ? 'bg-red-50 border-red-100' 
                : alerta.prioridade === 'media'
                ? 'bg-amber-50 border-amber-100'
                : 'bg-blue-50 border-blue-100'
            }`}
          >
            <div className={`p-2 rounded-full ${
              alerta.tipo === 'exame' 
                ? 'bg-purple-100 text-purple-600' 
                : alerta.tipo === 'medicamento'
                ? 'bg-green-100 text-green-600'
                : 'bg-blue-100 text-blue-600'
            }`}>
              {alerta.tipo === 'exame' && <FileText size={18} />}
              {alerta.tipo === 'medicamento' && <Pill size={18} />}
              {alerta.tipo === 'consulta' && <Calendar size={18} />}
            </div>
            
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{alerta.mensagem}</p>
              <p className="text-xs text-gray-500 mt-1">{alerta.data}</p>
            </div>
            
            <button className="text-gray-400 hover:text-primary-600">
              <ArrowRight size={16} />
            </button>
          </div>
        ))} */}

        {(!alertas || alertas.length === 0) ? (
          (!folgas || folgas.length === 0) &&
          (!observacoes || observacoes.length === 0) &&
          (!rotinasPendentes || rotinasPendentes.length === 0) &&
          (!plantoesPendentes || plantoesPendentes.length === 0) && <p className="text-sm text-gray-500">Nenhum alerta no momento 🎉</p>
        ) : (
          alertas.map((alerta) => (
            <div 
              key={alerta.id} 
              className={`p-4 border rounded-lg flex items-start space-x-3 ${
                alerta.tipo === 'exame'
                ? 'bg-red-50 border-red-100'
                : alerta.tipo === 'consulta'
                ? 'bg-amber-50 border-amber-100'
                : 'bg-blue-50 border-blue-100'
            }`}
            >
              <div className={`p-2 rounded-full ${
                alerta.tipo === 'exame' 
                  ? 'bg-purple-100 text-purple-600' 
                  : alerta.tipo === 'medicamento'
                  ? 'bg-green-100 text-green-600'
                  : 'bg-blue-100 text-blue-600'
              }`}>
                {alerta.tipo === 'exame' && <FileText size={18} />}
                {alerta.tipo === 'medicamento' && <Pill size={18} />}
                {alerta.tipo === 'consulta' && <Calendar size={18} />}
              </div>
              
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{alerta.tipo === 'exame' ? 'Marque seu exame de ' + alerta.titulo : 'Marque sua Consulta '+ alerta.titulo }</p>
                <p className="text-xs text-gray-500 mt-1">{formatarDataBR(alerta.data)}</p>
              </div>
              
              <button className="text-gray-400 hover:text-primary-600">
                <ArrowRight size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AlertasWidget;