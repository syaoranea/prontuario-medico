import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home, User, FileText, Pill, Calendar, LineChart,
  FolderClosed, Settings, Menu, X, Users, Heart, LogOut, ShieldCheck, History
} from 'lucide-react';
import { useState } from 'react';
import { Papel, PAPEL_LABEL, useAuth } from '../config/auth/authContext';

const EQUIPE_CLINICA: Papel[] = ['tecnico', 'enfermeiro', 'medico', 'admin'];
const GESTAO: Papel[] = ['enfermeiro', 'medico', 'admin'];

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { perfil, logout, temPapel } = useAuth();

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  // `papeis` ausente = visível para todos os papéis autenticados.
  const menuItems: { path: string; icon: React.ReactNode; label: string; papeis?: Papel[] }[] = [
    { path: '/', icon: <Home size={20} />, label: 'Dashboard' },
    { path: '/perfil', icon: <User size={20} />, label: 'Perfil' },
    { path: '/historico', icon: <FileText size={20} />, label: 'Histórico' },
    { path: '/medicamentos', icon: <Pill size={20} />, label: 'Medicamentos', papeis: EQUIPE_CLINICA },
    { path: '/agendamentos', icon: <Calendar size={20} />, label: 'Agendamentos', papeis: EQUIPE_CLINICA },
    { path: '/metricas', icon: <LineChart size={20} />, label: 'Métricas' },
    { path: '/documentos', icon: <FolderClosed size={20} />, label: 'Documentos' },
    { path: '/profissionais', icon: <Users size={20} />, label: 'Profissionais', papeis: GESTAO },
    { path: '/rotina', icon: <Heart size={20} />, label: 'Rotina Home Care' },
    { path: '/equipe', icon: <ShieldCheck size={20} />, label: 'Equipe e Acessos', papeis: ['admin'] },
    { path: '/auditoria', icon: <History size={20} />, label: 'Auditoria', papeis: GESTAO },
    { path: '/configuracoes', icon: <Settings size={20} />, label: 'Configurações', papeis: GESTAO },
  ].filter((item) => !item.papeis || temPapel(item.papeis));

  return (
    <>
      {/* Mobile menu button */}
      <button 
        className="fixed z-50 top-4 left-4 md:hidden bg-primary-600 text-white p-2 rounded-full shadow-lg"
        onClick={toggleSidebar}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-primary-600">Elo</h1>
          <p className="text-sm text-gray-500">O elo do cuidado</p>
        </div>

        <nav className="mt-6 px-2 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                  onClick={() => setIsOpen(false)}
                >
                  <span className="mr-3">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Rodapé: usuário logado + sair */}
        <div className="border-t border-gray-200 p-3">
          {perfil && (
            <div className="px-2 pb-2">
              <p className="text-sm font-medium text-gray-800 truncate">{perfil.nome}</p>
              <p className="text-xs text-gray-500">{PAPEL_LABEL[perfil.papel]}</p>
            </div>
          )}
          <button
            onClick={() => logout()}
            className="w-full flex items-center px-4 py-2.5 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={18} className="mr-3" />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;