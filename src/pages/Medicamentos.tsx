import { Dialog, Transition } from '@headlessui/react';
import React, { Fragment, useEffect, useState } from 'react';
import { Pill, Trash2, Plus, Bell, Calendar, Clock, FileEdit } from 'lucide-react';
import { collection, getDocs, deleteDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Medicamento } from '../interface/interface';

const Medicamentos: React.FC = () => {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [filtro, setFiltro] = useState<'todos' | 'ativo' | 'pausado' | 'finalizado'>('todos');
  const [isOpen, setIsOpen] = useState(false);
  const [isEditando, setIsEditando] = useState(false);
  const [medicamentoEditandoId, setMedicamentoEditandoId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    dosagem: '',
    instrucoes: '',
    frequencia: '',
    horarios: '',
    inicio: '',
    fim: '',
    estoque: 0,
    medico: ''
  });
  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    success: true,
    message: ''
  });
function openModal() {
  setIsOpen(true);
}

const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  const { name, value } = e.target;
  setFormData(prev => ({ ...prev, [name]: value }));
};

const handleCreateMedicamento = async () => {
  const data = {
    ...formData,
    horarios: formData.horarios.split(',').map(h => h.trim()),
    estoque: Number(formData.estoque),
    fim: formData.fim || null,
    status: 'ativo'
  };

  try {
    await addDoc(collection(db, 'Medicamentos'), data);
    closeModal();
    showFeedback(true, 'Medicamento cadastrado com sucesso!');
    setFormData({
      nome: '',
      dosagem: '',
      instrucoes: '',
      frequencia: '',
      horarios: '',
      inicio: '',
      fim: '',
      estoque: 0,
      medico: ''
    });
    fetchMedicamentos(); // chama sua função de atualizar a tela
  } catch (error) {
    showFeedback(false, 'Erro ao cadastrar medicamento.');
    console.error('Erro ao adicionar medicamento:', error);
  }
};

const fetchMedicamentos = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'Medicamentos'));
    const dados = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Medicamento[];

    setMedicamentos(dados);
  } catch (error) {
    console.error('Erro ao buscar medicamentos:', error);
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

  
const handleUpdateMedicamento = async () => {
  if (!medicamentoEditandoId) return;

  const dataAtualizada = {
    ...formData,
    horarios: formData.horarios.split(',').map(h => h.trim()),
    estoque: Number(formData.estoque),
  };

  try {
    const docRef = doc(db, 'Medicamentos', medicamentoEditandoId);
    await updateDoc(docRef, dataAtualizada);

    showFeedback(true, 'Medicamento atualizado com sucesso!');
    closeModal();
    setIsEditando(false);
    setMedicamentoEditandoId(null);
    setFormData({
      nome: '',
      dosagem: '',
      instrucoes: '',
      frequencia: '',
      horarios: '',
      inicio: '',
      fim: '',
      estoque: 0,
      medico: ''
    });
    fetchMedicamentos();
  } catch (error) {
    showFeedback(false, 'Erro ao atualizar medicamento.');
    console.error('Erro ao editar medicamento:', error);
  }
};

function closeModal() {
  setIsOpen(false);
  setIsEditando(false);
  setMedicamentoEditandoId(null);
  setFormData({
    nome: '',
    dosagem: '',
    instrucoes: '',
    frequencia: '',
    horarios: '',
    inicio: '',
    fim: '',
    estoque: 0,
    medico: ''
  });
}


  const abrirEdicao = (medicamento: Medicamento) => {
    setFormData({
      nome: medicamento.nome,
      dosagem: medicamento.dosagem,
      instrucoes: medicamento.instrucoes,
      frequencia: medicamento.frequencia,
      horarios: Array.isArray(medicamento.horarios) ? medicamento.horarios.join(', ') : '',
      inicio: medicamento.inicio,
      fim: medicamento.fim || '',
      estoque: medicamento.estoque,
      medico: medicamento.medico
    });
    setIsEditando(true);
    setMedicamentoEditandoId(medicamento.id);
    openModal();
  };
  

  const showFeedback = (success: boolean, message: string) => {
    setFeedbackModal({ open: true, success, message });
    setTimeout(() => {
      setFeedbackModal({ open: false, success: true, message: '' });
    }, 3000); // fecha automaticamente após 3s
  };

  useEffect(() => {
    carregarMedicamentos();
  }, []);

  const deletarMedicamento = async (id: string) => {
    await deleteDoc(doc(db, 'Medicamentos', id));
    carregarMedicamentos();
  };

  const medicamentosFiltrados = medicamentos.filter(medicamento => {
    if (filtro === 'todos') return true;
    return medicamento.status === filtro;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Medicamentos</h1>
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-3">
          <button className="inline-flex items-center justify-center px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <Bell size={16} className="mr-2" />
            Configurar Lembretes
          </button>
          <button
            onClick={openModal}
            className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} className="mr-2" />
            Adicionar Medicamento
          </button>
        </div>
      </div>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={closeModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    Adicionar Medicamento
                  </Dialog.Title>

                  <div className="mt-4 space-y-3">
                    {[
                      { name: 'nome', label: 'Nome' },
                      { name: 'dosagem', label: 'Dosagem' },
                      { name: 'instrucoes', label: 'Instruções' },
                      { name: 'frequencia', label: 'Frequência' },
                      { name: 'horarios', label: 'Horários (separados por vírgula)' },
                      { name: 'inicio', label: 'Início' },
                      { name: 'fim', label: 'Fim (opcional)' },
                      { name: 'estoque', label: 'Estoque' },
                      { name: 'medico', label: 'Médico' }
                    ].map((field) => (
                      <div key={field.name}>
                        <label className="block text-sm font-medium text-gray-700">{field.label}</label>
                        <input
                          type={field.name === 'estoque' ? 'number' : 'text'}
                          name={field.name}
                          value={(formData as any)[field.name]}
                          onChange={handleChange}
                          className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={closeModal}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
                      onClick={isEditando ? handleUpdateMedicamento : handleCreateMedicamento}

                    >
                      Salvar
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={feedbackModal.open} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setFeedbackModal({ ...feedbackModal, open: false })}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
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
                <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-2xl bg-white p-6 text-center shadow-xl transition-all">
                  <div className={`text-lg font-semibold ${feedbackModal.success ? 'text-green-600' : 'text-red-600'}`}>
                    {feedbackModal.message}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>


      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Filtrar por status:</span>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              {['todos', 'ativo', 'pausado', 'finalizado'].map(status => (
                <button
                  key={status}
                  className={`px-3 py-1 text-sm ${filtro === status ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'} transition-colors`}
                  onClick={() => setFiltro(status as typeof filtro)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {medicamentosFiltrados.length > 0 ? (
            medicamentosFiltrados.map((medicamento) => (
              <div key={medicamento.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start">
                    <div className={`p-3 rounded-lg mr-4 ${
                      medicamento.status === 'ativo'
                        ? 'bg-green-100 text-green-600'
                        : medicamento.status === 'pausado'
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      <Pill size={24} />
                    </div>

                    <div>
                      <div className="flex items-center">
                        <h3 className="text-lg font-semibold text-gray-800">{medicamento.nome}</h3>
                        <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                          {medicamento.dosagem}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{medicamento.instrucoes}</p>
                    </div>
                  </div>

                  <div className="flex mt-4 md:mt-0 gap-2">
                    <button
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                      onClick={() => abrirEdicao(medicamento)}
                    >
                      <FileEdit size={18} />
                    </button>
                    <button
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      onClick={() => deletarMedicamento(medicamento.id)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-start">
                    <Clock size={16} className="mt-0.5 mr-2 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Frequência</p>
                      <p className="text-sm">{medicamento.frequencia}</p>
                      {Array.isArray(medicamento.horarios) && medicamento.horarios.length > 0 && (

                        <div className="flex flex-wrap gap-1 mt-1">
                          {medicamento.horarios.map((horario, index) => (
                            <span key={index} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                              {horario}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start">
                    <Calendar size={16} className="mt-0.5 mr-2 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Período</p>
                      <p className="text-sm">
                        Início: {medicamento.inicio}
                        {medicamento.fim && ` | Fim: ${medicamento.fim}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="mt-0.5 mr-2 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Estoque</p>
                      <div className="flex items-center">
                        <p className="text-sm">{medicamento.estoque} comprimidos</p>
                        {medicamento.estoque <= 10 && (
                          <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">Baixo</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center">
                  <p className="text-xs text-gray-500 mr-2">Prescrito por:</p>
                  <p className="text-xs font-medium">{medicamento.medico}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">Nenhum medicamento encontrado com os filtros selecionados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Medicamentos;