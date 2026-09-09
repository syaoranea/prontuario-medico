import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type Papel = 'tecnico' | 'enfermeiro' | 'medico' | 'familia' | 'admin';

export interface PerfilEquipe {
  nome: string;
  papel: Papel;
  ativo: boolean;
}

interface AuthContextType {
  user: User | null;
  perfil: PerfilEquipe | null;
  carregando: boolean;
  erroPerfil: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  /** true se o papel atual está na lista informada */
  temPapel: (papeis: Papel[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilEquipe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setErroPerfil(null);

      if (u) {
        // O papel de acesso vive em /membrosEquipe/{uid}.
        try {
          const snap = await getDoc(doc(db, 'membrosEquipe', u.uid));
          if (snap.exists()) {
            const dados = snap.data() as PerfilEquipe;
            if (dados.ativo === false) {
              setPerfil(null);
              setErroPerfil('Seu acesso está desativado. Contate o administrador.');
            } else {
              setPerfil(dados);
            }
          } else {
            setPerfil(null);
            setErroPerfil(
              'Login efetuado, mas não há perfil de equipe cadastrado para este usuário. Contate o administrador.'
            );
          }
        } catch (e) {
          console.error('Erro ao carregar perfil de acesso:', e);
          setPerfil(null);
          setErroPerfil('Não foi possível carregar o perfil de acesso. Tente novamente.');
        }
      } else {
        setPerfil(null);
      }

      setCarregando(false);
    });

    return () => unsub();
  }, []);

  const login = async (email: string, senha: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), senha);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const temPapel = (papeis: Papel[]) => !!perfil && papeis.includes(perfil.papel);

  return (
    <AuthContext.Provider value={{ user, perfil, carregando, erroPerfil, login, logout, temPapel }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return ctx;
};

// Rótulos amigáveis para exibição.
export const PAPEL_LABEL: Record<Papel, string> = {
  tecnico: 'Técnico de enfermagem',
  enfermeiro: 'Enfermeiro(a)',
  medico: 'Médico(a)',
  familia: 'Família',
  admin: 'Administrador',
};
