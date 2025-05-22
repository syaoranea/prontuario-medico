import React, { createContext, useContext, useEffect, useState } from "react";
import { buscarInformacaoMedicas, buscarUsuarioPorId } from "./function";


type Usuario = {
  nome: string;
  sobrenome: string;
  email: string;
  telefone: string;
  fotoPerfil: string;
  dataNascimento: string;
  cidade: string;
  estado: string;
  rua: string;
  cep: string;
  // outros campos que você usa
};

type InformacaoMedicas = {
    Alergias: string[];
    contatoEmergencia: string;
    contatoParentesco: string;
    planoSaude: string;
    telefoneEmergencia : string;
    numeroPlano: string;
    nomePlano: string;
    tipoSanguineo: string;
    doencasCronicas: string[];
};

type UserContextType = {
  usuario: Usuario | null;
  informacaoMedicas: InformacaoMedicas | null;
};

// Criação do contexto com tipo combinado
const UserContext = createContext<UserContextType | null>(null);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [informacaoMedicas, setInformacaoMedicas] = useState<InformacaoMedicas | null>(null);

  useEffect(() => {
  const carregarDados = async () => {
    const dadosUsuario = await buscarUsuarioPorId();
    const dadosMedicos = await buscarInformacaoMedicas();

    if (dadosUsuario) {
      setUsuario({
        nome: dadosUsuario.nome,
        sobrenome: dadosUsuario.sobrenome,
        email: dadosUsuario.email,
        telefone: dadosUsuario.telefone,
        fotoPerfil: dadosUsuario.fotoPerfil,
        dataNascimento: dadosUsuario.dataNascimento,
        cidade: dadosUsuario.cidade,
        estado: dadosUsuario.estado,
        rua: dadosUsuario.rua,
        cep: dadosUsuario.cep,
      });
    }

    if (dadosMedicos) {
      setInformacaoMedicas({
        Alergias: dadosMedicos.Alergias,
        contatoEmergencia: dadosMedicos.contatoEmergencia,
        contatoParentesco: dadosMedicos.contatoParentesco,
        planoSaude: dadosMedicos.planoSaude,
        telefoneEmergencia: dadosMedicos.telefoneEmergencia,
        numeroPlano: dadosMedicos.numeroPlano,
        nomePlano: dadosMedicos.nomePlano,
        tipoSanguineo: dadosMedicos.tipoSanguineo,
        doencasCronicas: dadosMedicos.doencasCronicas,
      });
    }
  };

  carregarDados();
}, []);

return (
  <UserContext.Provider value={{ usuario, informacaoMedicas }}>
    {children}
  </UserContext.Provider>
);
};
// Custom hooks para acessar separadamente
export const useUsuario = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUsuario deve ser usado dentro de um UserProvider");
  return context.usuario;
};

export const useInformacaoMedicas = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useInformacaoMedicas deve ser usado dentro de um UserProvider");
  return context.informacaoMedicas;
};