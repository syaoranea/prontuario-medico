import React, { useState, useEffect, Fragment } from 'react';
import { Calendar, Search, Filter, FileText, User, PlusCircle, X, Trash2, Save, Upload, MapPin, Stethoscope, ClipboardList, Building2, User2, Info, ShieldCheck, AlertTriangle } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, addDoc, Timestamp, deleteDoc  } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getStorage, uploadBytesResumable } from 'firebase/storage';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase'; // ajuste o caminho
import { Dialog, Transition } from '@headlessui/react';


interface RegistroMedico {
  id: string;
  tipo: 'consulta' | 'exame' | 'cirurgia' | 'vacinacao' | 'internacao';
  data: string;
  titulo: string;
  descricao: string;
  medico: string;
  especialidade: string;
  instituicao: string;
  documentos?: { id: string; nome: string; tipo: string; url: string}[];
}

interface Documento {
  id: string;
  nome: string;
  tipo: string;
  categoria: string;
  data: string;
  tamanho: string;
  origem: string;
  descricao?: string;
  url: string;
}

const HistoricoMedico: React.FC = () => {

  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [busca, setBusca] = useState<string>('');
  const [carregando, setCarregando] = useState<boolean>(true);
  const [registros, setRegistros] = useState<RegistroMedico[]>([]);
  const [registroSelecionado, setRegistroSelecionado] = useState<RegistroMedico | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [novoRegistro, setNovoRegistro] = useState<Partial<RegistroMedico>>({});
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [tipoMensagem, setTipoMensagem] = useState<'sucesso' | 'erro' | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const closeModal = () => {
    setIsOpen(false);
    setIsEditing(false);
    setRegistroSelecionado(null);
    setNovoRegistro({});
    setArquivo(null);
    setProgresso(0);
  };

  const openNewModal = () => {
    setNovoRegistro({
      tipo: 'consulta',
      data: new Date().toISOString().split('T')[0],
      titulo: '',
      descricao: '',
      medico: '',
      especialidade: '',
      instituicao: '',
    });
    setIsEditing(false);
    setIsOpen(true);
  };

  const openEditModal = (registro: RegistroMedico) => {
    setRegistroSelecionado(registro);
    setIsEditing(true);
    setIsOpen(true);
  };

  // Carrega dados do Firestore
  useEffect(() => {
    const buscarRegistros = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'historicoMedico'));
        const dados = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log('Registros encontrados:', dados);
        // Ordenar do mais novo para o mais velho (assumindo formato ISO ou Timestamp convertido)
      const dadosOrdenados = dados.sort((a, b) => {
        const dataA = new Date(a.data).getTime();
        const dataB = new Date(b.data).getTime();
        return dataB - dataA;
      });
        setRegistros(dadosOrdenados as RegistroMedico[]);
      } catch (erro) {
        console.error('Erro ao buscar registros médicos:', erro);
      } finally {
        setCarregando(false);
      }
    };
  
    buscarRegistros();
  }, []);
  
  const abrirModal = (registro: RegistroMedico) => {
    openEditModal(registro);
  };

  const excluirRegistro = () => {
    setIsConfirmOpen(true);
  };

  const confirmarExclusao = async () => {
    if (!registroSelecionado) return;
  
    try {
      await deleteDoc(doc(db, 'historicoMedico', registroSelecionado.id));
  
      setRegistros((prev) => prev.filter((r) => r.id !== registroSelecionado.id));
      setIsConfirmOpen(false);
      closeModal();
  
      setMensagem('Registro excluído com sucesso!');
      setTipoMensagem('sucesso');
    } catch (error) {
      console.error('Erro ao excluir registro:', error);
      setMensagem('Erro ao excluir registro. Tente novamente.');
      setTipoMensagem('erro');
      setIsConfirmOpen(false);
    }
  };


  const handleUpload = () => {
    if (!arquivo) return;
  
    const storageRef = ref(storage, `documentos/${arquivo.name}`);
    const uploadTask = uploadBytesResumable(storageRef, arquivo);
  
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progressoAtual = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgresso(progressoAtual);
      },
      (error) => {
        console.error("Erro ao fazer upload:", error);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
  
          // Cria os dados do documento
          const documentoData = {
            nome: arquivo.name,
            tipo: arquivo.type.split("/")[1]?.toUpperCase() || "PDF",
            categoria: "Exames", // Pode ser dinâmico
            data: new Date().toLocaleDateString("pt-BR"),
            tamanho: `${(arquivo.size / 1024 / 1024).toFixed(1)} MB`,
            origem: "Usuário", // Pode ser substituído por input
            descricao: "", // Opcional
            url, // URL do arquivo no storage
            criadoEm: Timestamp.now(),
          };
  
          // Salva no Firestore
          await addDoc(collection(db, "documentos"), documentoData);
  
          console.log("Documento salvo com sucesso!");
        } catch (err) {
          console.error("Erro ao salvar no Firestore:", err);
        }
  
      }
    );
  };
  

  const handleUploadArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !registroSelecionado) return;
  
    try {
      const caminho = `documentos/${registroSelecionado.id}/${file.name}`;
      const arquivoRef = ref(storage, caminho);
      await uploadBytes(arquivoRef, file);
      const url = await getDownloadURL(arquivoRef);
  
      const novoDocumento = {
        id: Date.now().toString(), // string para evitar conflitos
        nome: file.name,
        tipo: file.type.includes('pdf') ? 'pdf' : 'imagem',
        url,
      };
  
      const novosDocs = [...(registroSelecionado.documentos || []), novoDocumento];
  
      // Atualiza no Firestore
      const registroRef = doc(db, 'historicoMedico', registroSelecionado.id);
      await updateDoc(registroRef, { documentos: novosDocs });
  
      // Atualiza no estado local
      const registroAtualizado = {
        ...registroSelecionado,
        documentos: novosDocs,
      };
      setRegistroSelecionado(registroAtualizado);
      setRegistros((prev) =>
        prev.map((r) => (r.id === registroSelecionado.id ? registroAtualizado : r))
      );
  
      setMensagem('Registro adicionado com sucesso!');
      setTipoMensagem('sucesso');
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      setMensagem('Erro ao salvar alterações. Tente novamente.');
      setTipoMensagem('erro');
    }
  };
  
  const salvarNovoRegistro = async () => {
    if (
      !novoRegistro.tipo ||
      !novoRegistro.data ||
      !novoRegistro.titulo ||
      !novoRegistro.descricao ||
      !novoRegistro.medico ||
      !novoRegistro.especialidade ||
      !novoRegistro.instituicao
    ) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }
  
    try {
      const docRef = await addDoc(collection(db, 'historicoMedico'), {
        ...novoRegistro,
        documentos: [],
      });

      handleUpload();
  
      const registroSalvo: RegistroMedico = {
        id: docRef.id,
        ...(novoRegistro as RegistroMedico),
        documentos: [],
      };
  
      setRegistros((prev) => [registroSalvo, ...prev]);
      closeModal();
      setMensagem('Registro adicionado com sucesso!');
      setTipoMensagem('sucesso');
    } catch (error) {
      console.error('Erro ao adicionar registro:', error);
      setMensagem('Erro ao salvar alterações. Tente novamente.');
      setTipoMensagem('erro');
    }
  };
  

  const salvarAlteracoes = async () => {
    if (!registroSelecionado) return;
  
    try {
      const registroRef = doc(db, 'historicoMedico', registroSelecionado.id);
      
      // cria uma cópia do objeto sem o campo `id` (Firestore não aceita esse campo no update)
      const { id, ...dadosParaSalvar } = registroSelecionado;
  
      await updateDoc(registroRef, dadosParaSalvar);
      console.log('Registro atualizado com sucesso!');
      handleUpload();
      // Atualiza localmente
      setRegistros((prev) =>
        prev.map((r) => (r.id === registroSelecionado.id ? registroSelecionado : r))
      );
  
      closeModal();
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
      setMensagem('Erro ao salvar alterações. Tente novamente.');
      setTipoMensagem('erro');
    }
  };
  

  const registrosFiltrados = registros.filter((registro) => {
    // Filtro por tipo
    if (filtroTipo !== 'todos' && registro.tipo !== filtroTipo) return false;
  
    // Filtro por texto de busca
    if (busca.trim()) {
      const textoBusca = busca.toLowerCase();
      const campos = [
        registro.titulo,
        registro.medico,
        registro.especialidade,
        registro.instituicao,
      ];
      const emTexto = campos.map((campo) => campo?.toLowerCase() || '').join(' ');
      return emTexto.includes(textoBusca);
    }
  
    return true;
  });
  
  

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Histórico Médico</h1>
        
        <button
           onClick={openNewModal}
          className="mt-4 md:mt-0 inline-flex items-center justify-center px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 font-semibold">
          <PlusCircle size={20} className="mr-2" />
          Novo Registro
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4">
          {/* Barra de busca */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar no histórico..."
              className="w-full py-2 pl-10 pr-4 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              <Search size={16} className="text-gray-400" />
            </div>
          </div>
          
          {/* Filtro por tipo */}
          <div className="flex items-center space-x-2">
            <Filter size={16} className="text-gray-400" />
            <select
              className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="todos">Todos os tipos</option>
              <option value="consulta">Consultas</option>
              <option value="exame">Exames</option>
              <option value="cirurgia">Cirurgias</option>
              <option value="vacinacao">Vacinações</option>
              <option value="internacao">Internação</option>
            </select>
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {registrosFiltrados.length > 0 ? (
            registrosFiltrados.map((registro) => (
              <div key={registro.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex items-start">
                    <div className={`p-3 rounded-lg mr-4 ${
                      registro.tipo === 'consulta' 
                        ? 'bg-blue-100 text-blue-600' 
                        : registro.tipo === 'exame'
                        ? 'bg-purple-100 text-purple-600'
                        : registro.tipo === 'cirurgia'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-green-100 text-green-600'
                    }`}>
                      {registro.tipo === 'consulta' && <User size={24} />}
                      {registro.tipo === 'exame' && <FileText size={24} />}
                      {registro.tipo === 'cirurgia' && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                        </svg>
                      )}
                      {registro.tipo === 'vacinacao' && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="text-lg font-semibold text-gray-800">{registro.titulo}</h3>
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full flex items-center">
                          <Calendar size={12} className="mr-1" />
                          {registro.data}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{registro.descricao}</p>
                    </div>
                  </div>

                  <div className="text-right mt-2 md:mt-0">
                    <button
                      onClick={() => abrirModal(registro)}
                      className="mt-4 inline-flex items-center px-4 py-2 text-primary-600 font-semibold hover:bg-primary-50 rounded-lg transition-colors border border-primary-100"
                    >
                      Ver detalhes
                    </button>
                  </div>
                </div>

                {/* Rodapé do Card com Bio/Instituição */}
                <div className="mt-6 pt-4 border-t border-gray-50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gray-50 rounded-lg text-gray-400"><User size={14} /></div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Profissional</p>
                        <p className="text-sm font-bold text-gray-700">{registro.medico}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gray-50 rounded-lg text-gray-400"><Building2 size={14} /></div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Instituição</p>
                        <p className="text-sm font-bold text-gray-700">{registro.instituicao}</p>
                      </div>
                    </div>
                  </div>

                  {registro.documentos && registro.documentos.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Anexos:</span>
                      <div className="flex -space-x-2">
                        {registro.documentos.map((doc, idx) => (
                          <div key={doc.id} className="w-7 h-7 rounded-full bg-white border-2 border-gray-50 flex items-center justify-center text-primary-600 shadow-sm" title={doc.nome}>
                            <FileText size={12} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={32} />
              </div>
              <p className="text-gray-500 font-medium">Nenhum registro encontrado com os filtros selecionados.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Redesenhado */}
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all border border-gray-100">
                  {/* Modal Header */}
                  <div className="relative p-6 bg-gradient-to-r from-primary-600 to-primary-500 text-white">
                    <Dialog.Title as="h3" className="text-xl md:text-2xl font-bold flex items-center gap-3">
                      {isEditing ? (
                        <div className="p-2 bg-white/20 rounded-lg shadow-inner"><FileText className="w-6 h-6" /></div>
                      ) : (
                        <div className="p-2 bg-white/20 rounded-lg shadow-inner"><PlusCircle className="w-6 h-6" /></div>
                      )}
                      {isEditing ? 'Detalhes do Registro' : 'Novo Registro Médico'}
                    </Dialog.Title>
                    <button 
                      onClick={closeModal} 
                      className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/20 transition-colors"
                      title="Fechar"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <p className="mt-2 text-primary-50 text-sm opacity-90">
                      Preencha as informações detalhadas sobre a ocorrência médica.
                    </p>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 md:p-8 space-y-8 max-h-[70vh] overflow-y-auto bg-gray-50/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      
                      {/* Seção 1: Informações Básicas */}
                      <div className="md:col-span-2 flex items-center gap-2 border-b border-gray-100 pb-2">
                        <Info className="w-4 h-4 text-primary-500" />
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Informações Básicas</h4>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 ml-1">
                          <Filter className="w-3.5 h-3.5" /> Tipo
                        </label>
                        <select
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none text-gray-700 font-medium"
                          value={isEditing ? registroSelecionado?.tipo : novoRegistro.tipo}
                          onChange={(e) => {
                            const val = e.target.value as RegistroMedico['tipo'];
                            isEditing 
                              ? setRegistroSelecionado({ ...registroSelecionado!, tipo: val })
                              : setNovoRegistro({ ...novoRegistro, tipo: val });
                          }}
                        >
                          <option value="consulta">Consulta</option>
                          <option value="exame">Exame</option>
                          <option value="cirurgia">Cirurgia</option>
                          <option value="vacinacao">Vacinação</option>
                          <option value="internacao">Internação</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 ml-1">
                          <Calendar className="w-3.5 h-3.5" /> Data
                        </label>
                        <input
                          type="date"
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none text-gray-700 font-medium"
                          value={isEditing ? registroSelecionado?.data : novoRegistro.data}
                          onChange={(e) => {
                            const val = e.target.value;
                            isEditing 
                              ? setRegistroSelecionado({ ...registroSelecionado!, data: val })
                              : setNovoRegistro({ ...novoRegistro, data: val });
                          }}
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 ml-1">
                          <FileText className="w-3.5 h-3.5" /> Título
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Consulta de Rotina - Cardiologia"
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none text-gray-800 font-semibold"
                          value={isEditing ? registroSelecionado?.titulo : novoRegistro.titulo}
                          onChange={(e) => {
                            const val = e.target.value;
                            isEditing 
                              ? setRegistroSelecionado({ ...registroSelecionado!, titulo: val })
                              : setNovoRegistro({ ...novoRegistro, titulo: val });
                          }}
                        />
                      </div>

                      {/* Seção 2: Profissional e Local */}
                      <div className="md:col-span-2 flex items-center gap-2 border-b border-gray-100 pb-2 mt-2">
                        <Stethoscope className="w-4 h-4 text-primary-500" />
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Profissional e Local</h4>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 ml-1">
                          <User2 className="w-3.5 h-3.5" /> Médico(a) / Profissional
                        </label>
                        <input
                          type="text"
                          placeholder="Nome do médico"
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none text-gray-700 font-medium"
                          value={isEditing ? registroSelecionado?.medico : novoRegistro.medico}
                          onChange={(e) => {
                            const val = e.target.value;
                            isEditing 
                              ? setRegistroSelecionado({ ...registroSelecionado!, medico: val })
                              : setNovoRegistro({ ...novoRegistro, medico: val });
                          }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 ml-1">
                          <ClipboardList className="w-3.5 h-3.5" /> Especialidade
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Clínico Geral"
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none text-gray-700 font-medium"
                          value={isEditing ? registroSelecionado?.especialidade : novoRegistro.especialidade}
                          onChange={(e) => {
                            const val = e.target.value;
                            isEditing 
                              ? setRegistroSelecionado({ ...registroSelecionado!, especialidade: val })
                              : setNovoRegistro({ ...novoRegistro, especialidade: val });
                          }}
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 ml-1">
                          <Building2 className="w-3.5 h-3.5" /> Instituição / Local
                        </label>
                        <input
                          type="text"
                          placeholder="Hospital, Clínica ou Unidade de Saúde"
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none text-gray-700 font-medium"
                          value={isEditing ? registroSelecionado?.instituicao : novoRegistro.instituicao}
                          onChange={(e) => {
                            const val = e.target.value;
                            isEditing 
                              ? setRegistroSelecionado({ ...registroSelecionado!, instituicao: val })
                              : setNovoRegistro({ ...novoRegistro, instituicao: val });
                          }}
                        />
                      </div>

                      {/* Seção 3: Observações e Arquivos */}
                      <div className="md:col-span-2 flex items-center gap-2 border-b border-gray-100 pb-2 mt-2">
                        <MapPin className="w-4 h-4 text-primary-500" />
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Anotações e Prontuário</h4>
                      </div>

                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 ml-1">
                          Observações
                        </label>
                        <textarea
                          placeholder="Relato detalhado da consulta, exames solicitados ou recomendações..."
                          rows={4}
                          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none text-gray-700 font-medium resize-none"
                          value={isEditing ? registroSelecionado?.descricao : novoRegistro.descricao}
                          onChange={(e) => {
                            const val = e.target.value;
                            isEditing 
                              ? setRegistroSelecionado({ ...registroSelecionado!, descricao: val })
                              : setNovoRegistro({ ...novoRegistro, descricao: val });
                          }}
                        />
                      </div>

                      <div className="md:col-span-2 space-y-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center justify-between ml-1">
                          <div className="flex items-center gap-2"><Upload className="w-3.5 h-3.5" /> Documentos e Laudos</div>
                          {isEditing && registroSelecionado?.documentos && registroSelecionado.documentos.length > 0 && (
                            <span className="text-xs text-primary-600 font-bold">{registroSelecionado.documentos.length} arquivo(s)</span>
                          )}
                        </label>
                        
                        <div className="relative group">
                          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-white hover:border-primary-300 transition-all cursor-pointer">
                            <Upload className="w-8 h-8 text-gray-300 mb-2 group-hover:text-primary-400 group-hover:scale-110 transition-all" />
                            <p className="text-sm text-gray-500 font-medium">Clique para selecionar ou arraste arquivos</p>
                            <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG (máx. 10MB)</p>
                            <input
                              type="file"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                            />
                          </div>
                          {arquivo && (
                            <div className="mt-3 flex items-center gap-3 p-3 bg-primary-50 text-primary-700 rounded-xl border border-primary-100">
                              <FileText className="w-5 h-5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{arquivo.name}</p>
                                <p className="text-xs opacity-70">Arquivo selecionado para upload</p>
                              </div>
                              <button onClick={() => setArquivo(null)} className="p-1 hover:bg-primary-100 rounded-full">
                                <X size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {isEditing && registroSelecionado?.documentos && registroSelecionado.documentos.length > 0 && (
                           <div className="flex flex-wrap gap-2 mt-2">
                             {registroSelecionado.documentos.map((doc) => (
                               <a 
                                 key={doc.id} 
                                 href={doc.url} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm"
                               >
                                 <FileText size={14} className="text-red-500" />
                                 {doc.nome}
                               </a>
                             ))}
                           </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-6 bg-gray-50 md:flex items-center justify-between gap-4 border-t border-gray-100">
                    <div className="mb-4 md:mb-0">
                      {isEditing && (
                        <button
                          onClick={excluirRegistro}
                          className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all font-bold text-sm"
                        >
                          <Trash2 className="w-4 h-4" /> Excluir Registro
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <button
                        onClick={closeModal}
                        className="w-full sm:w-auto px-6 py-2.5 text-gray-600 hover:bg-white rounded-xl transition-all font-bold border border-transparent hover:border-gray-200"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={isEditing ? salvarAlteracoes : salvarNovoRegistro}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-200 transition-all font-bold active:scale-95"
                      >
                        <Save className="w-4 h-4" /> {isEditing ? 'Salvar Alterações' : 'Salvar Registro'}
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Modal de Confirmação de Exclusão */}
      <Transition appear show={isConfirmOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[70]" onClose={() => setIsConfirmOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-center align-middle shadow-2xl transition-all border border-gray-100">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} />
                  </div>
                  <Dialog.Title as="h3" className="text-xl font-bold leading-6 text-gray-900">
                    Excluir Registro Permanente?
                  </Dialog.Title>
                  <div className="mt-3">
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Você está prestes a excluir o registro <span className="font-bold text-gray-700">"{registroSelecionado?.titulo}"</span>. 
                      Esta ação é irreversível e removerá todos os dados e vínculos associados de forma permanente.
                    </p>
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                      onClick={() => setIsConfirmOpen(false)}
                    >
                      Não, manter registro
                    </button>
                    <button
                      type="button"
                      className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-200 transition-all active:scale-95"
                      onClick={confirmarExclusao}
                    >
                      Sim, excluir agora
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Mensagens de Feedback */}
      {mensagem && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]">
          <div className="bg-white shadow-2xl rounded-2xl p-6 w-full max-w-sm text-center relative border border-gray-100">
            <button
              onClick={() => setMensagem(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={20} />
            </button>
            <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4 ${tipoMensagem === 'sucesso' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              {tipoMensagem === 'sucesso' ? <ShieldCheck size={28} /> : <Info size={28} />}
            </div>
            <h2 className={`text-xl font-bold mb-2 ${tipoMensagem === 'sucesso' ? 'text-green-600' : 'text-red-600'}`}>
              {tipoMensagem === 'sucesso' ? 'Sucesso!' : 'Ocorreu um erro'}
            </h2>
            <p className="text-gray-600 font-medium">{mensagem}</p>
            <button 
              onClick={() => setMensagem(null)}
              className="mt-6 w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-bold"
            >
              Ok, fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricoMedico;