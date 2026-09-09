import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

type Tipo = 'sucesso' | 'erro';

interface FeedbackState {
  aberto: boolean;
  tipo: Tipo;
  titulo: string;
  mensagem: string;
}

interface FeedbackContextType {
  /** Abre um modal de feedback (substitui os antigos window.alert). */
  notificar: (tipo: Tipo, mensagem: string, titulo?: string) => void;
}

const FeedbackContext = createContext<FeedbackContextType | null>(null);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [estado, setEstado] = useState<FeedbackState>({
    aberto: false,
    tipo: 'sucesso',
    titulo: '',
    mensagem: '',
  });

  const notificar = useCallback((tipo: Tipo, mensagem: string, titulo?: string) => {
    setEstado({
      aberto: true,
      tipo,
      mensagem,
      titulo: titulo ?? (tipo === 'sucesso' ? 'Sucesso!' : 'Ocorreu um erro'),
    });
  }, []);

  const fechar = () => setEstado((e) => ({ ...e, aberto: false }));

  return (
    <FeedbackContext.Provider value={{ notificar }}>
      {children}

      {estado.aberto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={fechar}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center relative border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={fechar}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>

            <div
              className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${
                estado.tipo === 'sucesso' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}
            >
              {estado.tipo === 'sucesso' ? <CheckCircle2 size={30} /> : <AlertTriangle size={30} />}
            </div>

            <h2 className={`text-lg font-bold mb-2 ${estado.tipo === 'sucesso' ? 'text-green-700' : 'text-red-700'}`}>
              {estado.titulo}
            </h2>
            <p className="text-gray-600 text-sm">{estado.mensagem}</p>

            <button
              onClick={fechar}
              className="mt-6 w-full py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold"
              autoFocus
            >
              Ok
            </button>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback deve ser usado dentro de um FeedbackProvider');
  return ctx;
};
