import React from 'react';
import { Pill, Clock, Check, X } from 'lucide-react';
import { Medicamento } from '../../interface/interface';

/* interface Medicamento {
  id: number;
  nome: string;
  dosagem: string;
  frequencia: string;
  horarios: string[];
  status: 'tomado' | 'pendente' | 'atrasado';
}

const medicamentos: Medicamento[] = [
  {
    id: 1,
    nome: 'Losartana',
    dosagem: '50mg',
    frequencia: 'Diário',
    horarios: ['08:00', '20:00'],
    status: 'tomado',
  },
  {
    id: 2,
    nome: 'Metformina',
    dosagem: '500mg',
    frequencia: 'Diário',
    horarios: ['12:00'],
    status: 'pendente',
  },
  {
    id: 3,
    nome: 'Atorvastatina',
    dosagem: '20mg',
    frequencia: 'Diário',
    horarios: ['22:00'],
    status: 'atrasado',
  },
]; */
interface MedicamentoWidgetProps {
  medicamentos: Medicamento[];
}

const MedicamentosWidget: React.FC<MedicamentoWidgetProps> = ({
  medicamentos,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Medicamentos</h2>
        <button className="text-sm text-primary-600 hover:text-primary-700">Gerenciar</button>
      </div>
      
      <div className="space-y-4">
        {medicamentos.map((medicamento) => (
          <div 
            key={medicamento.id} 
            className={`p-4 border rounded-lg transition-colors ${
              medicamento.status === 'atrasado' 
                ? 'border-red-200 bg-red-50' 
                : medicamento.status === 'tomado'
                ? 'border-gray-100 bg-gray-50'
                : 'border-gray-100 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg mr-3 ${
                  medicamento.status === 'atrasado' 
                    ? 'bg-red-100 text-red-600' 
                    : medicamento.status === 'tomado'
                    ? 'bg-green-100 text-green-600'
                    : 'bg-blue-100 text-blue-600'
                }`}>
                  <Pill size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">{medicamento.nome}</h3>
                  <p className="text-sm text-gray-500">{medicamento.dosagem} - {medicamento.frequencia}</p>
                </div>
              </div>
              
              {medicamento.status === 'pendente' && (
                <button className="bg-primary-100 text-primary-600 hover:bg-primary-200 p-2 rounded-full transition-colors">
                  <Check size={18} />
                </button>
              )}
            </div>
            
            <div className="mt-3 flex flex-wrap gap-2">
              {medicamento.horarios.map((horario, index) => (
                <div 
                  key={index} 
                  className={`flex items-center text-xs rounded-full px-3 py-1 ${
                    medicamento.status === 'tomado' 
                      ? 'bg-green-100 text-green-700' 
                      : medicamento.status === 'atrasado'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <Clock size={12} className="mr-1" />
                  {horario}
                  
                  {medicamento.status === 'tomado' && (
                    <Check size={12} className="ml-1 text-green-600" />
                  )}
                  
                  {medicamento.status === 'atrasado' && (
                    <X size={12} className="ml-1 text-red-600" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6">
        <button className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:text-primary-600 hover:border-primary-300 transition-colors">
          + Adicionar medicamento
        </button>
      </div>
    </div>
  );
};

export default MedicamentosWidget;