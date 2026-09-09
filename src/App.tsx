import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { RefreshCw, ShieldAlert, LogOut } from 'lucide-react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PerfilPaciente from './pages/PerfilPaciente';
import HistoricoMedico from './pages/HistoricoMedico';
import Medicamentos from './pages/Medicamentos';
import Agendamentos from './pages/Agendamentos';
import Metricas from './pages/Metricas';
import Documentos from './pages/Documentos';
import Configuracoes from './pages/Configuracoes';
import Profissionais from './pages/Profissionais';
import RotinaCuidados from './pages/RotinaCuidados';
import Equipe from './pages/Equipe';
import Auditoria from './pages/Auditoria';
import Login from './pages/Login';
import { UserProvider } from './config/bd/userContext';
import { AuthProvider, useAuth, Papel } from './config/auth/authContext';
import { FeedbackProvider } from './components/FeedbackProvider';
import { ConfirmProvider } from './components/ConfirmProvider';

// Bloqueia uma rota se o papel atual não estiver autorizado.
const RequireRole: React.FC<{ papeis: Papel[]; children: React.ReactNode }> = ({ papeis, children }) => {
  const { temPapel } = useAuth();
  return temPapel(papeis) ? <>{children}</> : <Navigate to="/" replace />;
};

// Papéis que compõem a equipe clínica (podem editar dados clínicos).
const EQUIPE_CLINICA: Papel[] = ['tecnico', 'enfermeiro', 'medico', 'admin'];
const GESTAO: Papel[] = ['enfermeiro', 'medico', 'admin'];

const TelaCarregando: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-400">
    <RefreshCw size={28} className="animate-spin mb-3" />
    <p className="text-sm">Carregando...</p>
  </div>
);

const TelaSemPerfil: React.FC<{ erro: string | null; onSair: () => void }> = ({ erro, onSair }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
        <ShieldAlert size={28} />
      </div>
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Acesso não liberado</h2>
      <p className="text-sm text-gray-500 mb-6">
        {erro ?? 'Seu usuário ainda não tem um perfil de equipe cadastrado.'}
      </p>
      <button
        onClick={onSair}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium"
      >
        <LogOut size={16} /> Sair
      </button>
    </div>
  </div>
);

// Decide o que mostrar conforme o estado de autenticação.
const AppGate: React.FC = () => {
  const { user, perfil, carregando, erroPerfil, logout } = useAuth();

  if (carregando) return <TelaCarregando />;
  if (!user) return <Login />;
  if (!perfil) return <TelaSemPerfil erro={erroPerfil} onSair={logout} />;

  return (
    <UserProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/perfil" element={<PerfilPaciente />} />
          <Route path="/historico" element={<HistoricoMedico />} />
          <Route
            path="/medicamentos"
            element={
              <RequireRole papeis={EQUIPE_CLINICA}>
                <Medicamentos />
              </RequireRole>
            }
          />
          <Route
            path="/agendamentos"
            element={
              <RequireRole papeis={EQUIPE_CLINICA}>
                <Agendamentos />
              </RequireRole>
            }
          />
          <Route path="/metricas" element={<Metricas />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route
            path="/profissionais"
            element={
              <RequireRole papeis={GESTAO}>
                <Profissionais />
              </RequireRole>
            }
          />
          <Route
            path="/configuracoes"
            element={
              <RequireRole papeis={GESTAO}>
                <Configuracoes />
              </RequireRole>
            }
          />
          <Route path="/rotina" element={<RotinaCuidados />} />
          <Route
            path="/equipe"
            element={
              <RequireRole papeis={['admin']}>
                <Equipe />
              </RequireRole>
            }
          />
          <Route
            path="/auditoria"
            element={
              <RequireRole papeis={GESTAO}>
                <Auditoria />
              </RequireRole>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </UserProvider>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <FeedbackProvider>
          <ConfirmProvider>
            <AppGate />
          </ConfirmProvider>
        </FeedbackProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
