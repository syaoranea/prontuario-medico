import React from 'react';
import { CalendarCheck, Heart, TrendingUp, ClipboardList, Pill, AlertCircle } from 'lucide-react';
import MetricasWidget from '../components/widgets/MetricasWidget';
import ProximosAgendamentosWidget from '../components/widgets/ProximosAgendamentosWidget';
import MedicamentosWidget from '../components/widgets/MedicamentosWidget';
import AlertasWidget from '../components/widgets/AlertasWidget';
import { useUsuario } from '../config/bd/userContext';

const Dashboard: React.FC = () => {
  const usuario = useUsuario();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Olá, {usuario?.nome ?? "Carregando..."}</h1>
        <p className="text-sm text-gray-500">
          Última atualização: {new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
            <CalendarCheck size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Próxima Consulta</p>
            <p className="font-semibold">28/06/2025</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-red-50 text-red-600">
            <Heart size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Pressão Arterial</p>
            <p className="font-semibold">120/80 mmHg</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-green-50 text-green-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Glicemia</p>
            <p className="font-semibold">95 mg/dL</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
            <ClipboardList size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Exames Pendentes</p>
            <p className="font-semibold">3</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricasWidget />
        <ProximosAgendamentosWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MedicamentosWidget />
        <AlertasWidget />
      </div>
    </div>
  );
};

export default Dashboard;