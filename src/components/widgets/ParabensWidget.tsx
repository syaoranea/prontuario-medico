import React from 'react';
import { Trophy, Sparkles, X } from 'lucide-react';
import { formatarDataBR } from '../../utils/datas';

/** Plantão em que a técnica concluiu 100% dos itens da rotina. */
export interface ParabensPlantao {
  id: string;
  data: string; // ISO (YYYY-MM-DD)
  turno: 'manha' | 'noite';
  totalItens: number;
}

interface ParabensWidgetProps {
  nome: string;
  plantoes: ParabensPlantao[];
  onFechar: (id: string) => void;
}

const CORES_CONFETE = [
  'bg-amber-200',
  'bg-fuchsia-300',
  'bg-emerald-300',
  'bg-sky-300',
  'bg-rose-300',
  'bg-violet-200',
];

// Posições e tempos fixos: o confete parece aleatório, mas não "pula" a cada
// render do React (um Math.random() aqui recalcularia tudo a cada atualização).
const CONFETES = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 5.7 + (i % 4) * 4) % 96}%`,
  atraso: `${((i % 7) * 0.32).toFixed(2)}s`,
  duracao: `${(2.2 + (i % 5) * 0.4).toFixed(2)}s`,
  cor: CORES_CONFETE[i % CORES_CONFETE.length],
  formato: i % 3 === 0 ? 'w-1.5 h-3 rounded-sm' : i % 3 === 1 ? 'w-2 h-2 rounded-full' : 'w-2.5 h-1.5 rounded-sm',
}));

/**
 * Card comemorativo do plantão 100%. Aparece para a própria técnica no primeiro
 * acesso depois do plantão e some quando ela confirma (o Dashboard persiste isso).
 */
const ParabensWidget: React.FC<ParabensWidgetProps> = ({ nome, plantoes, onFechar }) => {
  if (!plantoes || plantoes.length === 0) return null;

  const primeiroNome = (nome || '').trim().split(/\s+/)[0] || 'técnica';

  return (
    <div className="space-y-4">
      {plantoes.map((p) => (
        <div
          key={p.id}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-fuchsia-600 p-6 text-white shadow-lg"
        >
          {/* Chuva de confete */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {CONFETES.map((c, i) => (
              <span
                key={i}
                className={`absolute -top-3 ${c.formato} ${c.cor} animate-confete`}
                style={{ left: c.left, animationDelay: c.atraso, animationDuration: c.duracao }}
              />
            ))}
          </div>

          <button
            onClick={() => onFechar(p.id)}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            title="Fechar"
          >
            <X size={16} />
          </button>

          <div className="relative flex items-start gap-4">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center animate-brilho">
              <Trophy size={28} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Sparkles size={15} className="animate-brilho" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/90">
                  Plantão nota 100
                </span>
              </div>

              <h2 className="text-xl font-extrabold mt-1 leading-tight">Parabéns, {primeiroNome}! 🎉</h2>

              <p className="text-sm text-white/95 mt-1.5 leading-relaxed">
                Você concluiu <b>100% da rotina</b> no plantão de {formatarDataBR(p.data)} ·{' '}
                {p.turno === 'noite' ? 'Noite' : 'Manhã'} — {p.totalItens} de {p.totalItens} itens.
              </p>

              <p className="text-xs text-white/85 mt-2">Obrigado pelo cuidado com cada detalhe. 💙</p>

              <button
                onClick={() => onFechar(p.id)}
                className="mt-4 px-4 py-2 rounded-xl bg-white text-orange-600 text-sm font-bold hover:bg-white/90 transition-colors"
              >
                Oba! 🎉
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ParabensWidget;
