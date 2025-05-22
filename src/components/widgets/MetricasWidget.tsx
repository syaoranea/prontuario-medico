import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { data: '01/06', peso: 68, pressao: 120 },
  { data: '08/06', peso: 67.5, pressao: 118 },
  { data: '15/06', peso: 67.8, pressao: 122 },
  { data: '22/06', peso: 67.2, pressao: 119 },
  { data: '29/06', peso: 66.9, pressao: 121 },
];

const MetricasWidget: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Métricas Recentes</h2>
        <button className="text-sm text-primary-600 hover:text-primary-700">Ver tudo</button>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="data" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="peso" 
              stroke="#0A6EBD" 
              strokeWidth={2} 
              dot={{ r: 4 }} 
              activeDot={{ r: 6 }} 
              name="Peso (kg)"
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="pressao" 
              stroke="#12B886" 
              strokeWidth={2} 
              dot={{ r: 4 }} 
              activeDot={{ r: 6 }} 
              name="Pressão Sistólica (mmHg)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="flex items-center justify-center mt-4 space-x-6">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-[#0A6EBD] mr-2"></div>
          <span className="text-sm text-gray-600">Peso</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-[#12B886] mr-2"></div>
          <span className="text-sm text-gray-600">Pressão</span>
        </div>
      </div>
    </div>
  );
};

export default MetricasWidget;