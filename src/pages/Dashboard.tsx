import React, { useEffect, useState } from 'react';
import { CalendarCheck, Heart, TrendingUp, ClipboardList} from 'lucide-react';
import MetricasWidget from '../components/widgets/MetricasWidget';
import ProximosAgendamentosWidget from '../components/widgets/ProximosAgendamentosWidget';
import MedicamentosWidget from '../components/widgets/MedicamentosWidget';
import AlertasWidget, { FolgaAlerta, ObservacaoAlerta } from '../components/widgets/AlertasWidget';
import ParabensWidget, { ParabensPlantao } from '../components/widgets/ParabensWidget';
import { useNavigate } from 'react-router-dom';
import { useUsuario } from '../config/bd/userContext';
import { useFeedback } from '../components/FeedbackProvider';
import { useAuth } from '../config/auth/authContext';
import { ordinalData, formatarDataExtenso, dataFimVigente, faltaMenosDeUmMes, hojeISO, paraISO } from '../utils/datas';
import { normalizarNome } from '../utils/texto';
import { collection, query, where, orderBy, getDocs, Timestamp, onSnapshot, doc, updateDoc, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Agendamento, Medicamento, Metrica, MetricaData, RotinaExecucao } from '../interface/interface';

export const reagendarAgendamento = async (
  agendamentoId: string,
  novaData: string,
  novaHora: string
): Promise<void> => {
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
  const [proximaConsulta, setProximaConsulta] = useState<any | null>(null);
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
  const [pendentes, setPendentes] = useState<Agendamento[]>([]);
  const [totalPendentes, setTotalPendentes] = useState(0);
  const [folgasCobertura, setFolgasCobertura] = useState<FolgaAlerta[]>([]);
  const [observacoesPlantao, setObservacoesPlantao] = useState<ObservacaoAlerta[]>([]);
  const [parabensPlantao, setParabensPlantao] = useState<ParabensPlantao[]>([]);
  const { notificar } = useFeedback();
  const { perfil, temPapel } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    buscarAgendamentos();
    const unsubscribeMetricas = buscarMetricas();
    carregarMedicamentos();
    buscarFolgasCobertura();
    buscarObservacoesPlantao();
    buscarParabensPlantao();
    const carregar = async () => {
      const { total, pendentes } = await buscarPendentes();
      setTotalPendentes(total);
      setPendentes(pendentes);
    };
    const carregarConsulta = async () => {
      const resultado = await buscarProximaConsulta();
      setProximaConsulta(resultado);
    };

    carregarConsulta();

    carregar();

    // Limpa o listener em tempo real ao desmontar para evitar acúmulo de listeners.
    return () => {
      unsubscribeMetricas?.();
    };
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
      setAgendamentos(dados);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
    } finally {
      setCarregando(false);
    }
  };

  const carregarMedicamentos = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'Medicamentos'));

      const dados: Medicamento[] = querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Medicamento[];

      // Mantém o medicamento se não tem fim ou se o fim (tolerando qualquer
      // formato de data) ainda não passou.
      const filtrados = dados.filter(med => !med.fim || dataFimVigente(med.fim));

      setMedicamentos(filtrados);
    } catch (error) {
      console.error('Erro ao buscar medicamentos:', error);
    }
  };

  const buscarFolgasCobertura = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'folgas'));
      const hojeStr = hojeISO();
      const lista: FolgaAlerta[] = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((f) => !f.cobertoPor && typeof f.data === 'string' && f.data >= hojeStr)
        .map((f) => ({ id: f.id, tecnicoNome: f.tecnicoNome, data: f.data, turno: f.turno, tipo: f.tipo }));
      setFolgasCobertura(lista);
    } catch (error) {
      console.error('Erro ao buscar folgas:', error);
    }
  };

  // Plantões recentes em que a técnica deixou observação — geral ou em algum
  // item do checklist. Vira card em "Alertas e Lembretes", nominal à técnica.
  // A técnica vê só as próprias; gestão e família veem as de todas.
  const buscarObservacoesPlantao = async () => {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'rotina-execucoes'), orderBy('data', 'desc'), limit(30))
      );

      // Janela de 7 dias: alerta antigo vira ruído, o histórico completo fica na
      // aba Histórico da Rotina Home Care.
      const limite = new Date();
      limite.setHours(0, 0, 0, 0);
      limite.setDate(limite.getDate() - 6);
      const limiteStr = paraISO(limite);

      const vejoTodas = temPapel(['admin', 'familia', 'enfermeiro', 'medico']);
      const meuNome = normalizarNome(perfil?.nome);

      const lista: ObservacaoAlerta[] = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<RotinaExecucao, 'id'>) }))
        .filter((exec) => paraISO(exec.data) >= limiteStr)
        .filter((exec) => vejoTodas || (!!meuNome && normalizarNome(exec.auxiliar) === meuNome))
        .map((exec) => ({
          id: exec.id,
          tecnicoNome: exec.auxiliar ?? '',
          data: paraISO(exec.data) || exec.data,
          turno: exec.turno,
          observacaoGeral: (exec.observacaoGeral ?? '').trim(),
          itensComObservacao: (exec.itens ?? []).filter((i) => (i.observacao ?? '').trim()).length,
        }))
        .filter((o) => o.observacaoGeral || o.itensComObservacao > 0);

      setObservacoesPlantao(lista);
    } catch (error) {
      console.error('Erro ao buscar observações de plantão:', error);
    }
  };

  // Plantões recentes da PRÓPRIA pessoa logada com 100% da rotina concluída e
  // que ela ainda não comemorou. É o card de parabéns do primeiro acesso depois
  // do plantão. Janela de 7 dias para não despejar um backlog de plantões
  // antigos de uma vez na primeira vez que a tela rodar.
  const buscarParabensPlantao = async () => {
    const meuNome = normalizarNome(perfil?.nome);
    if (!meuNome) return;

    try {
      const snapshot = await getDocs(
        query(collection(db, 'rotina-execucoes'), orderBy('data', 'desc'), limit(30))
      );

      const limite = new Date();
      limite.setHours(0, 0, 0, 0);
      limite.setDate(limite.getDate() - 6);
      const limiteStr = paraISO(limite);

      const lista: ParabensPlantao[] = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<RotinaExecucao, 'id'>) }))
        .filter((exec) => paraISO(exec.data) >= limiteStr)
        .filter((exec) => normalizarNome(exec.auxiliar) === meuNome)
        .filter((exec) => !exec.parabensVistoEm)
        .filter((exec) => (exec.itens?.length ?? 0) > 0 && exec.itens.every((i) => i.concluido))
        .map((exec) => ({
          id: exec.id,
          data: paraISO(exec.data) || exec.data,
          turno: exec.turno,
          totalItens: exec.itens.length,
        }));

      setParabensPlantao(lista);
    } catch (error) {
      console.error('Erro ao buscar plantões 100%:', error);
    }
  };

  // Marca o parabéns como visto para não reaparecer no próximo login.
  const fecharParabens = async (id: string) => {
    setParabensPlantao((prev) => prev.filter((p) => p.id !== id));
    try {
      await updateDoc(doc(db, 'rotina-execucoes', id), { parabensVistoEm: new Date().toISOString() });
    } catch (error) {
      console.error('Erro ao marcar parabéns como visto:', error);
    }
  };

  const buscarPendentes = async (): Promise<{
    total: number;
    pendentes: Agendamento[];
  }> => {
    try {
      const q = query(
        collection(db, "agendamentos"),
        where("status", "==", "pendente"),
        where("tipo", "in", ["consulta", "exame"]) // pega os dois
      );
  
      const snapshot = await getDocs(q);

      const pendentes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Agendamento, "id">),
      }));

      // Regra de lembrete de consulta: uma consulta pendente só vira lembrete
      // quando faltar menos de um mês para a data (e ela ainda não tiver passado).
      // Exames pendentes mantêm o comportamento atual (aparecem sempre).
      const filtrados = pendentes.filter((p) =>
        p.tipo === 'consulta' ? faltaMenosDeUmMes(p.data) : true
      );

      return {
        total: filtrados.filter((p) => p.tipo === 'exame').length,
        pendentes: filtrados,
      };
    } catch (error) {
      console.error("Erro ao buscar pendentes:", error);
      return {
        total: 0,
        pendentes: [],
      };
    }
  };

  const buscarProximaConsulta = async (): Promise<{ titulo: string; data: string } | null> => {
    try {
      const q = query(
        collection(db, "agendamentos"),
        where("status", "==", "agendado"),
        where("tipo", "==", "consulta")
      );
  
      const snapshot = await getDocs(q);
  
      if (snapshot.empty) return null;
  
      const pendentes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Agendamento, "id">),
      }));
  
      // Ordena pela data (tolerando qualquer formato) — a mais próxima primeiro.
      const ordenados = pendentes.sort((a, b) => ordinalData(a.data) - ordinalData(b.data));

      const proxima = ordenados[0];

      return {
        titulo: proxima.titulo,
        data: formatarDataExtenso(proxima.data),
      };
    } catch (error) {
      console.error("Erro ao buscar próxima consulta:", error);
      return null;
    }
  };


 // Função para confirmar agendamento (atualiza status para 'confirmado')
 const handleConfirmar = async (id: string) => {
  try {
    const refAgendamento = doc(db, 'agendamentos', id);
    await updateDoc(refAgendamento, { status: 'confirmado' });
    notificar('sucesso', 'Agendamento confirmado com sucesso!');
    buscarAgendamentos();
  } catch (error) {
    console.error('Erro ao atualizar status do agendamento:', error);
    notificar('erro', 'Erro ao atualizar agendamento. Tente novamente.');
  }
};

// Função para abrir modal de reagendamento
const handleReagendar = (agendamento: Agendamento) => {
  // Guarda apenas o ID do documento — reagendarAgendamento espera uma string,
  // e doc(db, 'agendamentos', id) quebra se receber o objeto inteiro.
  setAgendamentoReagendar(agendamento.id);


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
    await reagendarAgendamento(
      agendamentoReagendar,
      novaData,
      novaHora
    );
    notificar('sucesso', 'Agendamento reagendado com sucesso!');
    setMostrarModalReagendar(false);
    buscarAgendamentos();
  } catch (error) {
    console.error('Erro ao reagendar:', error);
    notificar('erro', 'Erro ao reagendar. Verifique os dados e tente novamente.');
  }
};

  const buscarMetricas = () => {
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

      {/* Parabéns pelo plantão 100% — primeira coisa que a técnica vê ao entrar. */}
      <ParabensWidget
        nome={perfil?.nome ?? ''}
        plantoes={parabensPlantao}
        onFechar={fecharParabens}
      />
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
            
            {proximaConsulta ? (
              <p className="font-semibold text-gray-800">
                {proximaConsulta.titulo} em {proximaConsulta.data}
              </p>
            ) : (
              <p className="font-semibold text-red-500">
                Nenhuma consulta agendada...
              </p>
            )}
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
            <p className="font-semibold">{totalPendentes}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricasWidget metricas={metricas} />
        <ProximosAgendamentosWidget
           agendamentos={agendamentos}
           onConfirmar={handleConfirmar}
           onReagendar={handleReagendar} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MedicamentosWidget 
          medicamentos={medicamentos}
        />
        <AlertasWidget
          alertas={pendentes}
          folgas={folgasCobertura}
          onFazerCobertura={() => navigate('/escala')}
          observacoes={observacoesPlantao}
          onVerObservacao={() => navigate('/rotina', { state: { aba: 'observacoes' } })}
        />
      </div>
    </div>

    
  );
};

export default Dashboard;