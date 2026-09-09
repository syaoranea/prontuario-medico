import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import { Metrica } from '../../interface/interface';

interface MetricasWidgetProps {
  metricas?: Metrica[];
}

// dd/MM a partir de uma data ISO
const fmtDia = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const escolher = (metricas: Metrica[], termo: string) =>
  metricas.find((m) => m.nome?.toLowerCase().includes(termo));

const MetricasWidget: React.FC<MetricasWidgetProps> = ({ metricas = [] }) => {
  // Seleciona até duas métricas relevantes para o gráfico (dados REAIS do Firestore).
  const principal = escolher(metricas, 'press') || metricas[0];
  const secundaria =
    escolher(metricas, 'peso') ||
    escolher(metricas, 'glicem') ||
    metricas.find((m) => m.id !== principal?.id);

  // Une os registros das duas métricas por dia (dd/MM) para um único eixo X.
  const mapa: Record<string, { data: string; a?: number; b?: number }> = {};
  const adicionar = (m: Metrica | undefined, chave: 'a' | 'b') => {
    if (!m) return;
    m.registros.forEach((r) => {
      const k = fmtDia(r.data);
      mapa[k] = mapa[k] || { data: k };
      mapa[k][chave] = r.valor;
    });
  };
  adicionar(principal, 'a');
  adicionar(secundaria !== principal ? secundaria : undefined, 'b');

  const data = Object.values(mapa).sort((x, y) => {
    const [dx, mx] = x.data.split('/').map(Number);
    const [dy, my] = y.data.split('/').map(Number);
    return mx - my || dx - dy;
  });

  const temDados = data.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Métricas Recentes</h2>
        <button className="text-sm text-primary-600 hover:text-primary-700">Ver tudo</button>
      </div>

      {temDados ? (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="data" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                {secundaria && secundaria !== principal && (
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                )}
                <Tooltip />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="a"
                  stroke={principal?.corGrafico || '#0A6EBD'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name={principal?.nome || 'Métrica'}
                  connectNulls
                />
                {secundaria && secundaria !== principal && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="b"
                    stroke={secundaria?.corGrafico || '#12B886'}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name={secundaria?.nome || 'Métrica'}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center mt-4 space-x-6">
            {principal && (
              <div className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: principal.corGrafico || '#0A6EBD' }}
                ></div>
                <span className="text-sm text-gray-600">{principal.nome}</span>
              </div>
            )}
            {secundaria && secundaria !== principal && (
              <div className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: secundaria.corGrafico || '#12B886' }}
                ></div>
                <span className="text-sm text-gray-600">{secundaria.nome}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center text-gray-400">
          <LineChartIcon size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Sem medições registradas ainda.</p>
          <p className="text-xs mt-1">Os valores aparecem aqui conforme forem registrados em Métricas.</p>
        </div>
      )}
    </div>
  );
};

export default MetricasWidget;
