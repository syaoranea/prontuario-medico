import React, { useState, useEffect } from 'react';
import { 
  User, 
  Stethoscope, 
  Hand, 
  HeartPulse, 
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MoreVertical,
  X,
  Edit,
  Trash2
} from 'lucide-react';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Profissional } from '../interface/interface';
import { useFeedback } from '../components/FeedbackProvider';
import { useConfirm } from '../components/ConfirmProvider';
import { useAuditoria } from '../config/auditoria';

const Profissionais: React.FC = () => {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [filtro, setFiltro] = useState<string>('Todos');
  const [busca, setBusca] = useState<string>('');
  const [carregando, setCarregando] = useState(true);
  const { notificar } = useFeedback();
  const { confirmar } = useConfirm();
  const { registrar } = useAuditoria();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [novoProfissional, setNovoProfissional] = useState<Omit<Profissional, 'id'>>({
    nome: '',
    tipo: 'Médico',
    especialidade: '',
    registro: '',
    contato: '',
    email: '',
    pix: '',
  });

  useEffect(() => {
    buscarProfissionais();
  }, []);

  const buscarProfissionais = async () => {
    setCarregando(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'profissionais'));
      const dados = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Profissional[];
      
      // Se estiver vazio no Firebase, podemos colocar alguns dados de exemplo para visualização inicial
      if (dados.length === 0) {
        const mockData: Profissional[] = [
          {
            id: '1',
            nome: 'Dr. Ricardo Silva',
            tipo: 'Médico',
            especialidade: 'Cardiologia',
            registro: 'CRM 12345',
            contato: '(11) 98888-7777',
            email: 'ricardo.silva@email.com'
          },
          {
            id: '2',
            nome: 'Dra. Ana Oliveira',
            tipo: 'Médico',
            especialidade: 'Geriatria',
            registro: 'CRM 54321',
            contato: '(11) 97777-6666',
            email: 'ana.oliveira@email.com'
          },
          {
            id: '3',
            nome: 'Marcos Souza',
            tipo: 'Fisioterapeuta',
            especialidade: 'Fisioterapia Respiratória',
            registro: 'CREFITO 6789',
            contato: '(11) 96666-5555',
            email: 'marcos.fisioterapia@email.com'
          },
          {
            id: '4',
            nome: 'Juliana Costa',
            tipo: 'Enfermeiro',
            especialidade: 'Enfermagem Geral',
            registro: 'COREN 9876',
            contato: '(11) 95555-4444',
            email: 'juliana.enfermagem@email.com'
          },
          {
            id: '5',
            nome: 'Clara Mendes',
            tipo: 'Cuidador',
            especialidade: 'Cuidados Paliativos',
            contato: '(11) 94444-3333',
            email: 'clara.cuidador@email.com'
          }
        ];
        setProfissionais(mockData);
      } else {
        setProfissionais(dados);
      }
    } catch (error) {
      console.error('Erro ao buscar profissionais:', error);
    } finally {
      setCarregando(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNovoProfissional(prev => ({ ...prev, [name]: value }));
  };

  const handleAbrirModal = (p?: Profissional) => {
    if (p) {
      setIdEditando(p.id);
      setNovoProfissional({
        nome: p.nome,
        tipo: p.tipo,
        especialidade: p.especialidade || '',
        registro: p.registro || '',
        contato: p.contato,
        email: p.email || '',
        pix: p.pix || '',
      });
    } else {
      setIdEditando(null);
      setNovoProfissional({
        nome: '',
        tipo: 'Médico',
        especialidade: '',
        registro: '',
        contato: '',
        email: '',
        pix: '',
      });
    }
    setIsModalOpen(true);
    setMenuAberto(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      if (idEditando) {
        await updateDoc(doc(db, 'profissionais', idEditando), novoProfissional);
        registrar('editar', 'profissional', idEditando, novoProfissional.nome);
      } else {
        const ref = await addDoc(collection(db, 'profissionais'), novoProfissional);
        registrar('criar', 'profissional', ref.id, novoProfissional.nome);
      }
      setIsModalOpen(false);
      buscarProfissionais();
    } catch (error) {
      console.error('Erro ao salvar profissional:', error);
      notificar('erro', 'Erro ao salvar profissional. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    const ok = await confirmar({
      titulo: 'Excluir profissional',
      mensagem: `Tem certeza que deseja excluir o profissional ${nome}?`,
      textoConfirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'profissionais', id));
      registrar('excluir', 'profissional', id, nome);
      buscarProfissionais();
      setMenuAberto(null);
    } catch (error) {
      console.error('Erro ao excluir profissional:', error);
      notificar('erro', 'Erro ao excluir o profissional.');
    }
  };

  const tipos = ['Todos', 'Médico', 'Fisioterapeuta', 'Enfermeiro', 'Cuidador'];

  const profissionaisFiltrados = profissionais.filter(p => {
    const matchesFiltro = filtro === 'Todos' || p.tipo === filtro;
    const matchesBusca = p.nome.toLowerCase().includes(busca.toLowerCase()) || 
                         (p.especialidade?.toLowerCase()?.includes(busca.toLowerCase()) ?? false);
    return matchesFiltro && matchesBusca;
  });

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'Médico': return <Stethoscope size={20} />;
      case 'Fisioterapeuta': return <Hand size={20} />;
      case 'Enfermeiro': return <HeartPulse size={20} />;
      case 'Cuidador': return <Users size={20} />;
      default: return <User size={20} />;
    }
  };

  const getColor = (tipo: string) => {
    switch (tipo) {
      case 'Médico': return 'bg-blue-100 text-blue-600';
      case 'Fisioterapeuta': return 'bg-green-100 text-green-600';
      case 'Enfermeiro': return 'bg-red-100 text-red-600';
      case 'Cuidador': return 'bg-purple-100 text-purple-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Equipe de Profissionais</h1>
          <p className="text-gray-500">Gerencie os profissionais que cuidam da sua saúde</p>
        </div>
        <button 
          onClick={() => handleAbrirModal()}
          className="flex items-center justify-center bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={20} className="mr-2" />
          Novo Profissional
        </button>
      </div>

      {/* Modal de Cadastro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">
                {idEditando ? 'Editar Profissional' : 'Cadastrar Novo Profissional'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <input
                    required
                    type="text"
                    name="nome"
                    value={novoProfissional.nome}
                    onChange={handleInputChange}
                    placeholder="Ex: Dr. João Silva"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    name="tipo"
                    value={novoProfissional.tipo}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  >
                    <option value="Médico">Médico</option>
                    <option value="Fisioterapeuta">Fisioterapeuta</option>
                    <option value="Enfermeiro">Enfermeiro</option>
                    <option value="Cuidador">Cuidador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Especialidade</label>
                  <input
                    type="text"
                    name="especialidade"
                    value={novoProfissional.especialidade}
                    onChange={handleInputChange}
                    placeholder="Ex: Cardiologia"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registro (CRM/COREN/etc)</label>
                  <input
                    type="text"
                    name="registro"
                    value={novoProfissional.registro}
                    onChange={handleInputChange}
                    placeholder="Ex: CRM 123456"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contato/Telefone</label>
                  <input
                    required
                    type="text"
                    name="contato"
                    value={novoProfissional.contato}
                    onChange={handleInputChange}
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    name="email"
                    value={novoProfissional.email}
                    onChange={handleInputChange}
                    placeholder="email@exemplo.com"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pix (Chave)</label>
                  <input
                    type="text"
                    name="pix"
                    value={novoProfissional.pix}
                    onChange={handleInputChange}
                    placeholder="E-mail, CPF, Celular ou Aleatória"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {salvando ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Salvar Profissional'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou especialidade..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {tipos.map(t => (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filtro === t 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profissionaisFiltrados.map(p => (
            <div key={p.id} className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5 flex-grow">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${getColor(p.tipo)}`}>
                    {getIcon(p.tipo)}
                  </div>
                  <div className="relative">
                    <button 
                      onClick={() => setMenuAberto(menuAberto === p.id ? null : p.id)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <MoreVertical size={20} />
                    </button>
                    
                    {menuAberto === p.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-[60]" 
                          onClick={() => setMenuAberto(null)}
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 z-[70] py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          <button
                            onClick={() => handleAbrirModal(p)}
                            className="w-full flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Edit size={16} className="mr-3 text-gray-400" />
                            Editar Dados
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.nome)}
                            className="w-full flex items-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={16} className="mr-3 text-red-400" />
                            Excluir Profissional
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-gray-800 mb-1">{p.nome}</h3>
                <p className="text-primary-600 text-sm font-medium mb-1">{p.especialidade || p.tipo}</p>
                {p.registro && (
                  <p className="text-xs text-gray-400 mb-4">{p.registro}</p>
                )}

                <div className="space-y-2 mt-4 pt-4 border-t border-gray-50">
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone size={16} className="mr-2 text-gray-400" />
                    {p.contato}
                  </div>
                  {p.email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail size={16} className="mr-2 text-gray-400" />
                      {p.email}
                    </div>
                  )}
                  {p.pix && (
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="font-semibold text-xs text-primary-600 mr-2">PIX:</span>
                      {p.pix}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-gray-50 px-5 py-3 flex justify-between mt-auto">
                <button className="text-primary-600 text-sm font-medium hover:underline">
                  Ver Histórico
                </button>
                <button className="text-primary-600 text-sm font-medium hover:underline">
                  Agendar
                </button>
              </div>
            </div>
          ))}
          
          {profissionaisFiltrados.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500">
              <Users size={48} className="mb-4 opacity-20" />
              <p>Nenhum profissional encontrado.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Profissionais;
