import React, { } from "react";
import { Bell, Search } from "lucide-react";
import { useUsuario } from "../config/bd/userContext";



const Header: React.FC = () => {
  const usuario = useUsuario();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex-1 flex items-center md:hidden">
          {/* Espaço para botão do menu móvel */}
        </div>

        <div className="max-w-xl w-full mx-4 hidden md:block">
          <div className="relative">
            <input
              type="text"
              placeholder="Pesquisar..."
              className="w-full py-2 pl-10 pr-4 text-sm text-gray-700 bg-gray-100 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3">
              <Search size={18} className="text-gray-400" />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button className="relative p-2 text-gray-600 hover:text-primary-600 focus:outline-none">
            <Bell size={20} />
            <span className="absolute top-1 right-1 inline-block w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <div className="flex items-center">
            <img
              className="h-8 w-8 rounded-full object-cover border-2 border-primary-500"
              src={usuario?.fotoPerfil}
              alt="Foto do perfil"
            />
            <span className="ml-2 font-medium text-sm text-gray-700 hidden md:inline-block">
            <span>{usuario?.nome ?? "..."}</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
