import React, { useState, useEffect } from 'react';
import { Calendar, Search, Filter, FileText, User, PlusCircle } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, addDoc  } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getStorage } from 'firebase/storage';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase'; // ajuste o caminho


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

/* const registrosMedicos: RegistroMedico[] = [
  {
    id: 1,
    tipo: 'consulta',
    data: '15/05/2025',
    titulo: 'Consulta de Rotina - Cardiologia',
    descricao: 'Avaliação cardíaca de rotina. PA: 120/80 mmHg. FC: 72 bpm. Ausculta cardíaca normal.',
    medico: 'Dr. João Santos',
    especialidade: 'Cardiologia',
    instituicao: 'Hospital Santa Lucia',
    documentos: [
      { id: 1, nome: 'Receita - Losartana', tipo: 'pdf' },
      { id: 2, nome: 'Solicitação de Exames', tipo: 'pdf' },
    ],
  },
  {
    id: 2,
    tipo: 'exame',
    data: '20/05/2025',
    titulo: 'Hemograma Completo',
    descricao: 'Hemoglobina: 14.2 g/dL, Leucócitos: 7.500/mm³, Plaquetas: 250.000/mm³. Resultados dentro da normalidade.',
    medico: 'Dra. Ana Ferreira',
    especialidade: 'Hematologia',
    instituicao: 'Laboratório Central',
    documentos: [
      { id: 3, nome: 'Resultado - Hemograma', tipo: 'pdf' },
    ],
  },
  {
    id: 3,
    tipo: 'vacinacao',
    data: '10/04/2025',
    titulo: 'Vacina contra Influenza',
    descricao: 'Aplicação da vacina quadrivalente contra Influenza. Sem reações adversas imediatas.',
    medico: 'Enf. Carlos Oliveira',
    especialidade: 'Imunização',
    instituicao: 'Posto de Saúde Central',
    documentos: [
      { id: 4, nome: 'Carteira de Vacinação', tipo: 'pdf' },
    ],
  },
  {
    id: 4,
    tipo: 'consulta',
    data: '05/03/2025',
    titulo: 'Consulta - Endocrinologia',
    descricao: 'Avaliação do controle glicêmico. Glicemia de jejum: 95 mg/dL. HbA1c: 6.2%. Bom controle.',
    medico: 'Dra. Mariana Costa',
    especialidade: 'Endocrinologia',
    instituicao: 'Clínica Saúde Integral',
    documentos: [
      { id: 5, nome: 'Receita - Metformina', tipo: 'pdf' },
    ],
  },
]; */

const HistoricoMedico: React.FC = () => {

  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [busca, setBusca] = useState<string>('');
  const [carregando, setCarregando] = useState<boolean>(true);
  const [registros, setRegistros] = useState<RegistroMedico[]>([]);
  const [registroSelecionado, setRegistroSelecionado] = useState<RegistroMedico | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [novoRegistro, setNovoRegistro] = useState<Partial<RegistroMedico>>({});
const [modalNovoAberto, setModalNovoAberto] = useState(false);
const [mensagem, setMensagem] = useState<string | null>(null);
const [tipoMensagem, setTipoMensagem] = useState<'sucesso' | 'erro' | null>(null);

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
    setRegistroSelecionado(registro);
    setModalAberto(true);
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
  
      const registroSalvo: RegistroMedico = {
        id: docRef.id,
        ...(novoRegistro as RegistroMedico),
        documentos: [],
      };
  
      setRegistros((prev) => [registroSalvo, ...prev]);
      setModalNovoAberto(false);
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
  
      // Atualiza localmente
      setRegistros((prev) =>
        prev.map((r) => (r.id === registroSelecionado.id ? registroSelecionado : r))
      );
  
      setModalAberto(false);
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
           onClick={() => {
            setNovoRegistro({});
            setModalNovoAberto(true);
          }}
          className="mt-4 md:mt-0 inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          <PlusCircle size={16} className="mr-2" />
          Adicionar Registro
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

                    {registroSelecionado?.documentos?.map((doc) => (
                      <div key={doc.id}>
                        <a href={doc.url} target="_blank" className="text-blue-600 underline">
                          {doc.nome}
                        </a>
                      </div>
                    ))}
                  </div>
                  {mensagem && (
                    <div className="fixed inset-0 flex items-center justify-center z-50">
                      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-sm text-center relative">
                        <button
                          onClick={() => setMensagem(null)}
                          className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
                        >
                          ×
                        </button>
                        <h2 className={`text-lg font-bold mb-2 ${tipoMensagem === 'sucesso' ? 'text-green-600' : 'text-red-600'}`}>
                          {tipoMensagem === 'sucesso' ? 'Sucesso!' : 'Erro'}
                        </h2>
                        <p className="text-gray-700">{mensagem}</p>
                      </div>
                    </div>
                  )}

                  <div className="text-right mt-2 md:mt-0">
                  <button
                    onClick={() => abrirModal(registro)}
                    className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Ver detalhes
                  </button>
                  </div>
                </div>

                {modalAberto && registroSelecionado && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-xl space-y-4 relative">
                      <button
                        onClick={() => setModalAberto(false)}
                        className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
                      >
                        ×
                      </button>

                      <h2 className="text-xl font-bold">Editar Registro</h2>
                      <p>Titulo</p>
                      <div className="grid grid-cols-1 gap-4">
                        <input
                          type="text"
                          className="border p-2 rounded"
                          value={registroSelecionado.titulo || ''}
                          onChange={(e) =>
                            setRegistroSelecionado({ ...registroSelecionado, titulo: e.target.value })
                          }
                        />
                        <p>Medico</p>
                        <input
                          type="text"
                          className="border p-2 rounded"
                          value={registroSelecionado.medico || ''}
                          onChange={(e) =>
                            setRegistroSelecionado({ ...registroSelecionado, medico: e.target.value })
                          }
                        />
                        <p>Especialidade</p>
                        <input
                          type="text"
                          className="border p-2 rounded"
                          value={registroSelecionado.especialidade || ''}
                          onChange={(e) =>
                            setRegistroSelecionado({ ...registroSelecionado, especialidade: e.target.value })
                          }
                        />
                        <p>Data</p>
                        <input
                          type="date"
                          className="border p-2 rounded"
                          value={registroSelecionado.data || ''}
                          onChange={(e) =>
                            setRegistroSelecionado({ ...registroSelecionado, data: e.target.value })
                          }
                        />
                        <p className=''>Descrição</p>
                        <textarea
                          className="border p-2 rounded"
                          value={registroSelecionado.descricao || ''}
                          onChange={(e) =>
                            setRegistroSelecionado({ ...registroSelecionado, descricao: e.target.value })
                          }
                        />
                        <p className=''>Arquivo</p>
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          onChange={handleUploadArquivo}
                        />

                      </div>

                      <button
                        onClick={salvarAlteracoes}
                        className="mt-4 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
                      >
                        Salvar alterações
                      </button>

                    </div>
                  </div>
                )}

                {modalNovoAberto && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-xl space-y-4 relative">
                      <button
                        onClick={() => setModalNovoAberto(false)}
                        className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
                      >
                        ×
                      </button>

                      <h2 className="text-xl font-bold">Novo Registro Médico</h2>

                      <div className="grid grid-cols-1 gap-4">
                        <select
                          className="border p-2 rounded"
                          value={novoRegistro.tipo || ''}
                          onChange={(e) => setNovoRegistro({ ...novoRegistro, tipo: e.target.value as RegistroMedico['tipo'] })}
                        >
                          <option value="">Selecione o tipo</option>
                          <option value="consulta">Consulta</option>
                          <option value="exame">Exame</option>
                          <option value="cirurgia">Cirurgia</option>
                          <option value="vacinacao">Vacinação</option>
                          <option value="internacao">Internação</option>
                        </select>

                        <input
                          type="date"
                          className="border p-2 rounded"
                          value={novoRegistro.data || ''}
                          onChange={(e) => setNovoRegistro({ ...novoRegistro, data: e.target.value })}
                        />

                        <input
                          type="text"
                          className="border p-2 rounded"
                          placeholder="Título"
                          value={novoRegistro.titulo || ''}
                          onChange={(e) => setNovoRegistro({ ...novoRegistro, titulo: e.target.value })}
                        />

                        <input
                          type="text"
                          className="border p-2 rounded"
                          placeholder="Médico"
                          value={novoRegistro.medico || ''}
                          onChange={(e) => setNovoRegistro({ ...novoRegistro, medico: e.target.value })}
                        />

                        <input
                          type="text"
                          className="border p-2 rounded"
                          placeholder="Especialidade"
                          value={novoRegistro.especialidade || ''}
                          onChange={(e) => setNovoRegistro({ ...novoRegistro, especialidade: e.target.value })}
                        />

                        <input
                          type="text"
                          className="border p-2 rounded"
                          placeholder="Instituição"
                          value={novoRegistro.instituicao || ''}
                          onChange={(e) => setNovoRegistro({ ...novoRegistro, instituicao: e.target.value })}
                        />

                        <textarea
                          className="border p-2 rounded"
                          placeholder="Descrição"
                          value={novoRegistro.descricao || ''}
                          onChange={(e) => setNovoRegistro({ ...novoRegistro, descricao: e.target.value })}
                        />
                      </div>

                      <button
                        onClick={salvarNovoRegistro}
                        className="mt-4 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
                      >
                        Salvar registro
                      </button>
                    </div>
                  </div>
                )}


                
                <div className="mt-4 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Profissional</p>
                      <p className="text-sm font-medium">{registro.medico}</p>
                      <p className="text-xs text-gray-500">{registro.especialidade}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-gray-500">Instituição</p>
                      <p className="text-sm font-medium">{registro.instituicao}</p>
                    </div>
                  </div>
                  
                  {registro.documentos && registro.documentos.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Documentos</p>
                      <div className="flex flex-wrap gap-2">
                        {registro.documentos.map((doc) => (
                          <button 
                            key={doc.id} 
                            className="flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            {doc.nome}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">Nenhum registro encontrado com os filtros selecionados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoricoMedico;