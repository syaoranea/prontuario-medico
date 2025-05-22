import React, { useEffect, useState } from 'react';
import { User, Bell, Lock, HelpCircle, Moon, Globe, ToggleLeft, ToggleRight, Shield, ChevronDown } from 'lucide-react';
import { db, app, storage } from '../config/firebase';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useUsuario } from '../config/bd/userContext';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';


const Configuracoes: React.FC = () => {
  const usuario = useUsuario();
  const [secaoAtiva, setSecaoAtiva] = useState<string>('conta');
  const [notificacoesEmail, setNotificacoesEmail] = useState<boolean>(true);
  const [notificacoesPush, setNotificacoesPush] = useState<boolean>(true);
  const [notificacoesLembrete, setNotificacoesLembrete] = useState<boolean>(true);
  const [temaDark, setTemaDark] = useState<boolean>(false);
  const [idioma, setIdioma] = useState<string>('pt-BR');
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");


  useEffect(() => {
    if (usuario) {
      setNome(usuario.nome || "");
      setSobrenome(usuario.sobrenome || "");
      setEmail(usuario.email || "");
      setTelefone(usuario.telefone || "");
      setImagemUrl(usuario.fotoPerfil || "");
    }
  }, [usuario]);

  const handleUpload = async (file: File) => {
    if (!file) return;

    const storageRef = ref(storage, `perfil/${file.name}`); // pasta perfil no storage

    try {
      await uploadBytes(storageRef, file); // faz o upload
      const url = await getDownloadURL(storageRef); // pega a url da imagem
      setImagemUrl(url); // atualiza a imagem no estado
      // aqui você pode salvar essa url no banco de dados se quiser persistir
    } catch (error) {
      console.error("Erro no upload da imagem:", error);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      handleUpload(file);
    }
  };
  
  const salvarDadosCliente = async () => {
    try {
      const userId = "UIIq0FCc4Y44uWKMY5zB"; // Altere conforme sua lógica de autenticação
      await setDoc(doc(db, "usuario", userId), {
        nome,
        sobrenome,
        email,
        telefone,
        fotoPerfil: imagemUrl,
      }, { merge: true }); 
      alert("Dados salvos com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar dados:", error);
      alert("Erro ao salvar dados.");
    }
  };
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Configurações</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Sidebar */}
          <div className="md:w-64 border-b md:border-b-0 md:border-r border-gray-200">
            <nav className="p-4">
              <ul className="space-y-1">
                <li>
                  <button 
                    className={`w-full flex items-center px-4 py-3 rounded-lg text-left ${
                      secaoAtiva === 'conta' 
                        ? 'bg-primary-50 text-primary-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setSecaoAtiva('conta')}
                  >
                    <User size={18} className="mr-3" />
                    <span>Conta</span>
                  </button>
                </li>
                <li>
                  <button 
                    className={`w-full flex items-center px-4 py-3 rounded-lg text-left ${
                      secaoAtiva === 'notificacoes' 
                        ? 'bg-primary-50 text-primary-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setSecaoAtiva('notificacoes')}
                  >
                    <Bell size={18} className="mr-3" />
                    <span>Notificações</span>
                  </button>
                </li>
                <li>
                  <button 
                    className={`w-full flex items-center px-4 py-3 rounded-lg text-left ${
                      secaoAtiva === 'privacidade' 
                        ? 'bg-primary-50 text-primary-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setSecaoAtiva('privacidade')}
                  >
                    <Shield size={18} className="mr-3" />
                    <span>Privacidade e Segurança</span>
                  </button>
                </li>
                <li>
                  <button 
                    className={`w-full flex items-center px-4 py-3 rounded-lg text-left ${
                      secaoAtiva === 'aparencia' 
                        ? 'bg-primary-50 text-primary-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setSecaoAtiva('aparencia')}
                  >
                    <Moon size={18} className="mr-3" />
                    <span>Aparência</span>
                  </button>
                </li>
                <li>
                  <button 
                    className={`w-full flex items-center px-4 py-3 rounded-lg text-left ${
                      secaoAtiva === 'idioma' 
                        ? 'bg-primary-50 text-primary-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setSecaoAtiva('idioma')}
                  >
                    <Globe size={18} className="mr-3" />
                    <span>Idioma</span>
                  </button>
                </li>
                <li>
                  <button 
                    className={`w-full flex items-center px-4 py-3 rounded-lg text-left ${
                      secaoAtiva === 'suporte' 
                        ? 'bg-primary-50 text-primary-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setSecaoAtiva('suporte')}
                  >
                    <HelpCircle size={18} className="mr-3" />
                    <span>Ajuda e Suporte</span>
                  </button>
                </li>
              </ul>
            </nav>
          </div>
          
          {/* Conteúdo */}
          <div className="flex-1 p-6">
            {secaoAtiva === 'conta' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Informações da Conta</h2>
                
                <div className="max-w-2xl">
                  <div className="mb-6 flex items-center">
                  <img
                      src={imagemUrl}
                      alt="Foto do perfil"
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-sm mr-6"
                    />
                    <div>
                      <label
                        htmlFor="upload"
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors cursor-pointer"
                      >
                        Alterar foto
                      </label>
                      <input
                        id="upload"
                        type="file"
                        accept="image/png, image/jpeg, image/gif"
                        onChange={onFileChange}
                        className="hidden"
                      />
                      <p className="mt-2 text-sm text-gray-500">
                        JPG, GIF ou PNG. Tamanho máximo de 2MB
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
                          Nome
                        </label>
                        <input
                          type="text"
                          id="nome"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          value={nome} // controla pelo estado local
                          onChange={(e) => setNome(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="sobrenome" className="block text-sm font-medium text-gray-700 mb-1">
                          Sobrenome
                        </label>
                        <input
                          type="text"
                          id="sobrenome"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          value={sobrenome}
                          onChange={(e) => setSobrenome(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="telefone" className="block text-sm font-medium text-gray-700 mb-1">
                        Telefone
                      </label>
                      <input
                        type="tel"
                        id="telefone"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                      />
                    </div>
                    
                    <div className="pt-4">
                      <button onClick={salvarDadosCliente} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                        Salvar alterações
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {secaoAtiva === 'notificacoes' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Configurações de Notificações</h2>
                
                <div className="max-w-2xl">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                      <div>
                        <h3 className="font-medium text-gray-800">Notificações por email</h3>
                        <p className="text-sm text-gray-500">Receba atualizações e lembretes por email</p>
                      </div>
                      <button 
                        onClick={() => setNotificacoesEmail(!notificacoesEmail)}
                        className="text-primary-600"
                      >
                        {notificacoesEmail ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                      <div>
                        <h3 className="font-medium text-gray-800">Notificações push</h3>
                        <p className="text-sm text-gray-500">Receba alertas no seu navegador ou dispositivo móvel</p>
                      </div>
                      <button 
                        onClick={() => setNotificacoesPush(!notificacoesPush)}
                        className="text-primary-600"
                      >
                        {notificacoesPush ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                      <div>
                        <h3 className="font-medium text-gray-800">Lembretes de medicação</h3>
                        <p className="text-sm text-gray-500">Receba lembretes quando for hora de tomar seus medicamentos</p>
                      </div>
                      <button 
                        onClick={() => setNotificacoesLembrete(!notificacoesLembrete)}
                        className="text-primary-600"
                      >
                        {notificacoesLembrete ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                    </div>
                    
                    <div className="pt-4">
                      <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                        Salvar preferências
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {secaoAtiva === 'privacidade' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Privacidade e Segurança</h2>
                
                <div className="max-w-2xl">
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium text-gray-800 mb-3">Alterar senha</h3>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="senha-atual" className="block text-sm font-medium text-gray-700 mb-1">
                            Senha atual
                          </label>
                          <input
                            type="password"
                            id="senha-atual"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label htmlFor="nova-senha" className="block text-sm font-medium text-gray-700 mb-1">
                            Nova senha
                          </label>
                          <input
                            type="password"
                            id="nova-senha"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label htmlFor="confirmar-senha" className="block text-sm font-medium text-gray-700 mb-1">
                            Confirmar nova senha
                          </label>
                          <input
                            type="password"
                            id="confirmar-senha"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                            Atualizar senha
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-6 border-t border-gray-200">
                      <h3 className="font-medium text-gray-800 mb-3">Privacidade de dados</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Suas informações médicas são privadas e protegidas. Você pode gerenciar quem tem acesso a elas.
                      </p>
                      
                      <div className="space-y-4">
                        <div className="flex items-center">
                          <input 
                            id="compartilhar-medicos" 
                            type="checkbox" 
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            defaultChecked
                          />
                          <label htmlFor="compartilhar-medicos" className="ml-2 block text-sm text-gray-700">
                            Compartilhar dados com médicos autorizados
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input 
                            id="compartilhar-familia" 
                            type="checkbox" 
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <label htmlFor="compartilhar-familia" className="ml-2 block text-sm text-gray-700">
                            Permitir acesso a membros da família
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input 
                            id="anonimizar-estatisticas" 
                            type="checkbox" 
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            defaultChecked
                          />
                          <label htmlFor="anonimizar-estatisticas" className="ml-2 block text-sm text-gray-700">
                            Contribuir com dados anônimos para estatísticas de saúde
                          </label>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                          Salvar configurações
                        </button>
                      </div>
                    </div>
                    
                    <div className="pt-6 border-t border-gray-200">
                      <h3 className="font-medium text-red-600 mb-3">Zona de perigo</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        As ações abaixo são permanentes e não podem ser desfeitas.
                      </p>
                      
                      <div className="space-y-4">
                        <button className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                          Excluir todos os meus dados
                        </button>
                        <button className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                          Encerrar minha conta
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {secaoAtiva === 'aparencia' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Aparência</h2>
                
                <div className="max-w-2xl">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div>
                      <h3 className="font-medium text-gray-800">Modo escuro</h3>
                      <p className="text-sm text-gray-500">Reduz o brilho da tela e melhora a visibilidade em ambientes com pouca luz</p>
                    </div>
                    <button 
                      onClick={() => setTemaDark(!temaDark)}
                      className="text-primary-600"
                    >
                      {temaDark ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  </div>
                  
                  <div className="mt-6">
                    <h3 className="font-medium text-gray-800 mb-3">Tamanho da fonte</h3>
                    <div className="flex items-center">
                      <span className="text-sm text-gray-500 mr-3">A</span>
                      <input 
                        type="range" 
                        min="1" 
                        max="5" 
                        defaultValue="3"
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-lg text-gray-500 ml-3">A</span>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-4">
                    <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                      Salvar preferências
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {secaoAtiva === 'idioma' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Idioma</h2>
                
                <div className="max-w-2xl">
                  <div>
                    <label htmlFor="idioma" className="block text-sm font-medium text-gray-700 mb-1">
                      Selecione seu idioma
                    </label>
                    <select
                      id="idioma"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      value={idioma}
                      onChange={(e) => setIdioma(e.target.value)}
                    >
                      <option value="pt-BR">Português (Brasil)</option>
                      <option value="en-US">English (United States)</option>
                      <option value="es-ES">Español (España)</option>
                      <option value="fr-FR">Français (France)</option>
                    </select>
                  </div>
                  
                  <div className="mt-6 pt-4">
                    <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                      Salvar preferências
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {secaoAtiva === 'suporte' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Ajuda e Suporte</h2>
                
                <div className="max-w-2xl">
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium text-gray-800 mb-2">Perguntas frequentes</h3>
                      <div className="space-y-3 mt-4">
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <button className="w-full text-left px-4 py-3 bg-gray-50 flex items-center justify-between">
                            <span className="font-medium">Como adicionar um novo medicamento?</span>
                            <ChevronDown size={16} />
                          </button>
                          <div className="px-4 py-3 text-sm text-gray-600">
                            Para adicionar um novo medicamento, navegue até a seção "Medicamentos" e clique no botão "Adicionar Medicamento" no canto superior direito da tela. Preencha os detalhes solicitados e salve as informações.
                          </div>
                        </div>
                        
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <button className="w-full text-left px-4 py-3 bg-gray-50 flex items-center justify-between">
                            <span className="font-medium">Como compartilhar meu histórico médico com um profissional?</span>
                            <ChevronDown size={16} />
                          </button>
                          <div className="px-4 py-3 text-sm text-gray-600">
                            Acesse seu histórico médico, selecione os registros que deseja compartilhar e use a opção "Compartilhar" para gerar um relatório ou um link seguro que pode ser enviado ao profissional de saúde.
                          </div>
                        </div>
                        
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <button className="w-full text-left px-4 py-3 bg-gray-50 flex items-center justify-between">
                            <span className="font-medium">Posso exportar meus dados?</span>
                            <ChevronDown size={16} />
                          </button>
                          <div className="px-4 py-3 text-sm text-gray-600">
                            Sim, você pode exportar seus dados em diferentes formatos (PDF, CSV) através da seção "Configurações" {'>'} "Privacidade e Segurança" {'>'} "Exportar Dados".
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-gray-200">
                      <h3 className="font-medium text-gray-800 mb-3">Entre em contato</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Não encontrou a resposta que procurava? Entre em contato com nossa equipe de suporte.
                      </p>
                      
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="assunto" className="block text-sm font-medium text-gray-700 mb-1">
                            Assunto
                          </label>
                          <select
                            id="assunto"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            <option>Selecione um assunto</option>
                            <option>Problema técnico</option>
                            <option>Dúvida sobre funcionalidade</option>
                            <option>Sugestão</option>
                            <option>Outro</option>
                          </select>
                        </div>
                        
                        <div>
                          <label htmlFor="mensagem" className="block text-sm font-medium text-gray-700 mb-1">
                            Mensagem
                          </label>
                          <textarea
                            id="mensagem"
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Descreva em detalhes como podemos ajudar..."
                          ></textarea>
                        </div>
                        
                        <div>
                          <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                            Enviar mensagem
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;
