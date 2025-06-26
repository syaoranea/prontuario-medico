import React, { useEffect, useState } from 'react';
import { CalendarCheck, Heart, TrendingUp, ClipboardList} from 'lucide-react';
import MetricasWidget from '../components/widgets/MetricasWidget';
import ProximosAgendamentosWidget from '../components/widgets/ProximosAgendamentosWidget';
import MedicamentosWidget from '../components/widgets/MedicamentosWidget';
import AlertasWidget from '../components/widgets/AlertasWidget';
import { useUsuario } from '../config/bd/userContext';
import { collection, query, where, orderBy, getDocs, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Agendamento, Metrica, MetricaData } from '../interface/interface';


const Dashboard: React.FC = () => {
  const [proximaConsulta, setProximaConsulta] = useState<string | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [metricaAtiva, setMetricaAtiva] = useState<string>('');
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [ultimaPressao, setUltimaPressao] = useState<string | null>(null);
  const [ultimaGlicemia, setUltimaGlicemia] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    buscarAgendamentos();
    buscarMetricas();
  }, []);
  
  const buscarAgendamentos = async () => {
    setCarregando(true);
    try {
      const q = query(
        collection(db, 'agendamentos'),
        where('status', 'in', ['agendado', 'confirmado']),
      );
  
      const snapshot = await getDocs(q);
      const dados: Agendamento[] = snapshot.docs.map((doc) => {
        const dataDoc = doc.data();
  
        return {
          id: doc.id,
          tipo: dataDoc.tipo || 'consulta',
          data: dataDoc.data,
          hora: dataDoc.hora || '',
          local: dataDoc.local || '',
          medico: dataDoc.profissional || '',
          especialidade: dataDoc.titulo || '',
          status: dataDoc.status || '',
        };
      });
      console.log(dados)
      setAgendamentos(dados);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
    } finally {
      setCarregando(false);
    }
  };
  

  const handleConfirmar = (id: string) => {
    alert(`Confirmar agendamento ${id}`);
    // Aqui você pode implementar a lógica para confirmar o agendamento
  };

  const handleReagendar = (id: string) => {
    alert(`Reagendar agendamento ${id}`);
    // Aqui você pode implementar a lógica para reagendar o agendamento
  };

  const buscarMetricas = async () => {
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

        const metricaPressao = metricasFirebase.find((m) => m.nome.toLowerCase().includes('pressão'));

        if (metricaPressao && metricaPressao.registros.length > 0) {
          const ultimoRegistro = metricaPressao.registros[metricaPressao.registros.length - 1];

          // Aqui você adapta se o valor for composto (ex: pressão sistólica/diastólica), supondo que esteja como string "120/80"
          setUltimaPressao(ultimoRegistro.valor.toString() + ' mmHg');
        } else {
          setUltimaPressao(null);
        }

        const metricaGlicemia = metricasFirebase.find((m) => m.nome.toLowerCase().includes('glicemia'));

        if (metricaGlicemia && metricaGlicemia.registros.length > 0) {
          const ultimoRegistro = metricaGlicemia.registros[metricaGlicemia.registros.length - 1];

          // Aqui você adapta se o valor for composto (ex: pressão sistólica/diastólica), supondo que esteja como string "120/80"
          setUltimaGlicemia(ultimoRegistro.valor.toString() + 'mg/dL');
        } else {
          setUltimaGlicemia(null);
        }


    
        if (metricasFirebase.length > 0 && !metricaAtiva) {
          setMetricaAtiva(metricasFirebase[0].id);
        }
      });
    
      return () => unsubscribe();
    }

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
            <p className={`font-semibold ${proximaConsulta === 'Nenhuma consulta agendada' ? 'text-red-500' : ''}`}>
            {proximaConsulta ?? 'Nenhuma consulta agendada...'}
    </p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-red-50 text-red-600">
            <Heart size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Pressão Arterial</p>
            <p className="font-semibold">  {ultimaPressao ?? 'Sem dados'}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-green-50 text-green-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Glicemia</p>
            <p className="font-semibold">{ultimaGlicemia ?? 'Sem dados'}</p>
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
        <ProximosAgendamentosWidget
           agendamentos={agendamentos}
           onConfirmar={handleConfirmar}
           onReagendar={handleReagendar} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MedicamentosWidget />
        <AlertasWidget />
      </div>
    </div>
  );
};

export default Dashboard;