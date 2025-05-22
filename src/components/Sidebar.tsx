import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, User, FileText, Pill, Calendar, LineChart, 
  FolderClosed, Settings, Menu, X 
} from 'lucide-react';
import { useState } from 'react';

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const menuItems = [
    { path: '/', icon: <Home size={20} />, label: 'Dashboard' },
    { path: '/perfil', icon: <User size={20} />, label: 'Perfil' },
    { path: '/historico', icon: <FileText size={20} />, label: 'Histórico' },
    { path: '/medicamentos', icon: <Pill size={20} />, label: 'Medicamentos' },
    { path: '/agendamentos', icon: <Calendar size={20} />, label: 'Agendamentos' },
    { path: '/metricas', icon: <LineChart size={20} />, label: 'Métricas' },
    { path: '/documentos', icon: <FolderClosed size={20} />, label: 'Documentos' },
    { path: '/configuracoes', icon: <Settings size={20} />, label: 'Configurações' },
  ];

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
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-primary-600">MediRecord</h1>
          <p className="text-sm text-gray-500">Prontuário Digital</p>
        </div>

        <nav className="mt-6 px-2">
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
      </aside>
    </>
  );
};

export default Sidebar;