import React from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';

interface Agendamento {
  id: number;
  tipo: string;
  data: string;
  hora: string;
  local: string;
  medico: string;
  especialidade: string;
}

const agendamentos: Agendamento[] = [
  {
    id: 1,
    tipo: 'Consulta',
    data: '28/06/2025',
    hora: '14:30',
    local: 'Hospital Santa Lucia',
    medico: 'Dr. João Santos',
    especialidade: 'Cardiologia',
  },
  {
    id: 2,
    tipo: 'Exame',
    data: '03/07/2025',
    hora: '08:15',
    local: 'Laboratório Central',
    medico: '',
    especialidade: 'Hemograma Completo',
  },
  {
    id: 3,
    tipo: 'Consulta',
    data: '15/07/2025',
    hora: '10:00',
    local: 'Clínica Vida Plena',
    medico: 'Dra. Ana Ferreira',
    especialidade: 'Nutrição',
  },
];

const ProximosAgendamentosWidget: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Próximos Agendamentos</h2>
        <button className="text-sm text-primary-600 hover:text-primary-700">Ver todos</button>
      </div>
      
      <div className="space-y-4">
        {agendamentos.map((agendamento) => (
          <div 
            key={agendamento.id} 
            className="p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                  agendamento.tipo === 'Consulta' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {agendamento.tipo}
                </span>
                <h3 className="mt-2 font-medium">
                  {agendamento.tipo === 'Consulta' 
                    ? `${agendamento.especialidade} - ${agendamento.medico}` 
                    : agendamento.especialidade}
                </h3>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                {/* Menu de opções */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
            </div>
            
            <div className="mt-3 grid grid-cols-1 gap-2">
              <div className="flex items-center text-sm text-gray-600">
                <Calendar size={16} className="mr-2 text-gray-400" />
                <span>{agendamento.data} às {agendamento.hora}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <MapPin size={16} className="mr-2 text-gray-400" />
                <span>{agendamento.local}</span>
              </div>
            </div>
            
            {agendamento.id === 1 && (
              <div className="mt-3 flex justify-end space-x-2">
                <button className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 transition-colors">
                  Reagendar
                </button>
                <button className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors">
                  Confirmar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProximosAgendamentosWidget;