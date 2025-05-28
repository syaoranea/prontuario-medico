import React, { useEffect, useState } from 'react';

import { ref, uploadBytesResumable, getDownloadURL} from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { ChevronDown, ChevronRight, FilePlus, FileText, Filter, Folder, Search, Upload } from 'lucide-react';
import {addDoc , Timestamp , getDocs , collection} from 'firebase/firestore';

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

/* const documentos: Documento[] = [
  {
    id: 1,
    nome: 'Exame de Sangue - Hemograma',
    tipo: 'PDF',
    categoria: 'Exames',
    data: '20/05/2025',
    tamanho: '1.2 MB',
    origem: 'Laboratório Central',
    descricao: 'Hemograma completo realizado em 20/05/2025.',
  },
  {
    id: 2,
    nome: 'Raio-X de Tórax',
    tipo: 'JPEG',
    categoria: 'Exames',
    data: '15/04/2025',
    tamanho: '3.5 MB',
    origem: 'Hospital Santa Lucia',
    descricao: 'Raio-X de tórax em duas incidências.',
  },
  {
    id: 3,
    nome: 'Receita - Losartana',
    tipo: 'PDF',
    categoria: 'Receitas',
    data: '15/05/2025',
    tamanho: '0.5 MB',
    origem: 'Dr. João Santos',
  },
  {
    id: 4,
    nome: 'Atestado Médico',
    tipo: 'PDF',
    categoria: 'Atestados',
    data: '22/04/2025',
    tamanho: '0.3 MB',
    origem: 'Dra. Ana Ferreira',
  },
  {
    id: 5,
    nome: 'Eletrocardiograma',
    tipo: 'PDF',
    categoria: 'Exames',
    data: '10/03/2025',
    tamanho: '2.1 MB',
    origem: 'Hospital Santa Lucia',
    descricao: 'ECG de repouso realizado em 10/03/2025.',
  },
  {
    id: 6,
    nome: 'Laudo - Ressonância Magnética',
    tipo: 'PDF',
    categoria: 'Exames',
    data: '05/02/2025',
    tamanho: '1.8 MB',
    origem: 'Centro de Diagnóstico',
    descricao: 'Ressonância magnética de joelho direito.',
  },
  {
    id: 7,
    nome: 'Carteira de Vacinação',
    tipo: 'PDF',
    categoria: 'Vacinas',
    data: '10/04/2025',
    tamanho: '0.7 MB',
    origem: 'Posto de Saúde Central',
  },
]; */

const Documentos: React.FC = () => {
  const [busca, setBusca] = useState<string>('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('todas');
  const [categoriaExpandida, setCategoriaExpandida] = useState<{ [key: string]: boolean }>({
    'Exames': true,
    'Receitas': false,
    'Atestados': false,
    'Vacinas': false,
  });
  const [modalAberto, setModalAberto] = useState(false);
const [arquivo, setArquivo] = useState<File | null>(null);
const [progresso, setProgresso] = useState(0);
const [nome, setNome] = useState('');
const [origem, setOrigem] = useState('');
const [descricao, setDescricao] = useState('');
const [categoria, setCategoria] = useState('');
const [documentosSalvos, setDocumentosSalvos] = useState<Documento[]>([]);

useEffect(() => {
  buscarDocumentos();
}, []);


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

      setModalAberto(false);
      setArquivo(null);
      setProgresso(0);
    }
  );
};

const visualizarDocumento = (url: string) => {
  window.open(url, '_blank');
};

const baixarDocumento = (url: string, nome: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};



const buscarDocumentos = async () => {
  const querySnapshot = await getDocs(collection(db, 'documentos'));
  const docs: Documento[] = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Documento[];
  setDocumentosSalvos(docs);
};


  const toggleCategoria = (categoria: string) => {
    setCategoriaExpandida({
      ...categoriaExpandida,
      [categoria]: !categoriaExpandida[categoria],
    });
  };
  
  const categorias = [...new Set(documentosSalvos.map(doc => doc.categoria))];
  
  const documentosFiltrados = documentosSalvos.filter(doc => {
    // Filtro por categoria
    if (categoriaSelecionada !== 'todas' && doc.categoria !== categoriaSelecionada) return false;
    
    // Filtro por busca (nome, tipo, origem)
    if (busca && !doc.nome.toLowerCase().includes(busca.toLowerCase()) &&
        !doc.tipo.toLowerCase().includes(busca.toLowerCase()) &&
        !doc.origem.toLowerCase().includes(busca.toLowerCase())) {
      return false;
    }
    
    return true;
  });
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Documentos Médicos</h1>
        
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-3">
          <button className="inline-flex items-center justify-center px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <Folder size={16} className="mr-2" />
            Nova Pasta
          </button>
          <button
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Upload size={16} className="mr-2" />
            Enviar Documento
          </button>
        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Enviar Documento</h2>
            
            <input
              type="text"
              placeholder="Nome do documento"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mb-2 w-full border border-gray-300 rounded px-3 py-2"
            />
            <input
              type="text"
              placeholder="Origem"
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              className="mb-2 w-full border border-gray-300 rounded px-3 py-2"
            />
            <textarea
              placeholder="Descrição"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="mb-2 w-full border border-gray-300 rounded px-3 py-2"
            />
            <input
              type="text"
              placeholder="Categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="mb-4 w-full border border-gray-300 rounded px-3 py-2"
            />

            <input
              type="file"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              className="mb-4"

            />

            {progresso > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${progresso}%` }}
                ></div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setModalAberto(false)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar com categorias */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Categorias</h2>
            
            <ul className="space-y-1">
              <li>
                <button 
                  onClick={() => setCategoriaSelecionada('todas')}
                  className={`w-full flex items-center px-3 py-2 rounded-lg text-left ${
                    categoriaSelecionada === 'todas' 
                      ? 'bg-primary-50 text-primary-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <FileText size={18} className="mr-2" />
                  <span>Todos os Documentos</span>
                </button>
              </li>
              
              {categorias.map((categoria) => (
                <li key={categoria}>
                  <button 
                    onClick={() => toggleCategoria(categoria)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left ${
                      categoriaSelecionada === categoria 
                        ? 'bg-primary-50 text-primary-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center">
                      <Folder size={18} className="mr-2" />
                      <span>{categoria}</span>
                    </div>
                    {categoriaExpandida[categoria] ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>
                  
                  {categoriaExpandida[categoria] && (
                    <div className="ml-4 mt-1 border-l-2 border-gray-200 pl-4">
                      <button 
                        onClick={() => setCategoriaSelecionada(categoria)}
                        className={`w-full flex items-center px-3 py-2 rounded-lg text-left text-sm ${
                          categoriaSelecionada === categoria 
                            ? 'text-primary-700' 
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Todos os {categoria}
                      </button>
                      
                      {/* Aqui poderiam ser mostradas subcategorias */}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button className="w-full flex items-center px-3 py-2 rounded-lg text-left text-gray-700 hover:bg-gray-100">
                <FilePlus size={18} className="mr-2" />
                <span>Nova Categoria</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Lista de documentos */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4">
              {/* Barra de busca */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Buscar documentos..."
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
                <select className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                  <option>Todos os tipos</option>
                  <option>PDF</option>
                  <option>JPEG</option>
                  <option>PNG</option>
                  <option>DOC</option>
                </select>
              </div>
            </div>
            
            {documentosFiltrados.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nome
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Categoria
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Origem
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {documentosFiltrados.map((documento) => (
                      <tr key={documento.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`p-2 mr-3 rounded-lg ${
                              documento.tipo === 'PDF' 
                                ? 'bg-red-100 text-red-600' 
                                : documento.tipo === 'JPEG' || documento.tipo === 'PNG'
                                ? 'bg-blue-100 text-blue-600'
                                : 'bg-amber-100 text-amber-600'
                            }`}>
                              <FileText size={18} />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{documento.nome}</div>
                              <div className="text-sm text-gray-500">
                                {documento.tipo} • {documento.tamanho}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {documento.categoria}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {documento.data}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {documento.origem}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button onClick={() => visualizarDocumento(documento.url)} className="text-primary-600 hover:text-primary-900 mr-3">
                            Visualizar
                          </button>
                          <button onClick={() => baixarDocumento(documento.url, documento.nome)} className="text-gray-600 hover:text-gray-900">
                            Baixar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-500">Nenhum documento encontrado com os filtros selecionados.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documentos;