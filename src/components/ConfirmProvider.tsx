import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmOptions {
  titulo?: string;
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** true = ação destrutiva (botão vermelho) */
  destrutivo?: boolean;
}

interface ConfirmContextType {
  /** Abre um modal de confirmação e resolve com true (confirmar) ou false (cancelar). */
  confirmar: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [estado, setEstado] = useState<{ aberto: boolean; opts: ConfirmOptions }>({
    aberto: false,
    opts: { mensagem: '' },
  });
  const resolverRef = useRef<((v: boolean) => void) | undefined>(undefined);

  const confirmar = useCallback((opts: ConfirmOptions) => {
    setEstado({ aberto: true, opts });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const responder = (valor: boolean) => {
    setEstado((e) => ({ ...e, aberto: false }));
    resolverRef.current?.(valor);
    resolverRef.current = undefined;
  };

  const { opts } = estado;
  const destrutivo = opts.destrutivo;

  return (
    <ConfirmContext.Provider value={{ confirmar }}>
      {children}

      {estado.aberto && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
          onClick={() => responder(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center relative border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => responder(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>

            <div
              className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${
                destrutivo ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
              }`}
            >
              <AlertTriangle size={30} />
            </div>

            <h2 className="text-lg font-bold mb-2 text-gray-800">{opts.titulo ?? 'Confirmar ação'}</h2>
            <p className="text-gray-600 text-sm">{opts.mensagem}</p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => responder(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                {opts.textoCancelar ?? 'Cancelar'}
              </button>
              <button
                onClick={() => responder(true)}
                autoFocus
                className={`flex-1 px-4 py-2.5 rounded-xl text-white font-semibold transition-colors ${
                  destrutivo ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {opts.textoConfirmar ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de um ConfirmProvider');
  return ctx;
};
