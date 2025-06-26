import React, { useEffect, useState } from 'react';
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

import { db } from '../config/firebase';
  import { onSnapshot, query, collection, orderBy, addDoc , Timestamp, getDocs} from 'firebase/firestore';
import { Metrica, MetricaData } from '../interface/interface';
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);
interface Registro {
  valor: number;
  data: Date;
  observacoes?: string;
}


/* const metricas: Metrica[] = [
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
]; */

const Metricas: React.FC = () => {
  const [metricaAtiva, setMetricaAtiva] = useState<string>('');
  const [periodoFiltro, setPeriodoFiltro] = useState<string>('ultimo-mes');
  const [showModal, setShowModal] = useState(false);
  const [novoValor, setNovoValor] = useState('');
  const [novaData, setNovaData] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [dadosGrafico, setDadosGrafico] = useState<any[]>([]);
const [dadosTabela, setDadosTabela] = useState<MetricaData[]>([]);
  

  
  const metricaSelecionada = metricas.find(m => m.id === metricaAtiva) || metricas[0];
  

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'metricas'), async (snapshot) => {
      const metricasFirebase: Metrica[] = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          const registrosSnapshot = await getDocs(
            query(
              collection(db, 'metricas', doc.id, 'registros'),
              orderBy('data', 'asc') // importante: ordene por data
            )
          );
  
          const registros: MetricaData[] = registrosSnapshot.docs.map((reg) => {
            const regData = reg.data();
            let dataObj: Date;
          
            if (regData.data?.toDate) {
              dataObj = regData.data.toDate(); // Firestore Timestamp
            } else {
              dataObj = new Date(regData.data); // fallback
            }
          
            return {
              data: dataObj.toISOString(),  // retorna string ISO padrão
              valor: regData.valor,
            };
          });
          
          
  
          return {
            id: doc.id,
            nome: data.nome,
            descricao: data.descricao,
            unidade: data.unidade,
            corGrafico: data.corGrafico,
            meta: data.meta,
            registros,
            ultimaAtualizacao: data.ultimaAtualizacao || '',
          };
        })
      );

      setMetricas(metricasFirebase);
  
      if (metricasFirebase.length > 0 && !metricaAtiva) {
        setMetricaAtiva(metricasFirebase[0].id);
      }
    });
  
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const metrica = metricas.find((m) => m.id === metricaAtiva);
    if (metrica) {
      setDadosTabela(metrica.registros);
      setDadosGrafico(
        metrica.registros.map((r) => ({
          name: r.data,
          valor: r.valor
        }))
      );
    }
  }, [metricaAtiva, metricas]);
  

  const salvarRegistro = async (idMetrica: string, novoRegistro: Registro) => {
    try {
      const registrosRef = collection(db, 'metricas', idMetrica, 'registros');
      await addDoc(registrosRef, {
        ...novoRegistro,
        data: Timestamp.fromDate(novoRegistro.data), // importante converter
      });
      console.log('Registro salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar registro:', error);
    }
  };
  
  const registrarMedicao = async () => {
    if (!novaData || !novoValor || !metricaSelecionada) {
      alert("Preencha todos os campos corretamente.");
      return;
    }
  
    setCarregando(true);
  
    try {
      console.log('novaData:', novaData); // deve ser algo como "2025-06-07"
    const data = new Date(`${novaData}T00:00:00`);
    console.log('Objeto Date gerado:', data);

    const registro: Registro = {
      data,
      valor: parseFloat(novoValor),
    };
  
      await salvarRegistro(metricaSelecionada.id, registro);
  
      // Resetar os campos do modal
      setNovaData('');
      setNovoValor('');
      setShowModal(false);
    } catch (error) {
      console.error("Erro ao registrar medição:", error);
      alert("Erro ao salvar medição.");
    } finally {
      setCarregando(false);
    }
  };
  

  
  const chartData = {
    labels: dadosGrafico.map((d) => d.name),  // d.name já é 'dd/mm'
    datasets: [
      {
        label: metricaSelecionada?.nome,
        data: dadosGrafico.map((d) => d.valor),
        borderColor: metricaSelecionada?.corGrafico,
        backgroundColor: `${metricaSelecionada?.corGrafico}20`,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: metricaSelecionada?.corGrafico,
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
        time: {
          unit: 'day',
          tooltipFormat: 'dd/MM/yyyy',
          displayFormats: {
            day: 'dd/MM/yyyy',
          },
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

        <button
          className="mt-4 md:mt-0 inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          onClick={() => setShowModal(true)}
        >
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
        
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Nova Medição - {metricaSelecionada?.nome}</h2>
              
              <div className="space-y-4">
                <input
                  type="date"
                  className="w-full border border-gray-300 p-2 rounded"
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                />
                <input
                  type="number"
                  className="w-full border border-gray-300 p-2 rounded"
                  placeholder={`Valor (${metricaSelecionada?.unidade})`}
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded"
                  onClick={() => setShowModal(false)}
                  disabled={carregando}
                >
                  Cancelar
                </button>
                <button
                  className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                  onClick={registrarMedicao}
                  disabled={carregando}
                >
                  {carregando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{metricaSelecionada?.nome}</h2>
              <p className="text-sm text-gray-500">{metricaSelecionada?.descricao}</p>
            </div>
            
            <div className="mt-3 md:mt-0 flex items-center">
              <div className="bg-gray-100 px-3 py-1 rounded-lg">
                <span className="text-sm text-gray-600">Última medição: </span>
                <span className="font-medium">
                  {metricaSelecionada?.registros[metricaSelecionada?.registros.length - 1]?.valor} {metricaSelecionada?.unidade}
                </span>
              </div>
              <span className="mx-2 text-sm text-gray-500">•</span>
              <span className="text-sm text-gray-500">
                Atualizado em {metricaSelecionada?.ultimaAtualizacao}
              </span>
            </div>
          </div>
          
          <div className="h-80">
            <Line data={chartData} options={chartOptions} />
          </div>
          
          {metricaSelecionada?.meta && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <h3 className="font-medium text-gray-700 mb-2">Metas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {metricaSelecionada.meta.min && (
                  <div className="bg-white p-3 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Mínimo recomendado</p>
                    <p className="text-lg font-semibold text-blue-600">{metricaSelecionada?.meta.min} {metricaSelecionada?.unidade}</p>
                  </div>
                )}
                
                {metricaSelecionada.meta.alvo && (
                  <div className="bg-white p-3 rounded-lg border border-primary-100">
                    <p className="text-xs text-gray-500 mb-1">Valor ideal</p>
                    <p className="text-lg font-semibold text-primary-600">{metricaSelecionada?.meta.alvo} {metricaSelecionada?.unidade}</p>
                  </div>
                )}
                
                {metricaSelecionada.meta.max && (
                  <div className="bg-white p-3 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Máximo recomendado</p>
                    <p className="text-lg font-semibold text-red-600">{metricaSelecionada?.meta.max} {metricaSelecionada?.unidade}</p>
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
                {dadosTabela.map((registro, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {new Date(registro.data).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {registro.valor} {metricaSelecionada?.unidade}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {metricaSelecionada?.meta ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          registro.valor < (metricaSelecionada?.meta.min || 0)
                            ? 'bg-blue-100 text-blue-800'
                            : registro.valor > (metricaSelecionada?.meta.max || Infinity)
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {registro.valor < (metricaSelecionada?.meta.min || 0)
                            ? 'Abaixo do ideal'
                            : registro.valor > (metricaSelecionada?.meta.max || Infinity)
                            ? 'Acima do ideal'
                            : 'Dentro da meta'}
                        </span>
                      ) : null}
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