import React, { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, User, PlusCircle, CheckCircle, XCircle } from 'lucide-react';
import { addDoc, collection, getDocs, updateDoc, doc  } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Agendamento } from '../interface/interface';

const Agendamentos: React.FC = () => {
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [activeTab, setActiveTab] = useState<'lista' | 'calendario'>('lista');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalMensagem, setModalMensagem] = useState('');
  const [mostrarModalMensagem, setMostrarModalMensagem] = useState(false);
  const [agendamentoEditando, setAgendamentoEditando] = useState<Agendamento | null>(null);
  const [mostrarModalTipo, setMostrarModalTipo] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null);
// Novo estado para modal de realizado
const [mostrarModalRealizado, setMostrarModalRealizado] = useState(false);
const [abaAtiva, setAbaAtiva] = useState<'historico' | 'medicamentos' | 'exames' | 'retorno'>('historico');

// Dados dos formulários
const [dadosHistorico, setDadosHistorico] = useState({
  titulo: '',
  descricao: '',
  medico: '',
  especialidade: '',
  instituicao: '',
});

const [dadosMedicamentos, setDadosMedicamentos] = useState([{ nome: '', dose: '', instrucoes: '', frequencia: '', horarios: '', inicio: '', fim: '', estoque: '', medico: '' }]);
const [dadosExames, setDadosExames] = useState([{ titulo: '', local: '', data: '', hora: '', profissional: '', observacao: '' }]);
const [dadosRetorno, setDadosRetorno] = useState({
  titulo: '',
  local: '',
  data: '',
  hora: '',
  profissional: '',
  observacao: ''
});

const formatarTexto = (valor?: string) => {
  if (!valor) return "N/A";
  return valor.charAt(0).toUpperCase() + valor.slice(1);
};

const salvarRealizado = async () => {
  try {
    if (!agendamentoEditando) return;

    // Atualiza status do agendamento
    const refAgendamento = doc(db, "agendamentos", agendamentoEditando.id);
    await updateDoc(refAgendamento, { status: "realizado" });

    // Salva no histórico médico
    await addDoc(collection(db, "historicoMedico"), {
      ...dadosHistorico,
      data: agendamentoEditando.data,
      tipo: agendamentoEditando.tipo,
      agendamentoId: agendamentoEditando.id,
    });

    const medicamentosValidos = dadosMedicamentos.filter(
      (med) =>
        med.nome?.trim() !== "" || // só salva se algum campo estiver preenchido
        med.dose?.trim() !== "" ||
        med.frequencia?.trim() !== "" ||
        med.estoque?.trim() !== "" ||
        med.fim?.trim() !== "" ||
        med.horarios?.trim() !== "" ||
        med.inicio?.trim() !== "" ||
        med.instrucoes?.trim() !== "" ||
        med.medico?.trim() !== ""        
    );

    // Salva medicamentos individualmente

    for (const med of medicamentosValidos) {
      await addDoc(collection(db, "Medicamentos"), {
        ...med,
        status: "ativo",
   
      });
    
  }

  if(dadosRetorno.data?.trim() !== ''){
    await addDoc(collection(db, "agendamentos"), {
      data: dadosRetorno.data,
      hora: dadosRetorno.hora,
      titulo: dadosHistorico.titulo,
      profissional: dadosHistorico.medico,
      local: dadosHistorico.instituicao,
      tipo: 'consulta',
      status: 'pendente'
    });
  }

  const examesValidos = dadosExames.filter(
    (med) =>
      med.data?.trim() !== "" || // só salva se algum campo estiver preenchido
      med.hora?.trim() !== "" ||
      med.local?.trim() !== "" ||
      med.observacao?.trim() !== "" ||
      med.profissional?.trim() !== "" ||
      med.titulo?.trim() !== ""
  );

    // Salva exames com status "pendente"
    for (const ex of examesValidos) {
      await addDoc(collection(db, "agendamentos"), {
        ...ex,
        tipo: "exame",
        status: "pendente",
      });
    }
  

    setModalMensagem("Dados cadastrados com sucesso!");
    setMostrarModalMensagem(true);
    setMostrarModalRealizado(false);
    buscarAgendamentos();
  } catch (err) {
    console.error(err);
    setModalMensagem("Erro ao salvar dados.");
    setMostrarModalMensagem(true);
  }
};




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
          // Ordenar do mais recente para o mais antigo
      const dadosOrdenados = dados.sort((a, b) => {
      const dataHoraA = new Date(`${a.data}T${a.hora}`).getTime();
      const dataHoraB = new Date(`${b.data}T${b.hora}`).getTime();
      return dataHoraB - dataHoraA; // mais recente primeiro
    });
      setAgendamentos(dadosOrdenados);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  const marcarComoRealizado = async (agendamento: Agendamento) => {
    try {
      const refAgendamento = doc(db, 'agendamentos', agendamento.id);
      await updateDoc(refAgendamento, { status: 'realizado' });
  
      await addDoc(collection(db, 'historicoMedico'), {
        tipo: agendamento.tipo === 'procedimento' ? 'cirurgia' : agendamento.tipo,
        data: agendamento.data,
        titulo: agendamento.titulo,
        descricao: agendamento.observacoes,
        medico: agendamento.profissional,
        especialidade: agendamento.especialidade,
        instituicao: agendamento.local,
        documentos: [], // pode adaptar se houver arquivos associados
      });
  
      setModalMensagem('Agendamento marcado como realizado e salvo no histórico médico!');
      setMostrarModalMensagem(true);
      setTimeout(() => {
        setMostrarModalMensagem(false);
      }, 3000);
      buscarAgendamentos(); // recarrega a lista
    } catch (error) {
      console.error('Erro ao marcar como realizado:', error);
      setModalMensagem('Erro ao registrar como realizado. Tente novamente.');
      setMostrarModalMensagem(true);
      setTimeout(() => {
        setMostrarModalMensagem(false);
      }, 3000);
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
  
    // Dados comuns
    const dadosBase = {
      data: form.data.value,
      hora: form.hora.value,
      tipo: form.tipo.value,
      duracao: '30 minutos',
      status: 'agendado',
    };
  
    // Preparar dados específicos por tipo
    let dados: any = { ...dadosBase };
  
    switch (tipoSelecionado) {
      case 'consulta':
        dados = {
          ...dadosBase,
          titulo: form.titulo.value,          // Nome da especialidade
          local: form.local.value,
          profissional: form.profissional.value,
          observacoes: form.observacoes?.value || '',
        };
        break;
  
      case 'exame':
        dados = {
          ...dadosBase,
          titulo: form.titulo.value,          // Nome do exame
          local: form.local.value,            // Laboratório
          observacoes: form.observacoes?.value || '',
        };
        break;
  
      case 'procedimento':
        dados = {
          ...dadosBase,
          titulo: form.titulo.value,          // Nome do procedimento
          local: form.local.value,            // Hospital/Clínica
          observacoes: form.observacoes?.value || '',
        };
        break;
  
      default:
        console.error('Tipo de agendamento inválido');
        return;
    }
  
    try {
      if (agendamentoEditando) {
        // Edição de agendamento existente
        const ref = doc(db, 'agendamentos', agendamentoEditando.id);
        await updateDoc(ref, dados);
      } else {
        // Novo agendamento
        await addDoc(collection(db, 'agendamentos'), dados);
      }
  
      setModalMensagem('Agendamento salvo com sucesso!');
      setMostrarModalMensagem(true);
      setMostrarModal(false);
      setAgendamentoEditando(null);
      form.reset();
  
      // Ocultar mensagem após 3 segundos
      setTimeout(() => {
        setMostrarModalMensagem(false);
      }, 3000);
  
      // Recarregar lista de agendamentos
      buscarAgendamentos();
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
            setTipoSelecionado(null); 
            setMostrarModalTipo(true); // Abre o modal de escolha de tipo
          }}
          className="mt-4 md:mt-0 inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <PlusCircle size={16} className="mr-2" />
          Novo Agendamento
        </button>

      </div>

       {/* Modal de Escolha de Tipo */}
       {mostrarModalTipo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm text-center relative">
            <button
              onClick={() => setMostrarModalTipo(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold mb-4">Escolha o tipo de agendamento</h2>
            <div className="space-y-2">
              {['consulta', 'exame', 'procedimento'].map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => {
                    setTipoSelecionado(tipo);
                    setMostrarModalTipo(false);
                    setMostrarModal(true);
                  }}
                  className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  {formatarTexto(tipo)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal do Formulário */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg relative">
            <button
              onClick={() => setMostrarModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold mb-4">
              Novo {tipoSelecionado && formatarTexto(tipoSelecionado)}
            </h2>

            <form onSubmit={handleSalvarAgendamento} className="space-y-4">
              <input type="hidden" name="tipo" value={tipoSelecionado || ''} />

              {/* Campos de cada tipo */}
              
              {tipoSelecionado === 'consulta' && (
                <>
                  <input 
                    type="text"  name="titulo" placeholder="Especialidade"  defaultValue={agendamentoEditando?.titulo || ''} className="input" />
                  <input 
                    type="date" name="data" defaultValue={agendamentoEditando?.data || ''}  className="input"/>
                  <input 
                    type="time" name="hora" defaultValue={agendamentoEditando?.hora || ''} className="input"/>
                  <input 
                    type="text" name="local" placeholder="Local" defaultValue={agendamentoEditando?.local || ''} className="input"/>
                  <input 
                    type="text" name="profissional" placeholder="Nome do Médico" defaultValue={agendamentoEditando?.profissional || ''} className="input"/>
                </>
              )}


              {tipoSelecionado === 'exame' && (
                <>
                  <input type="text" name="titulo" placeholder="Nome do Exame" className="input" defaultValue={agendamentoEditando?.titulo || ''} />
                  <input type="date" name="data" className="input" defaultValue={agendamentoEditando?.data || ''}/>
                  <input type="time" name="hora" className="input" defaultValue={agendamentoEditando?.hora || ''}/>
                  <input type="text" name="local" placeholder="Laboratório" className="input"  defaultValue={agendamentoEditando?.local || ''}/>
                  <textarea name="observacoes" placeholder="Observações" className="input" />
                </>
              )}

              {tipoSelecionado === 'procedimento' && (
                <>
                  <input type="text" name="titulo" placeholder="Nome do Procedimento" className="input" defaultValue={agendamentoEditando?.titulo || ''} />
                  <input type="date" name="data" className="input" defaultValue={agendamentoEditando?.data || ''}/>
                  <input type="time" name="hora" className="input" defaultValue={agendamentoEditando?.hora || ''}/>
                  <input type="text" name="local" placeholder="Hospital/Clínica" className="input" defaultValue={agendamentoEditando?.local || ''} />
                  <textarea name="observacoes" placeholder="Observações" className="input" />
                </>
              )}

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

{mostrarModalRealizado && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-2xl relative">
      <button
        onClick={() => setMostrarModalRealizado(false)}
        className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
      >
        ✕
      </button>

      {/* Tabs */}
      <div className="flex border-b mb-4">
        {['historico', 'medicamentos', 'exames', 'retorno'].map((aba) => (
          <button
            key={aba}
            onClick={() => setAbaAtiva(aba as any)}
            className={`px-4 py-2 ${
              abaAtiva === aba ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'
            }`}
          >
            {formatarTexto(aba)}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      {abaAtiva === 'historico' && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Título"
            value={dadosHistorico.titulo}
            onChange={(e) => setDadosHistorico({ ...dadosHistorico, titulo: e.target.value })}
            className="input"
          />
          <textarea
            placeholder="Descrição"
            value={dadosHistorico.descricao}
            onChange={(e) => setDadosHistorico({ ...dadosHistorico, descricao: e.target.value })}
            className="input"
          />
          <input
            type="text"
            placeholder="Médico"
            value={dadosHistorico.medico}
            onChange={(e) => setDadosHistorico({ ...dadosHistorico, medico: e.target.value })}
            className="input"
          />
          <input
            type="text"
            placeholder="Especialidade"
            value={dadosHistorico.especialidade}
            onChange={(e) => setDadosHistorico({ ...dadosHistorico, especialidade: e.target.value })}
            className="input"
          />
          <input
            type="text"
            placeholder="Instituição"
            value={dadosHistorico.instituicao}
            onChange={(e) => setDadosHistorico({ ...dadosHistorico, instituicao: e.target.value })}
            className="input"
          />
        </div>
      )}

      {abaAtiva === 'medicamentos' && (
        <div>
          {dadosMedicamentos.map((med, idx) => (
            <div key={idx} className="space-y-3">
              <input
                type="text"
                placeholder="Medicamento"
                value={med.nome}
                onChange={(e) => {
                  const novo = [...dadosMedicamentos];
                  novo[idx].nome = e.target.value;
                  setDadosMedicamentos(novo);
                }}
                className="input flex-1"
              />
              <input
                type="text"
                placeholder="Dosagem"
                value={med.dose}
                onChange={(e) => {
                  const novo = [...dadosMedicamentos];
                  novo[idx].dose = e.target.value;
                  setDadosMedicamentos(novo);
                }}
                className="input flex-1"
              />

              <input
                type="text"
                placeholder="Instruções"
                value={med.instrucoes}
                onChange={(e) => {
                  const novo = [...dadosMedicamentos];
                  novo[idx].instrucoes = e.target.value;
                  setDadosMedicamentos(novo);
                }}
                className="input flex-1"
              />

              <input
                type="text"
                placeholder="Frequência"
                value={med.frequencia}
                onChange={(e) => {
                  const novo = [...dadosMedicamentos];
                  novo[idx].frequencia = e.target.value;
                  setDadosMedicamentos(novo);
                }}
                className="input flex-1"
              />

              <input
                type="text"
                placeholder="Horários"
                value={med.horarios}
                onChange={(e) => {
                  const novo = [...dadosMedicamentos];
                  novo[idx].horarios = e.target.value;
                  setDadosMedicamentos(novo);
                }}
                className="input flex-1"
              />
              <input
                type="text"
                placeholder="Início"
                value={med.inicio}
                onChange={(e) => {
                  const novo = [...dadosMedicamentos];
                  novo[idx].inicio = e.target.value;
                  setDadosMedicamentos(novo);
                }}
                className="input flex-1"
              />

              <input
                type="text"
                placeholder="Fim "
                value={med.fim}
                onChange={(e) => {
                  const novo = [...dadosMedicamentos];
                  novo[idx].fim = e.target.value;
                  setDadosMedicamentos(novo);
                }}
                className="input flex-1"
              />
              <input
                type="text"
                placeholder="Estoque"
                value={med.estoque}
                onChange={(e) => {
                  const novo = [...dadosMedicamentos];
                  novo[idx].estoque = e.target.value;
                  setDadosMedicamentos(novo);
                }}
                className="input flex-1"
              />
              <input
                type="text"
                placeholder="Médico"
                value={med.medico}
                onChange={(e) => {
                  const novo = [...dadosMedicamentos];
                  novo[idx].medico = e.target.value;
                  setDadosMedicamentos(novo);
                }}
                className="input flex-1"
              />
            </div>
          ))}
          <button
            onClick={() => setDadosMedicamentos([...dadosMedicamentos, { nome: '', dose: '', instrucoes: '', frequencia: '', horarios: '', inicio: '', fim: '', estoque: '', medico: ''  }])}
            className="text-blue-600 text-sm mt-2"
          >
            + Adicionar medicamento
          </button>
        </div>
      )}

      {abaAtiva === 'exames' && (
        <div>
          {dadosExames.map((ex, idx) => (
            <div key={idx} className="space-y-3">
              <input
                type="text"
                placeholder="Nome do Exame"
                value={ex.titulo}
                onChange={(e) => {
                  const novo = [...dadosExames];
                  novo[idx].titulo = e.target.value;
                  setDadosExames(novo);
                }}
                className="input flex-1"
              />
              <input
                type="text"
                placeholder="Laboratório "
                value={ex.local}
                onChange={(e) => {
                  const novo = [...dadosExames];
                  novo[idx].local = e.target.value;
                  setDadosExames(novo);
                }}
                className="input flex-1"
              />

              <input
                type="date"
                name='data'
                value={ex.data}
                onChange={(e) => {
                  const novo = [...dadosExames];
                  novo[idx].data = e.target.value;
                  setDadosExames(novo);
                }}
                className="input flex-1"
              />
              <br/>
              <input
                type="time"
                name='hora'
                value={ex.hora}
                onChange={(e) => {
                  const novo = [...dadosExames];
                  novo[idx].hora = e.target.value;
                  setDadosExames(novo);
                }}
                className="input flex-1"
              />
              <input
                type="text"
                name='Medico'
                value={ex.profissional}
                onChange={(e) => {
                  const novo = [...dadosExames];
                  novo[idx].profissional = e.target.value;
                  setDadosExames(novo);
                }}
                className="input flex-1"
              />
              <input
                type="text"
                placeholder="observação "
                value={ex.observacao}
                onChange={(e) => {
                  const novo = [...dadosExames];
                  novo[idx].observacao = e.target.value;
                  setDadosExames(novo);
                }}
                className="input flex-1"
              />
            </div>
          ))}
          <button
            onClick={() => setDadosExames([...dadosExames, { titulo: '', local: '', data: '', hora: '', profissional: '', observacao: '' }])}
            className="text-blue-600 text-sm mt-2"
          >
            + Adicionar exame
          </button>
        </div>
      )}

      {abaAtiva === 'retorno' && (
        <div className="space-y-3">
          <input
            type="date"
            value={dadosRetorno.data}
            onChange={(e) => setDadosRetorno({ ...dadosRetorno, data: e.target.value })}
            className="input"
          />
          <input
            type="time"
            value={dadosRetorno.hora}
            onChange={(e) => setDadosRetorno({ ...dadosRetorno, hora: e.target.value })}
            className="input"
          />
        </div>
      )}

      <button
        onClick={salvarRealizado}
        className="mt-6 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Cadastrar
      </button>
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
              <option value="pendente">Pendente</option>
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
                          {formatarTexto(agendamento.tipo)}
                        </span>
                        
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          agendamento.status === 'agendado' || agendamento.status === 'pendente'
                            ? 'bg-gray-100 text-gray-800' 
                            : agendamento.status === 'confirmado'
                            ? 'bg-green-100 text-green-800'
                            : agendamento.status === 'realizado'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {formatarTexto(agendamento.status)}
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
                    
                    {(agendamento.status === 'agendado' || agendamento.status === 'confirmado' || agendamento.status === 'pendente') && (
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
                            setTipoSelecionado(agendamento.tipo);
                            setMostrarModal(true);
                          }}
                        >
                          ✎ Editar
                        </button>
                        <button
                          onClick={() => {
                            setAgendamentoEditando(agendamento);
                            setMostrarModalRealizado(true);
                          }}
                          
                          className="inline-flex items-center justify-center px-3 py-1.5 border border-blue-600 text-blue-700 hover:bg-blue-50 rounded-lg text-sm transition-colors"
                        >
                          <CheckCircle size={14} className="mr-1" />
                          Realizado
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