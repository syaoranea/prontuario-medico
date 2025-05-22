import React from 'react';
import { User, Phone, Mail, MapPin, Calendar, Clock, FileEdit } from 'lucide-react';
import { useInformacaoMedicas, useUsuario } from '../config/bd/userContext';

const PerfilPaciente: React.FC = () => {
  const usuario = useUsuario();
  const informacaoMedicas = useInformacaoMedicas();
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Perfil do Paciente</h1>
        <button className="mt-2 md:mt-0 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          <FileEdit size={18} className="mr-2" />
          Editar Perfil
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-primary-600 to-primary-400 h-32 relative">
          <div className="absolute -bottom-16 left-6 md:left-8">
            <img
              src={usuario?.fotoPerfil}
              alt="Foto do perfil"
              className="w-32 h-32 rounded-full border-4 border-white object-cover"
            />
          </div>
        </div>
        
        <div className="pt-20 pb-6 px-6 md:px-8">
          <h2 className="text-2xl font-bold text-gray-800">{usuario?.nome}</h2>
          <p className="text-gray-500">ID: 12345678</p>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Informações Pessoais</h3>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-start">
                  <User size={20} className="mt-0.5 mr-3 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Nome Completo</p>
                    <p className="font-medium">{usuario?.nome} {usuario?.sobrenome}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Calendar size={20} className="mt-0.5 mr-3 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Data de Nascimento</p>
                    <p className="font-medium">{usuario?.dataNascimento} (40 anos)</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Mail size={20} className="mt-0.5 mr-3 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{usuario?.email}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Phone size={20} className="mt-0.5 mr-3 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Telefone</p>
                    <p className="font-medium">{usuario?.telefone}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <MapPin size={20} className="mt-0.5 mr-3 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Endereço</p>
                    <p className="font-medium">{usuario?.rua}</p>
                    <p className="text-sm text-gray-500">{usuario?.cidade} - {usuario?.estado} - {usuario?.cep}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Informações Médicas</h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Tipo Sanguíneo</p>
                  <p className="font-medium">{informacaoMedicas?.tipoSanguineo || 'solicitar exame'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Alergias</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {informacaoMedicas?.Alergias && informacaoMedicas.Alergias.length > 0 ? (
                      informacaoMedicas.Alergias.map((alergia, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full"
                        >
                          {alergia}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">Nenhuma alergia informada</span>
                    )}
                  </div>
                </div>

                
                <div>
                  <p className="text-sm text-gray-500">Doenças Crônicas</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {informacaoMedicas?.doencasCronicas && informacaoMedicas.doencasCronicas.length > 0 ? (
                      informacaoMedicas.doencasCronicas.map((doencasCronica, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full"
                        >
                          {doencasCronica}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">Nenhuma alergia informada</span>
                    )}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Contato de Emergência</p>
                  <p className="font-medium">{informacaoMedicas?.contatoEmergencia} ({informacaoMedicas?.contatoParentesco})</p>
                  <p className="text-sm text-gray-500">{informacaoMedicas?.telefoneEmergencia}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Plano de Saúde</p>
                  <p className="font-medium">{informacaoMedicas?.planoSaude} {informacaoMedicas?.nomePlano}</p>
                  <p className="text-sm text-gray-500">Número: {informacaoMedicas?.numeroPlano} | Validade: 12/2026</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Planos de Cuidado */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Plano de Cuidados Atual</h3>
        
        <div className="space-y-4">
          <div className="p-4 border border-primary-100 rounded-lg bg-primary-50">
            <h4 className="font-medium text-primary-800">Controle de Hipertensão</h4>
            <p className="text-sm text-gray-600 mt-1">
              Monitoramento diário da pressão arterial, medicação conforme prescrito,
              redução do consumo de sal e atividade física regular.
            </p>
          </div>
          
          <div className="p-4 border border-secondary-100 rounded-lg bg-secondary-50">
            <h4 className="font-medium text-secondary-800">Controle de Diabetes</h4>
            <p className="text-sm text-gray-600 mt-1">
              Verificação da glicemia em jejum, alimentação balanceada com controle de carboidratos,
              metformina conforme prescrito pelo Dr. João.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerfilPaciente;