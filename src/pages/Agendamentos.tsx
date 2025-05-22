import React, { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, User, PlusCircle, CheckCircle, XCircle } from 'lucide-react';
import { addDoc, collection, getDocs, updateDoc, doc  } from 'firebase/firestore';
import { db } from '../config/firebase';


interface Agendamento {
  id: string;
  tipo: 'consulta' | 'exame' | 'procedimento';
  titulo: string;
  data: string;
  hora: string;
  duracao: string;
  local: string;
  endereco: string;
  profissional: string;
  especialidade: string;
  observacoes: string;
  status: 'agendado' | 'confirmado' | 'realizado' | 'cancelado';
}

/* const agendamentos: Agendamento[] = [
  {
    id: 1,
    tipo: 'consulta',
    titulo: 'Consulta - Cardiologia',
    data: '28/06/2025',
    hora: '14:30',
    duracao: '30 minutos',
    local: 'Hospital Santa Lucia',
    endereco: 'Av. Principal, 123 - Centro',
    profissional: 'Dr. João Santos',
    especialidade: 'Cardiologia',
    observacoes: 'Trazer exames anteriores e lista de medicamentos em uso.',
    status: 'agendado',
  },
  {
    id: 2,
    tipo: 'exame',
    titulo: 'Hemograma Completo',
    data: '03/07/2025',
    hora: '08:15',
    duracao: '15 minutos',
    local: 'Laboratório Central',
    endereco: 'Rua das Flores, 456 - Jardim',
    profissional: '',
    especialidade: 'Análises Clínicas',
    observacoes: 'Jejum de 8 horas. Pode beber água.',
    status: 'confirmado',
  },
  {
    id: 3,
    tipo: 'consulta',
    titulo: 'Consulta - Nutrição',
    data: '15/07/2025',
    hora: '10:00',
    duracao: '45 minutos',
    local: 'Clínica Vida Plena',
    endereco: 'Rua dos Pássaros, 789 - Boa Vista',
    profissional: 'Dra. Ana Ferreira',
    especialidade: 'Nutrição',
    observacoes: 'Primeira consulta. Trazer exames recentes se houver.',
    status: 'agendado',
  },
  {
    id: 4,
    tipo: 'procedimento',
    titulo: 'Ecocardiograma',
    data: '10/05/2025',
    hora: '09:30',
    duracao: '40 minutos',
    local: 'Centro de Diagnóstico',
    endereco: 'Av. Principal, 500 - Centro',
    profissional: 'Dr. Roberto Lima',
    especialidade: 'Cardiologia',
    observacoes: 'Usar roupa confortável. Não é necessário jejum.',
    status: 'realizado',
  },
  {
    id: 5,
    tipo: 'consulta',
    titulo: 'Consulta - Oftalmologia',
    data: '22/04/2025',
    hora: '15:45',
    duracao: '30 minutos',
    local: 'Clínica Visual',
    endereco: 'Rua das Acácias, 321 - Jardim',
    profissional: 'Dra. Márcia Santos',
    especialidade: 'Oftalmologia',
    observacoes: 'Trazer óculos atuais se houver.',
    status: 'cancelado',
  },
]; */

const Agendamentos: React.FC = () => {
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [activeTab, setActiveTab] = useState<'lista' | 'calendario'>('lista');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalMensagem, setModalMensagem] = useState('');
  const [mostrarModalMensagem, setMostrarModalMensagem] = useState(false);
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);


  useEffect(() => {
    buscarAgendamentos();
  }, []);
  
  const buscarAgendamentos = async () => {
    setCarregando(true);
    try {
      const snapshot = await getDocs(collection(db, 'agendamentos'));
      const dados: Agendamento[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as unknown as Agendamento[];
  
      setAgendamentos(dados);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  const atualizarStatus = async (id: string, novoStatus: 'confirmado' | 'cancelado') => {
    try {
      const ref = doc(db, 'agendamentos', id);
      await updateDoc(ref, { status: novoStatus });
  
      setModalMensagem(`Agendamento ${novoStatus === 'confirmado' ? 'confirmado' : 'cancelado'} com sucesso!`);
      setMostrarModalMensagem(true);
      setTimeout(() => {
        setMostrarModalMensagem(false);
      }, 3000);
      buscarAgendamentos(); // recarrega os dados
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      setModalMensagem('Erro ao atualizar o status. Tente novamente.');
      setMostrarModalMensagem(true);
      setTimeout(() => {
        setMostrarModalMensagem(false);
      }, 3000);
    }
  };
  

  const agendamentosFiltrados = agendamentos.filter(agendamento => {
    if (filtroStatus === 'todos') return true;
    return agendamento.status === filtroStatus;
  });
  
  const handleSalvarAgendamento = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = {
      titulo: form.titulo.value,
      data: form.data.value,
      hora: form.hora.value,
      local: form.local.value,
      profissional: form.profissional.value,
      observacoes: form.observacoes.value,
      tipo: 'consulta',
      duracao: '30 minutos',
      endereco: '',
      especialidade: '',
      status: 'agendado',
    };
  
    try {
      if (agendamentoEditando) {
        // edição
        const ref = doc(db, 'agendamentos', agendamentoEditando.id); // cuidado: id precisa ser string
        await updateDoc(ref, dados);
      } else {
        // novo
        await addDoc(collection(db, 'agendamentos'), dados);
      }
  
      setModalMensagem('Agendamento salvo com sucesso!');
      setMostrarModalMensagem(true);
      setMostrarModal(false);
      setAgendamentoEditando(null);
      form.reset();
      setTimeout(() => {
        setMostrarModalMensagem(false);
      }, 3000);
      buscarAgendamentos?.(); // recarrega os dados, se você estiver usando
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      setModalMensagem('Erro ao salvar. Tente novamente.');
      setMostrarModalMensagem(true);
      setTimeout(() => {
        setMostrarModalMensagem(false);
      }, 3000);
    }
  };
  
  
  return (
    
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Agendamentos</h1>
        
        <button 
          onClick={() => {
            setAgendamentoEditando(null);
            setMostrarModal(true);
          }}
          className="mt-4 md:mt-0 inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          <PlusCircle size={16} className="mr-2" />
          Novo Agendamento
        </button>
      </div>
      {mostrarModalMensagem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full relative">
            <button
              onClick={() => setMostrarModalMensagem(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
            <p className="text-center text-gray-800">{modalMensagem}</p>
          </div>
        </div>
      )}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-xl relative">
            <button
              onClick={() => setMostrarModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold mb-4">Novo Agendamento</h2>

            {/* Formulário */}
            <form onSubmit={handleSalvarAgendamento} className="space-y-4">
              <input type="text" name="titulo" placeholder="Título" className="input"
                defaultValue={agendamentoEditando?.titulo}
              />
              <input type="date" name="data" className="input" defaultValue={agendamentoEditando?.data} />
              <input type="time" name="hora" className="input" defaultValue={agendamentoEditando?.hora} />
              <input type="text" name="local" className="input" defaultValue={agendamentoEditando?.local} />
              <input type="text" name="profissional" className="input" defaultValue={agendamentoEditando?.profissional} />
              <textarea name="observacoes" className="input" defaultValue={agendamentoEditando?.observacoes} />
              <button
                type="submit"
                className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Salvar
              </button>
            </form>
          </div>
        </div>
      )}

      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4">
          {/* Tabs */}
          <div className="inline-flex rounded-md shadow-sm">
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                activeTab === 'lista'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-200 focus:z-10 focus:outline-none transition-colors`}
              onClick={() => setActiveTab('lista')}
            >
              Lista
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                activeTab === 'calendario'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-200 focus:z-10 focus:outline-none transition-colors`}
              onClick={() => setActiveTab('calendario')}
            >
              Calendário
            </button>
          </div>
          
          {/* Filtro por status */}
          <div className="inline-flex items-center">
            <span className="text-sm text-gray-600 mr-2">Status:</span>
            <select
              className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="agendado">Agendados</option>
              <option value="confirmado">Confirmados</option>
              <option value="realizado">Realizados</option>
              <option value="cancelado">Cancelados</option>
            </select>
          </div>
        </div>
        
        {activeTab === 'lista' ? (
          <div className="divide-y divide-gray-100">
            {agendamentosFiltrados.length > 0 ? (
              agendamentosFiltrados.map((agendamento) => (
                <div key={agendamento.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          agendamento.tipo === 'consulta' 
                            ? 'bg-blue-100 text-blue-800' 
                            : agendamento.tipo === 'exame'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {agendamento.tipo.charAt(0).toUpperCase() + agendamento.tipo.slice(1)}
                        </span>
                        
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          agendamento.status === 'agendado' 
                            ? 'bg-gray-100 text-gray-800' 
                            : agendamento.status === 'confirmado'
                            ? 'bg-green-100 text-green-800'
                            : agendamento.status === 'realizado'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {agendamento.status.charAt(0).toUpperCase() + agendamento.status.slice(1)}
                        </span>
                      </div>
                      
                      <h3 className="mt-2 text-lg font-semibold text-gray-800">{agendamento.titulo}</h3>
                      
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar size={16} className="mr-2 text-gray-400" />
                          <span>{agendamento.data}</span>
                        </div>
                        
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock size={16} className="mr-2 text-gray-400" />
                          <span>{agendamento.hora} ({agendamento.duracao})</span>
                        </div>
                        
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin size={16} className="mr-2 text-gray-400" />
                          <span>{agendamento.local}</span>
                        </div>
                        
                        {agendamento.profissional && (
                          <div className="flex items-center text-sm text-gray-600">
                            <User size={16} className="mr-2 text-gray-400" />
                            <span>{agendamento.profissional}</span>
                          </div>
                        )}
                      </div>
                      
                      {agendamento.observacoes && (
                        <div className="mt-3 text-sm text-gray-600">
                          <p className="font-medium">Observações:</p>
                          <p>{agendamento.observacoes}</p>
                        </div>
                      )}
                    </div>
                    
                    {(agendamento.status === 'agendado' || agendamento.status === 'confirmado') && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => atualizarStatus(agendamento.id, 'confirmado')}
                          className="inline-flex items-center justify-center px-3 py-1.5 border border-green-500 text-green-600 hover:bg-green-50 rounded-lg text-sm transition-colors"
                        >
                          <CheckCircle size={14} className="mr-1" />
                          Confirmar
                        </button>

                        <button
                          onClick={() => atualizarStatus(agendamento.id, 'cancelado')}
                          className="inline-flex items-center justify-center px-3 py-1.5 border border-red-500 text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors"
                        >
                          <XCircle size={14} className="mr-1" />
                          Cancelar
                        </button>

                        <button
                          className="inline-flex items-center justify-center px-3 py-1.5 border border-blue-500 text-blue-600 hover:bg-blue-50 rounded-lg text-sm transition-colors"
                          onClick={() => {
                            setAgendamentoEditando(agendamento);
                            setMostrarModal(true);
                          }}
                        >
                          ✎ Editar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-500">Nenhum agendamento encontrado com os filtros selecionados.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            <p className="text-center text-gray-500">Visualização de calendário em desenvolvimento</p>
            <div className="mt-4 grid grid-cols-7 gap-2 text-center">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, idx) => (
                <div key={idx} className="py-2 font-medium text-sm text-gray-600">
                  {dia}
                </div>
              ))}
              
              {/* Placeholder para dias do calendário */}
              {Array.from({ length: 35 }).map((_, idx) => (
                <div 
                  key={idx} 
                  className={`py-2 text-sm border rounded-lg ${
                    idx % 7 === 0 || idx % 7 === 6 
                      ? 'bg-gray-50 text-gray-400' 
                      : 'bg-white text-gray-700'
                  }`}
                >
                  {(idx + 1) <= 30 ? (idx + 1) : ''}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    
  );

  
};

export default Agendamentos;