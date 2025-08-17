import React, { useEffect, useState } from 'react';
import { CalendarCheck, Heart, TrendingUp, ClipboardList} from 'lucide-react';
import MetricasWidget from '../components/widgets/MetricasWidget';
import ProximosAgendamentosWidget from '../components/widgets/ProximosAgendamentosWidget';
import MedicamentosWidget from '../components/widgets/MedicamentosWidget';
import AlertasWidget from '../components/widgets/AlertasWidget';
import { useUsuario } from '../config/bd/userContext';
import { collection, query, where, orderBy, getDocs, Timestamp, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Agendamento, Medicamento, Metrica, MetricaData } from '../interface/interface';

export const reagendarAgendamento = async (
  agendamentoId: string,
  novaData: string,
  novaHora: string
): Promise<void> => {
    console.log('Reagendando com:', {
    agendamentoId,
    novaData,
    novaHora
  });
  if (!novaData || !novaHora) {
    throw new Error('Data e hora são obrigatórias para reagendar.');
  }

  const refAgendamento = doc(db, 'agendamentos', agendamentoId);

  await updateDoc(refAgendamento, {
    data: novaData,
    hora: novaHora,
    status: 'agendado',
  });
};

const Dashboard: React.FC = () => {
  const [proximaConsulta, setProximaConsulta] = useState<string | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [metricaAtiva, setMetricaAtiva] = useState<string>('');
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [ultimaPressao, setUltimaPressao] = useState<string | null>(null);
  const [ultimaGlicemia, setUltimaGlicemia] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [mostrarModalReagendar, setMostrarModalReagendar] = useState(false);
  const [agendamentoReagendar, setAgendamentoReagendar] = useState('');
  const [novaData, setNovaData] = useState('');
  const [novaHora, setNovaHora] = useState('');


  useEffect(() => {
    buscarAgendamentos();
    buscarMetricas();
    carregarMedicamentos();
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

  const carregarMedicamentos = async () => {
      const querySnapshot = await getDocs(collection(db, 'Medicamentos'));
      const dados: Medicamento[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Medicamento[];
      setMedicamentos(dados);
    };
  

 // Função para confirmar agendamento (atualiza status para 'confirmado')
 const handleConfirmar = async (id: string) => {
  try {
    const refAgendamento = doc(db, 'agendamentos', id);
    await updateDoc(refAgendamento, { status: 'realizado' }); // <- Aqui está a mudança
    alert('Status atual com sucesso!');
    buscarAgendamentos();
  } catch (error) {
    console.error('Erro ao atualizar status do agendamento:', error);
    alert('Erro ao atualizar agendamento. Tente novamente.');
  }
};

// Função para abrir modal de reagendamento
const handleReagendar = (agendamento: Agendamento) => {
  console.log("Abrindo modal para reagendar:", agendamento);
  setAgendamentoReagendar(agendamento);


  // Corrige caso 'data' venha em formato ISO ou com mais de 10 caracteres
  const dataFormatada =
    typeof agendamento.data === 'string'
      ? agendamento.data.slice(0, 10)
      : '';

  const horaFormatada =
    typeof agendamento.hora === 'string'
      ? agendamento.hora.slice(0, 5)
      : '';

  setNovaData(dataFormatada);
  setNovaHora(horaFormatada);
  setMostrarModalReagendar(true);
};


// Salvar nova data e hora no Firestore
const salvarReagendamento = async () => {
  if (!agendamentoReagendar) return;

  try {  
    console.log('Reagendando com:', {
    novaData,
    novaHora
  });
    await reagendarAgendamento(
      agendamentoReagendar,
      novaData,
      novaHora
    );
    alert('Agendamento reagendado com sucesso!');
    setMostrarModalReagendar(false);
    buscarAgendamentos();
  } catch (error) {
    console.error('Erro ao reagendar:', error);
    alert('Erro ao reagendar. Verifique os dados e tente novamente.');
  }
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
      {mostrarModalReagendar && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
      <h2 className="text-xl font-bold mb-4">Reagendar Agendamento</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Nova Data</label>
        <input
          type="date"
          value={novaData}
          onChange={(e) => setNovaData(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Nova Hora</label>
        <input
          type="time"
          value={novaHora}
          onChange={(e) => setNovaHora(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          onClick={() => setMostrarModalReagendar(false)}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
        >
          Cancelar
        </button>
        <button
          onClick={salvarReagendamento}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Salvar
        </button>
      </div>
    </div>
  </div>
)}
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
        <MedicamentosWidget 
          medicamentos={medicamentos}
        />
        <AlertasWidget />
      </div>
    </div>

    
  );
};

export default Dashboard;