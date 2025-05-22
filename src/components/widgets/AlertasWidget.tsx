import React from 'react';
import { AlertTriangle, FileText, Pill, Calendar, ArrowRight } from 'lucide-react';

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

const AlertasWidget: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <AlertTriangle size={20} className="text-amber-500 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800">Alertas e Lembretes</h2>
        </div>
        <button className="text-sm text-primary-600 hover:text-primary-700">Ver todos</button>
      </div>
      
      <div className="space-y-3">
        {alertas.map((alerta) => (
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
        ))}
      </div>
    </div>
  );
};

export default AlertasWidget;