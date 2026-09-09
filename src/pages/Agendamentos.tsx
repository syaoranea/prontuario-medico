import React, { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, User, PlusCircle, CheckCircle, XCircle } from 'lucide-react';
import { addDoc, collection, getDocs, updateDoc, doc  } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Agendamento } from '../interface/interface';
import { useAuditoria } from '../config/auditoria';
import { ordinalData, formatarDataBR } from '../utils/datas';

const Agendamentos: React.FC = () => {
  const { registrar } = useAuditoria();
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
const [profissionais, setProfissionais] = useState<any[]>([]);
const [especialidadeSelecionada, setEspecialidadeSelecionada] = useState('');

useEffect(() => {
  if (agendamentoEditando) {
    setEspecialidadeSelecionada(agendamentoEditando.titulo || '');
  }
}, [agendamentoEditando]);

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
    registrar('status', 'agendamento', agendamentoEditando.id, `${agendamentoEditando.titulo ?? ''} · atendimento concluído`.trim());

    // Salva no histórico médico
    const histRef = await addDoc(collection(db, "historicoMedico"), {
      ...dadosHistorico,
      data: agendamentoEditando.data,
      tipo: agendamentoEditando.tipo,
      agendamentoId: agendamentoEditando.id,
    });
    registrar('criar', 'historico', histRef.id, dadosHistorico.titulo);

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
      const medRef = await addDoc(collection(db, "Medicamentos"), {
        ...med,
        status: "ativo",

      });
      registrar('criar', 'medicamento', medRef.id, med.nome);
  }

  if(dadosRetorno.data?.trim() !== ''){
    const retRef = await addDoc(collection(db, "agendamentos"), {
      data: dadosRetorno.data,
      hora: dadosRetorno.hora,
      titulo: dadosHistorico.titulo,
      profissional: dadosHistorico.medico,
      local: dadosHistorico.instituicao,
      tipo: 'consulta',
      status: 'pendente'
    });
    registrar('criar', 'agendamento', retRef.id, `Retorno · ${dadosHistorico.titulo}`);
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
      const exRef = await addDoc(collection(db, "agendamentos"), {
        ...ex,
        tipo: "exame",
        status: "pendente",
      });
      registrar('criar', 'agendamento', exRef.id, `Exame · ${ex.titulo}`);
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
    buscarProfissionais();
  }, []);

  const buscarProfissionais = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'profissionais'));
      const dados = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProfissionais(dados);
    } catch (error) {
      console.error('Erro ao buscar profissionais:', error);
    }
  };
  
  const buscarAgendamentos = async () => {
    setCarregando(true);
    try {
      const snapshot = await getDocs(collection(db, 'agendamentos'));
      const dados: Agendamento[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as unknown as Agendamento[];
          // Ordenar do mais recente para o mais antigo (data tolerante a formatos; hora como desempate)
      const dadosOrdenados = dados.sort((a, b) => {
      const diff = ordinalData(b.data) - ordinalData(a.data);
      if (diff !== 0) return diff;
      return (b.hora || '').localeCompare(a.hora || '');
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
      registrar('status', 'agendamento', agendamento.id, `${agendamento.titulo ?? ''} · realizado`.trim());

      const histRef = await addDoc(collection(db, 'historicoMedico'), {
        tipo: agendamento.tipo === 'procedimento' ? 'cirurgia' : agendamento.tipo,
        data: agendamento.data,
        titulo: agendamento.titulo,
        descricao: agendamento.observacoes,
        medico: agendamento.profissional,
        especialidade: agendamento.especialidade,
        instituicao: agendamento.local,
        documentos: [], // pode adaptar se houver arquivos associados
      });
      registrar('criar', 'historico', histRef.id, agendamento.titulo);
  
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
      registrar('status', 'agendamento', id, `→ ${novoStatus}`);

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
        registrar('editar', 'agendamento', agendamentoEditando.id, dados.titulo);
      } else {
        // Novo agendamento
        const ref = await addDoc(collection(db, 'agendamentos'), dados);
        registrar('criar', 'agendamento', ref.id, dados.titulo);
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
            setEspecialidadeSelecionada('');
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <PlusCircle className="mr-2 text-primary-600" size={24} />
                {agendamentoEditando ? 'Editar' : 'Novo'} {tipoSelecionado && formatarTexto(tipoSelecionado)}
              </h2>
              <button
                onClick={() => setMostrarModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleSalvarAgendamento} className="p-6 space-y-5">
              <input type="hidden" name="tipo" value={tipoSelecionado || ''} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título / Especialidade</label>
                  <input 
                    required
                    type="text" 
                    name="titulo" 
                    placeholder={tipoSelecionado === 'exame' ? "Ex: Raio-X" : "Ex: Cardiologia"}
                    value={especialidadeSelecionada}
                    onChange={(e) => setEspecialidadeSelecionada(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      required
                      type="date" 
                      name="data" 
                      defaultValue={agendamentoEditando?.data || ''}  
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      required
                      type="time" 
                      name="hora" 
                      defaultValue={agendamentoEditando?.hora || ''} 
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Local / Instituição</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      required
                      type="text" 
                      name="local" 
                      placeholder="Nome da clínica ou hospital" 
                      defaultValue={agendamentoEditando?.local || ''} 
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profissional Responsável</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select 
                      name="profissional" 
                      defaultValue={agendamentoEditando?.profissional || ''} 
                      onChange={(e) => {
                        const profissionalNome = e.target.value;
                        const p = profissionais.find(prof => prof.nome === profissionalNome);
                        if (p) {
                          setEspecialidadeSelecionada(p.especialidade || p.tipo);
                        }
                      }}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all appearance-none bg-white"
                    >
                      <option value="">Selecione um profissional</option>
                      {profissionais.map(p => (
                        <option key={p.id} value={p.nome}>{p.nome} ({p.tipo})</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea 
                    name="observacoes" 
                    placeholder="Adicione informações relevantes sobre o agendamento" 
                    defaultValue={agendamentoEditando?.observacoes || ''}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none" 
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-50">
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  className="flex-1 py-3 px-4 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/20"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

{mostrarModalRealizado && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
      <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Concluir Atendimento</h2>
          <p className="text-sm text-gray-500">{agendamentoEditando?.titulo} em {formatarDataBR(agendamentoEditando?.data)}</p>
        </div>
        <button
          onClick={() => setMostrarModalRealizado(false)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <XCircle size={24} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-2 bg-gray-100/50 mx-6 mt-6 rounded-xl border border-gray-200/50">
        {['historico', 'medicamentos', 'exames', 'retorno'].map((aba) => (
          <button
            key={aba}
            onClick={() => setAbaAtiva(aba as any)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              abaAtiva === aba 
                ? 'bg-white text-primary-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            {formatarTexto(aba === 'historico' ? 'Histórico' : aba)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Conteúdo da aba */}
        {abaAtiva === 'historico' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Título do Atendimento</label>
                <input
                  type="text"
                  placeholder="Ex: Consulta de Rotina"
                  value={dadosHistorico.titulo}
                  onChange={(e) => setDadosHistorico({ ...dadosHistorico, titulo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Resumo / Evolução Clínica</label>
                <textarea
                  placeholder="Descreva o que foi tratado no atendimento..."
                  rows={4}
                  value={dadosHistorico.descricao}
                  onChange={(e) => setDadosHistorico({ ...dadosHistorico, descricao: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Profissional</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <select
                    value={dadosHistorico.medico}
                    onChange={(e) => {
                      const nome = e.target.value;
                      const p = profissionais.find(prof => prof.nome === nome);
                      setDadosHistorico({ 
                        ...dadosHistorico, 
                        medico: nome,
                        especialidade: p ? (p.especialidade || p.tipo) : dadosHistorico.especialidade
                      });
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white appearance-none"
                  >
                    <option value="">Selecione o profissional</option>
                    {profissionais.map(p => (
                      <option key={p.id} value={p.nome}>{p.nome} ({p.tipo})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Especialidade</label>
                <input
                  type="text"
                  placeholder="Área de atuação"
                  value={dadosHistorico.especialidade}
                  onChange={(e) => setDadosHistorico({ ...dadosHistorico, especialidade: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Instituição / Local</label>
                <input
                  type="text"
                  placeholder="Nome do hospital ou clínica"
                  value={dadosHistorico.instituicao}
                  onChange={(e) => setDadosHistorico({ ...dadosHistorico, instituicao: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {abaAtiva === 'medicamentos' && (
          <div className="space-y-6">
            {dadosMedicamentos.map((med, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative">
                {idx > 0 && (
                  <button 
                    onClick={() => setDadosMedicamentos(dadosMedicamentos.filter((_, i) => i !== idx))}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500"
                  >
                    <XCircle size={18} />
                  </button>
                )}
                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center">
                  <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs mr-2">{idx + 1}</span>
                  Medicamento
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nome</label>
                    <input
                      type="text"
                      placeholder="Nome do remédio"
                      value={med.nome}
                      onChange={(e) => {
                        const novo = [...dadosMedicamentos];
                        novo[idx].nome = e.target.value;
                        setDadosMedicamentos(novo);
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Dosagem</label>
                    <input
                      type="text"
                      placeholder="Ex: 500mg, 1 comprimido"
                      value={med.dose}
                      onChange={(e) => {
                        const novo = [...dadosMedicamentos];
                        novo[idx].dose = e.target.value;
                        setDadosMedicamentos(novo);
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Frequência</label>
                    <input
                      type="text"
                      placeholder="Ex: 8 em 8 horas"
                      value={med.frequencia}
                      onChange={(e) => {
                        const novo = [...dadosMedicamentos];
                        novo[idx].frequencia = e.target.value;
                        setDadosMedicamentos(novo);
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Instruções</label>
                    <input
                      type="text"
                      placeholder="Ex: Tomar após as refeições"
                      value={med.instrucoes}
                      onChange={(e) => {
                        const novo = [...dadosMedicamentos];
                        novo[idx].instrucoes = e.target.value;
                        setDadosMedicamentos(novo);
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={() => setDadosMedicamentos([...dadosMedicamentos, { nome: '', dose: '', instrucoes: '', frequencia: '', horarios: '', inicio: '', fim: '', estoque: '', medico: ''  }])}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-all font-medium flex items-center justify-center"
            >
              <PlusCircle size={18} className="mr-2" />
              Adicionar Medicamento
            </button>
          </div>
        )}

        {abaAtiva === 'exames' && (
          <div className="space-y-6">
            {dadosExames.map((ex, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative">
                {idx > 0 && (
                  <button 
                    onClick={() => setDadosExames(dadosExames.filter((_, i) => i !== idx))}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500"
                  >
                    <XCircle size={18} />
                  </button>
                )}
                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs mr-2">{idx + 1}</span>
                  Exame Solicitado
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nome do Exame</label>
                    <input
                      type="text"
                      placeholder="Ex: Hemograma"
                      value={ex.titulo}
                      onChange={(e) => {
                        const novo = [...dadosExames];
                        novo[idx].titulo = e.target.value;
                        setDadosExames(novo);
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Laboratório Sugerido</label>
                    <input
                      type="text"
                      placeholder="Nome do local"
                      value={ex.local}
                      onChange={(e) => {
                        const novo = [...dadosExames];
                        novo[idx].local = e.target.value;
                        setDadosExames(novo);
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={() => setDadosExames([...dadosExames, { titulo: '', local: '', data: '', hora: '', profissional: '', observacao: '' }])}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-all font-medium flex items-center justify-center"
            >
              <PlusCircle size={18} className="mr-2" />
              Adicionar Exame
            </button>
          </div>
        )}

        {abaAtiva === 'retorno' && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
              <p className="text-sm text-blue-700 flex items-center">
                <Calendar size={16} className="mr-2" />
                Agendar uma data para retorno ou próxima consulta.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Prevista</label>
                <input
                  type="date"
                  value={dadosRetorno.data}
                  onChange={(e) => setDadosRetorno({ ...dadosRetorno, data: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora Prevista</label>
                <input
                  type="time"
                  value={dadosRetorno.hora}
                  onChange={(e) => setDadosRetorno({ ...dadosRetorno, hora: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3">
        <button
          onClick={() => setMostrarModalRealizado(false)}
          className="flex-1 py-3 px-4 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={salvarRealizado}
          className="flex-1 py-3 px-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-500/20 flex items-center justify-center font-bold"
        >
          <CheckCircle size={20} className="mr-2" />
          Finalizar Atendimento
        </button>
      </div>
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
                          <span>{formatarDataBR(agendamento.data)}</span>
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
                              setEspecialidadeSelecionada(agendamento.titulo || '');
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