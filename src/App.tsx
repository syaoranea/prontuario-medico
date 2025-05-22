import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PerfilPaciente from './pages/PerfilPaciente';
import HistoricoMedico from './pages/HistoricoMedico';
import Medicamentos from './pages/Medicamentos';
import Agendamentos from './pages/Agendamentos';
import Metricas from './pages/Metricas';
import Documentos from './pages/Documentos';
import Configuracoes from './pages/Configuracoes';
import { UserProvider } from './config/bd/userContext';

function App() {
  return (
    <Router>
       <UserProvider> 
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/perfil" element={<PerfilPaciente />} />
          <Route path="/historico" element={<HistoricoMedico />} />
          <Route path="/medicamentos" element={<Medicamentos />} />
          <Route path="/agendamentos" element={<Agendamentos />} />
          <Route path="/metricas" element={<Metricas />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Routes>
      </Layout>
      </UserProvider>
    </Router>
  );
}

export default App;