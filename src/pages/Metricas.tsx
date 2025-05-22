import React, { useState } from 'react';
import { Calendar, LineChart as LineChartIcon, PlusCircle } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface MetricaData {
  data: string;
  valor: number;
}

interface Metrica {
  id: number;
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

const metricas: Metrica[] = [
  {
    id: 1,
    nome: 'Pressão Arterial (Sistólica)',
    descricao: 'Registro da pressão arterial sistólica',
    unidade: 'mmHg',
    corGrafico: '#0A6EBD',
    meta: {
      min: 90,
      max: 140,
      alvo: 120,
    },
    registros: [
      { data: '01/06', valor: 122 },
      { data: '05/06', valor: 125 },
      { data: '10/06', valor: 118 },
      { data: '15/06', valor: 120 },
      { data: '20/06', valor: 123 },
      { data: '25/06', valor: 119 },
    ],
    ultimaAtualizacao: '25/06/2025',
  },
  {
    id: 2,
    nome: 'Pressão Arterial (Diastólica)',
    descricao: 'Registro da pressão arterial diastólica',
    unidade: 'mmHg',
    corGrafico: '#12B886',
    meta: {
      min: 60,
      max: 90,
      alvo: 80,
    },
    registros: [
      { data: '01/06', valor: 82 },
      { data: '05/06', valor: 84 },
      { data: '10/06', valor: 79 },
      { data: '15/06', valor: 80 },
      { data: '20/06', valor: 83 },
      { data: '25/06', valor: 80 },
    ],
    ultimaAtualizacao: '25/06/2025',
  },
  {
    id: 3,
    nome: 'Glicemia em Jejum',
    descricao: 'Nível de glicose no sangue após jejum de 8 horas',
    unidade: 'mg/dL',
    corGrafico: '#F59E0B',
    meta: {
      min: 70,
      max: 100,
      alvo: 90,
    },
    registros: [
      { data: '01/06', valor: 92 },
      { data: '08/06', valor: 95 },
      { data: '15/06', valor: 88 },
      { data: '22/06', valor: 93 },
      { data: '29/06', valor: 91 },
    ],
    ultimaAtualizacao: '29/06/2025',
  },
  {
    id: 4,
    nome: 'Peso',
    descricao: 'Registro de peso corporal',
    unidade: 'kg',
    corGrafico: '#7C3AED',
    meta: {
      min: 65,
      max: 70,
      alvo: 67,
    },
    registros: [
      { data: '01/06', valor: 68.2 },
      { data: '08/06', valor: 67.9 },
      { data: '15/06', valor: 67.5 },
      { data: '22/06', valor: 67.2 },
      { data: '29/06', valor: 66.8 },
    ],
    ultimaAtualizacao: '29/06/2025',
  },
];

const Metricas: React.FC = () => {
  const [metricaAtiva, setMetricaAtiva] = useState<number>(1);
  const [periodoFiltro, setPeriodoFiltro] = useState<string>('ultimo-mes');
  
  const metricaSelecionada = metricas.find(m => m.id === metricaAtiva) || metricas[0];
  
  const chartData = {
    labels: metricaSelecionada.registros.map(r => r.data),
    datasets: [
      {
        label: metricaSelecionada.nome,
        data: metricaSelecionada.registros.map(r => r.valor),
        borderColor: metricaSelecionada.corGrafico,
        backgroundColor: `${metricaSelecionada.corGrafico}20`,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: metricaSelecionada.corGrafico,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };
  
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#1F2937',
        bodyColor: '#4B5563',
        borderColor: '#E5E7EB',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: {
          label: function(context: any) {
            return `${context.raw} ${metricaSelecionada.unidade}`;
          }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: {
          color: '#F3F4F6',
        },
        ticks: {
          font: {
            size: 12,
          },
          color: '#6B7280',
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 12,
          },
          color: '#6B7280',
        },
      },
    },
    elements: {
      line: {
        borderWidth: 2,
      },
      point: {
        hitRadius: 8,
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Métricas de Saúde</h1>
        
        <button className="mt-4 md:mt-0 inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          <PlusCircle size={16} className="mr-2" />
          Registrar Nova Medição
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-4">
          <div className="inline-flex flex-wrap gap-2">
            {metricas.map((metrica) => (
              <button
                key={metrica.id}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  metricaAtiva === metrica.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setMetricaAtiva(metrica.id)}
              >
                {metrica.nome}
              </button>
            ))}
          </div>
          
          <div className="inline-flex items-center">
            <Calendar size={16} className="mr-2 text-gray-400" />
            <select
              className="py-1.5 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={periodoFiltro}
              onChange={(e) => setPeriodoFiltro(e.target.value)}
            >
              <option value="ultima-semana">Última Semana</option>
              <option value="ultimo-mes">Último Mês</option>
              <option value="ultimos-3-meses">Últimos 3 Meses</option>
              <option value="ultimos-6-meses">Últimos 6 Meses</option>
              <option value="ultimo-ano">Último Ano</option>
            </select>
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{metricaSelecionada.nome}</h2>
              <p className="text-sm text-gray-500">{metricaSelecionada.descricao}</p>
            </div>
            
            <div className="mt-3 md:mt-0 flex items-center">
              <div className="bg-gray-100 px-3 py-1 rounded-lg">
                <span className="text-sm text-gray-600">Última medição: </span>
                <span className="font-medium">
                  {metricaSelecionada.registros[metricaSelecionada.registros.length - 1]?.valor} {metricaSelecionada.unidade}
                </span>
              </div>
              <span className="mx-2 text-sm text-gray-500">•</span>
              <span className="text-sm text-gray-500">
                Atualizado em {metricaSelecionada.ultimaAtualizacao}
              </span>
            </div>
          </div>
          
          <div className="h-80">
            <Line data={chartData} options={chartOptions} />
          </div>
          
          {metricaSelecionada.meta && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <h3 className="font-medium text-gray-700 mb-2">Metas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {metricaSelecionada.meta.min && (
                  <div className="bg-white p-3 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Mínimo recomendado</p>
                    <p className="text-lg font-semibold text-blue-600">{metricaSelecionada.meta.min} {metricaSelecionada.unidade}</p>
                  </div>
                )}
                
                {metricaSelecionada.meta.alvo && (
                  <div className="bg-white p-3 rounded-lg border border-primary-100">
                    <p className="text-xs text-gray-500 mb-1">Valor ideal</p>
                    <p className="text-lg font-semibold text-primary-600">{metricaSelecionada.meta.alvo} {metricaSelecionada.unidade}</p>
                  </div>
                )}
                
                {metricaSelecionada.meta.max && (
                  <div className="bg-white p-3 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Máximo recomendado</p>
                    <p className="text-lg font-semibold text-red-600">{metricaSelecionada.meta.max} {metricaSelecionada.unidade}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="mt-6">
            <h3 className="font-medium text-gray-700 mb-3">Histórico de Medições</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {metricaSelecionada.registros.slice().reverse().map((registro, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {registro.data}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {registro.valor} {metricaSelecionada.unidade}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {metricaSelecionada.meta ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            registro.valor < (metricaSelecionada.meta.min || 0)
                              ? 'bg-blue-100 text-blue-800'
                              : registro.valor > (metricaSelecionada.meta.max || Infinity)
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {registro.valor < (metricaSelecionada.meta.min || 0)
                              ? 'Abaixo do ideal'
                              : registro.valor > (metricaSelecionada.meta.max || Infinity)
                              ? 'Acima do ideal'
                              : 'Dentro do ideal'}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Metricas;