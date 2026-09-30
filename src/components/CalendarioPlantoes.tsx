import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Moon, RefreshCw, Sun } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { PlantaoEncerrado } from '../interface/interface';
import { formatarDataBR } from '../utils/datas';
import { EscalaItem, Folga, TrocaPlantao, Turno, isoDe } from '../utils/escala';
import { DadosPlantoes, STATUS_PLANTAO, plantoesPendentes, statusPlantao } from '../utils/plantao';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface CalendarioPlantoesProps {
  /** Escala, folgas e trocas vêm de quem já carregou — as duas telas que usam
   *  este calendário precisam desses dados para outras coisas de qualquer jeito.
   *  Só `plantoes-encerrados` é carregado aqui dentro, porque é exclusivo daqui. */
  escala: EscalaItem[];
  folgas: Record<string, Folga>;
  trocas: TrocaPlantao[];
  /** Muda o número para forçar recarga (ex: depois de encerrar um plantão). */
  recarregar?: number;
  /** Quando informado, tocar num dia ou numa pendência chama isto. */
  onSelecionar?: (data: string, turno: Turno) => void;
  /** Lista de pendências abaixo do calendário. */
  mostrarPendencias?: boolean;
}

const CalendarioPlantoes: React.FC<CalendarioPlantoesProps> = ({
  escala, folgas, trocas, recarregar = 0, onSelecionar, mostrarPendencias = true,
}) => {
  const [encerrados, setEncerrados] = useState<Record<string, PlantaoEncerrado>>({});
  const [carregando, setCarregando] = useState(true);

  const hoje = new Date();
  const [refMes, setRefMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      try {
        const snap = await getDocs(collection(db, 'plantoes-encerrados'));
        if (!vivo) return;
        const mapa: Record<string, PlantaoEncerrado> = {};
        snap.docs.forEach((d) => { mapa[d.id] = { id: d.id, ...(d.data() as Omit<PlantaoEncerrado, 'id'>) }; });
        setEncerrados(mapa);
      } catch (e) {
        console.error('Erro ao carregar plantões encerrados:', e);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [recarregar]);

  const dados: DadosPlantoes = useMemo(
    () => ({ escala, folgas, trocas, encerrados: new Set(Object.keys(encerrados)) }),
    [escala, folgas, trocas, encerrados]
  );

  const ano = refMes.getFullYear();
  const mes = refMes.getMonth();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const primeiroWeekday = new Date(ano, mes, 1).getDay();
  const celulas: (number | null)[] = [
    ...Array(primeiroWeekday).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  const hojeISO = isoDe(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const pendencias = useMemo(
    () => plantoesPendentes(dados, isoDe(ano, mes, 1), isoDe(ano, mes, diasNoMes), hoje),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados, ano, mes, diasNoMes]
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <button onClick={() => setRefMes(new Date(ano, mes - 1, 1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-semibold text-gray-800">{MESES[mes]} {ano}</h2>
          <button onClick={() => setRefMes(new Date(ano, mes + 1, 1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronRight size={18} />
          </button>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <RefreshCw size={18} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <div className="p-2 sm:p-3">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {celulas.map((dia, idx) => {
                if (dia === null) return <div key={`b${idx}`} />;
                const dataISO = isoDe(ano, mes, dia);
                const stDia = statusPlantao(dados, dataISO, 'diurno', hoje);
                const stNoite = statusPlantao(dados, dataISO, 'noturno', hoje);
                const ehHoje = dataISO === hojeISO;
                const temPendencia = stDia === 'pendente' || stNoite === 'pendente';
                return (
                  <button
                    key={dataISO}
                    onClick={() => onSelecionar?.(dataISO, stNoite === 'pendente' && stDia !== 'pendente' ? 'noturno' : 'diurno')}
                    title={`${formatarDataBR(dataISO)}\nDiurno: ${STATUS_PLANTAO[stDia].label}\nNoturno: ${STATUS_PLANTAO[stNoite].label}`}
                    className={`min-h-[46px] rounded-lg p-1 flex flex-col items-center gap-1 transition-colors ${
                      temPendencia ? 'border-2 border-red-400 bg-red-50/40'
                        : ehHoje ? 'border border-primary-400 bg-primary-50/40'
                        : 'border border-gray-100 hover:bg-gray-50'
                    } ${onSelecionar ? '' : 'cursor-default'}`}
                  >
                    <span className={`text-[11px] font-semibold ${ehHoje ? 'text-primary-600' : 'text-gray-500'}`}>{dia}</span>
                    <span className="flex gap-0.5">
                      <span className={`w-2 h-2 rounded-full ${STATUS_PLANTAO[stDia].ponto}`} />
                      <span className={`w-2 h-2 rounded-full ${STATUS_PLANTAO[stNoite].ponto}`} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 mt-3 px-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> encerrado</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> pendente</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> ainda não</span>
              <span className="text-gray-400">os dois pontos são dia e noite</span>
            </div>
          </div>
        )}
      </div>

      {mostrarPendencias && !carregando && pendencias.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-4">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5 mb-2">
            <AlertTriangle size={15} />
            {pendencias.length} relatório(s) pendente(s) em {MESES[mes]}
          </p>
          <div className="space-y-1.5">
            {pendencias.map((p) => (
              <button
                key={`${p.data}_${p.turno}`}
                onClick={() => onSelecionar?.(p.data, p.turno)}
                className={`w-full text-left flex items-center gap-2 text-xs text-gray-700 rounded-lg px-2 py-1.5 ${
                  onSelecionar ? 'hover:bg-gray-50' : 'cursor-default'
                }`}
              >
                {p.turno === 'diurno'
                  ? <Sun size={12} className="text-amber-500 shrink-0" />
                  : <Moon size={12} className="text-indigo-400 shrink-0" />}
                <span className="font-medium">{formatarDataBR(p.data)}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500 truncate flex-1">{p.quem || 'sem escala'}</span>
                {p.diasAtraso > 0 && (
                  <span className="text-red-600 font-semibold shrink-0">{p.diasAtraso}d</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarioPlantoes;
