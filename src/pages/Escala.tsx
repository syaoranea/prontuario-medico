import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X, Trash2, RefreshCw, Coffee, Sun, Moon, UserPlus,
} from 'lucide-react';
import { collection, getDocs, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Tecnico } from '../interface/interface';
import { useAuth } from '../config/auth/authContext';
import { useFeedback } from '../components/FeedbackProvider';
import { useConfirm } from '../components/ConfirmProvider';
import { useAuditoria } from '../config/auditoria';
import { formatarDataBR } from '../utils/datas';

interface EscalaItem {
  id: string; // = tecnicoId
  tecnicoNome: string;
  inicial: string;
  paridade: 'par' | 'impar';
  turno: 'diurno' | 'noturno';
}

interface Folga {
  tecnicoId: string;
  tecnicoNome: string;
  data: string; // ISO
  turno: 'diurno' | 'noturno';
  cobertoPor?: string;      // tecnicoId de quem cobre
  cobertoPorNome?: string;
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CORES = [
  'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700', 'bg-teal-100 text-teal-700',
];

const iniciaisDe = (nome: string) => {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
};
const isoDe = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

const Escala: React.FC = () => {
  const { temPapel } = useAuth();
  const { notificar } = useFeedback();
  const { confirmar } = useConfirm();
  const { registrar } = useAuditoria();
  const admin = temPapel(['admin']);

  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [escala, setEscala] = useState<EscalaItem[]>([]);
  const [folgas, setFolgas] = useState<Record<string, Folga>>({});
  const [carregando, setCarregando] = useState(true);

  const hoje = new Date();
  const [refMes, setRefMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  // Cadastro
  const [modalCad, setModalCad] = useState(false);
  const [salvandoCad, setSalvandoCad] = useState(false);
  const [selTecnicoId, setSelTecnicoId] = useState('');
  const [selParidade, setSelParidade] = useState<'par' | 'impar'>('impar');
  const [selTurno, setSelTurno] = useState<'diurno' | 'noturno'>('diurno');

  // Dia selecionado (modal de folga)
  const [diaSel, setDiaSel] = useState<string | null>(null); // ISO
  const [coberturaPara, setCoberturaPara] = useState<string | null>(null); // folgaKey em edição
  const [coberturaTecnicoId, setCoberturaTecnicoId] = useState('');

  const carregar = async () => {
    setCarregando(true);
    try {
      const [ts, es, fs] = await Promise.all([
        getDocs(collection(db, 'tecnicos')),
        getDocs(collection(db, 'escala')),
        getDocs(collection(db, 'folgas')),
      ]);
      setTecnicos(
        ts.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Tecnico, 'id'>) })).filter((t) => t.ativo !== false)
      );
      setEscala(es.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EscalaItem, 'id'>) })).sort((a, b) => a.tecnicoNome.localeCompare(b.tecnicoNome)));
      const map: Record<string, Folga> = {};
      fs.docs.forEach((d) => {
        const x = d.data() as Folga;
        if (x.tecnicoId && x.data) map[`${x.tecnicoId}_${x.data}`] = { ...x, turno: x.turno || 'diurno' };
      });
      setFolgas(map);
    } catch (e) {
      console.error('Erro ao carregar escala:', e);
      notificar('erro', 'Erro ao carregar a escala.');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => {
    carregar();
  }, []);

  const corPorId = useMemo(() => {
    const m: Record<string, string> = {};
    escala.forEach((e, i) => { m[e.id] = CORES[i % CORES.length]; });
    return m;
  }, [escala]);

  const escaladosNoDia = (dia: number, dataISO: string, turno: 'diurno' | 'noturno') => {
    const paridade = dia % 2 === 0 ? 'par' : 'impar';
    return escala.filter(
      (e) => (e.turno || 'diurno') === turno && e.paridade === paridade && !folgas[`${e.id}_${dataISO}`]
    );
  };

  // Coberturas confirmadas naquele dia/turno (substituto entra no lugar de quem está de folga).
  const coberturasNoDia = (dataISO: string, turno: 'diurno' | 'noturno') =>
    Object.values(folgas).filter((f) => f.data === dataISO && (f.turno || 'diurno') === turno && f.cobertoPor);

  // ── Cadastro ────────────────────────────────────────────────────────────────
  const salvarCadastro = async () => {
    if (!selTecnicoId) { notificar('erro', 'Selecione o técnico.'); return; }
    const t = tecnicos.find((x) => x.id === selTecnicoId);
    if (!t) return;
    setSalvandoCad(true);
    try {
      await setDoc(doc(db, 'escala', t.id), {
        tecnicoNome: t.nome,
        inicial: iniciaisDe(t.nome),
        paridade: selParidade,
        turno: selTurno,
      });
      registrar('editar', 'escala', t.id, `${t.nome} · ${selTurno === 'diurno' ? 'Diurno' : 'Noturno'} · dias ${selParidade === 'par' ? 'pares' : 'ímpares'}`);
      setModalCad(false);
      setSelTecnicoId('');
      setSelParidade('impar');
      setSelTurno('diurno');
      await carregar();
      notificar('sucesso', 'Escala salva.');
    } catch (e) {
      console.error('Erro ao salvar escala:', e);
      notificar('erro', 'Erro ao salvar a escala.');
    } finally {
      setSalvandoCad(false);
    }
  };

  const removerEscala = async (e: EscalaItem) => {
    const ok = await confirmar({
      titulo: 'Remover da escala',
      mensagem: `Remover ${e.tecnicoNome} da escala? A inicial deixará de aparecer no calendário.`,
      textoConfirmar: 'Remover',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'escala', e.id));
      registrar('excluir', 'escala', e.id, `Removido da escala: ${e.tecnicoNome}`);
      await carregar();
    } catch (err) {
      console.error(err);
      notificar('erro', 'Erro ao remover da escala.');
    }
  };

  // ── Folga ─────────────────────────────────────────────────────────────────
  const toggleFolga = async (item: EscalaItem, dataISO: string) => {
    const key = `${item.id}_${dataISO}`;
    try {
      if (folgas[key]) {
        await deleteDoc(doc(db, 'folgas', key));
        setFolgas((prev) => { const n = { ...prev }; delete n[key]; return n; });
        registrar('excluir', 'escala', key, `Folga cancelada · ${item.tecnicoNome} · ${formatarDataBR(dataISO)}`);
      } else {
        const nova: Folga = { tecnicoId: item.id, tecnicoNome: item.tecnicoNome, data: dataISO, turno: item.turno || 'diurno' };
        await setDoc(doc(db, 'folgas', key), nova);
        setFolgas((prev) => ({ ...prev, [key]: nova }));
        registrar('criar', 'escala', key, `Folga · ${item.tecnicoNome} · ${formatarDataBR(dataISO)}`);
      }
    } catch (e) {
      console.error('Erro ao atualizar folga:', e);
      notificar('erro', 'Erro ao atualizar a folga.');
    }
  };

  const fazerCobertura = async (folga: Folga, tecnicoCoberturaId: string) => {
    const t = tecnicos.find((x) => x.id === tecnicoCoberturaId);
    if (!t) { notificar('erro', 'Selecione quem vai cobrir.'); return; }
    const key = `${folga.tecnicoId}_${folga.data}`;
    const atualizada: Folga = { ...folga, cobertoPor: t.id, cobertoPorNome: t.nome };
    try {
      await setDoc(doc(db, 'folgas', key), atualizada);
      setFolgas((prev) => ({ ...prev, [key]: atualizada }));
      registrar('editar', 'escala', key, `Cobertura: ${t.nome} cobre ${folga.tecnicoNome} · ${formatarDataBR(folga.data)}`);
      setCoberturaPara(null);
      setCoberturaTecnicoId('');
      notificar('sucesso', `${t.nome} vai fazer a cobertura.`);
    } catch (e) {
      console.error('Erro ao registrar cobertura:', e);
      notificar('erro', 'Erro ao registrar a cobertura.');
    }
  };

  const cancelarCobertura = async (folga: Folga) => {
    const key = `${folga.tecnicoId}_${folga.data}`;
    const base: Folga = { tecnicoId: folga.tecnicoId, tecnicoNome: folga.tecnicoNome, data: folga.data, turno: folga.turno };
    try {
      await setDoc(doc(db, 'folgas', key), base); // sobrescreve removendo a cobertura
      setFolgas((prev) => ({ ...prev, [key]: base }));
      registrar('editar', 'escala', key, `Cobertura cancelada · ${folga.tecnicoNome} · ${formatarDataBR(folga.data)}`);
    } catch (e) {
      console.error('Erro ao cancelar cobertura:', e);
      notificar('erro', 'Erro ao cancelar a cobertura.');
    }
  };

  // ── Calendário ──────────────────────────────────────────────────────────────
  const ano = refMes.getFullYear();
  const mes = refMes.getMonth();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const primeiroWeekday = new Date(ano, mes, 1).getDay();
  const celulas: (number | null)[] = [
    ...Array(primeiroWeekday).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  const hojeISO = isoDe(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const diaSelNum = diaSel ? Number(diaSel.split('-')[2]) : 0;
  const escalaDoDiaSel = diaSel ? escala.filter((e) => e.paridade === (diaSelNum % 2 === 0 ? 'par' : 'impar')) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar size={24} className="text-primary-600" /> Escala
          </h1>
          <p className="text-gray-500 text-sm">Técnicos escalados por dias pares/ímpares. Clique num dia para solicitar folga.</p>
        </div>
        {admin && (
          <button
            onClick={() => setModalCad(true)}
            className="flex items-center justify-center bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={20} className="mr-2" /> Nova escala
          </button>
        )}
      </div>

      {/* Legenda dos técnicos escalados */}
      {escala.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {escala.map((e) => (
            <span key={e.id} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${corPorId[e.id]}`}>
              <b>{e.inicial}</b> {e.tecnicoNome}
              <span className="opacity-70">· {(e.turno || 'diurno') === 'diurno' ? '☀ Diurno' : '🌙 Noturno'} · {e.paridade === 'par' ? 'pares' : 'ímpares'}</span>
            </span>
          ))}
        </div>
      )}

      {/* Calendário */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <button onClick={() => setRefMes(new Date(ano, mes - 1, 1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18} /></button>
          <h2 className="text-lg font-semibold text-gray-800">{MESES[mes]} {ano}</h2>
          <button onClick={() => setRefMes(new Date(ano, mes + 1, 1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={18} /></button>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-16 text-gray-400"><RefreshCw size={20} className="animate-spin mr-2" /> Carregando...</div>
        ) : (
          <div className="p-2 sm:p-4">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="text-center text-[11px] font-semibold text-gray-400 uppercase py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {celulas.map((dia, idx) => {
                if (dia === null) return <div key={`b${idx}`} />;
                const dataISO = isoDe(ano, mes, dia);
                const diurno = escaladosNoDia(dia, dataISO, 'diurno');
                const noturno = escaladosNoDia(dia, dataISO, 'noturno');
                const cobDiurno = coberturasNoDia(dataISO, 'diurno');
                const cobNoturno = coberturasNoDia(dataISO, 'noturno');
                const ehHoje = dataISO === hojeISO;
                return (
                  <button
                    key={dataISO}
                    onClick={() => setDiaSel(dataISO)}
                    className={`min-h-[88px] sm:min-h-[112px] rounded-lg border p-1 text-left transition-colors flex flex-col ${
                      ehHoje ? 'border-primary-400 bg-primary-50/40' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-xs font-semibold px-0.5 ${ehHoje ? 'text-primary-600' : 'text-gray-400'}`}>{dia}</span>
                    <div className="flex-1 flex flex-col gap-0.5 mt-0.5">
                      <div className="rounded bg-amber-50/70 flex items-start gap-1 px-1 py-0.5">
                        <Sun size={10} className="text-amber-500 shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-0.5 min-w-0">
                          {diurno.map((e) => (
                            <span key={e.id} className={`text-[10px] leading-tight font-semibold px-1 py-0.5 rounded break-words ${corPorId[e.id]}`} title={`${e.tecnicoNome} (diurno)`}>{e.tecnicoNome}</span>
                          ))}
                          {cobDiurno.map((f) => (
                            <span key={`c${f.tecnicoId}`} className="text-[10px] leading-tight font-semibold px-1 py-0.5 rounded break-words bg-emerald-100 text-emerald-700" title={`${f.cobertoPorNome} cobrindo ${f.tecnicoNome}`}>{f.cobertoPorNome} <span className="opacity-70">(cob.)</span></span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded bg-indigo-50/70 flex items-start gap-1 px-1 py-0.5">
                        <Moon size={10} className="text-indigo-400 shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-0.5 min-w-0">
                          {noturno.map((e) => (
                            <span key={e.id} className={`text-[10px] leading-tight font-semibold px-1 py-0.5 rounded break-words ${corPorId[e.id]}`} title={`${e.tecnicoNome} (noturno)`}>{e.tecnicoNome}</span>
                          ))}
                          {cobNoturno.map((f) => (
                            <span key={`c${f.tecnicoId}`} className="text-[10px] leading-tight font-semibold px-1 py-0.5 rounded break-words bg-emerald-100 text-emerald-700" title={`${f.cobertoPorNome} cobrindo ${f.tecnicoNome}`}>{f.cobertoPorNome} <span className="opacity-70">(cob.)</span></span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {escala.length === 0 && !carregando && (
        <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Calendar size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum técnico escalado ainda.</p>
          {admin
            ? <p className="text-xs mt-1">Clique em <b>Nova escala</b> para começar.</p>
            : <p className="text-xs mt-1">O administrador ainda não cadastrou a escala.</p>}
        </div>
      )}

      {/* Modal: Nova escala */}
      {modalCad && admin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalCad(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-800">Escalar técnico</h2>
              <button onClick={() => setModalCad(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"><X size={18} /></button>
            </div>

            {tecnicos.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum técnico cadastrado. Cadastre em <b>Rotina Home Care › Técnicos</b> primeiro.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Técnico</label>
                  <select
                    value={selTecnicoId}
                    onChange={(e) => setSelTecnicoId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    <option value="">Selecione o técnico</option>
                    {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Turno</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['diurno', 'noturno'] as const).map((tt) => (
                      <button
                        key={tt} type="button"
                        onClick={() => setSelTurno(tt)}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
                          selTurno === tt ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {tt === 'diurno' ? <><Sun size={14} /> Diurno</> : <><Moon size={14} /> Noturno</>}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Dias</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['impar', 'par'] as const).map((p) => (
                      <button
                        key={p} type="button"
                        onClick={() => setSelParidade(p)}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                          selParidade === p ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        Dias {p === 'par' ? 'pares' : 'ímpares'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setModalCad(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancelar</button>
                  <button onClick={salvarCadastro} disabled={salvandoCad} className="flex-1 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center">
                    {salvandoCad ? <RefreshCw size={15} className="animate-spin" /> : 'Salvar'}
                  </button>
                </div>

                {/* Escala atual */}
                {escala.length > 0 && (
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Escala atual</p>
                    <div className="space-y-1.5">
                      {escala.map((e) => (
                        <div key={e.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700"><b className={`px-1.5 py-0.5 rounded ${corPorId[e.id]}`}>{e.inicial}</b> {e.tecnicoNome} · {(e.turno || 'diurno') === 'diurno' ? 'Diurno' : 'Noturno'} · {e.paridade === 'par' ? 'pares' : 'ímpares'}</span>
                          <button onClick={() => removerEscala(e)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: dia (solicitar folga) */}
      {diaSel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDiaSel(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-800">{formatarDataBR(diaSel)}</h2>
                <p className="text-xs text-gray-400">Dia {diaSelNum % 2 === 0 ? 'par' : 'ímpar'}</p>
              </div>
              <button onClick={() => setDiaSel(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"><X size={18} /></button>
            </div>

            {escalaDoDiaSel.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">Nenhum técnico escalado para este dia.</p>
            ) : (
              <div className="space-y-4">
                {(['diurno', 'noturno'] as const).map((turno) => {
                  const lista = escalaDoDiaSel.filter((e) => (e.turno || 'diurno') === turno);
                  return (
                    <div key={turno}>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        {turno === 'diurno' ? <><Sun size={13} className="text-amber-500" /> Diurno</> : <><Moon size={13} className="text-indigo-400" /> Noturno</>}
                      </h3>
                      {lista.length === 0 ? (
                        <p className="text-xs text-gray-400">Ninguém escalado neste turno.</p>
                      ) : (
                        <div className="space-y-2">
                          {lista.map((e) => {
                            const key = `${e.id}_${diaSel}`;
                            const folga = folgas[key];
                            const editandoCob = coberturaPara === key;
                            return (
                              <div key={e.id} className={`p-3 rounded-xl border ${folga ? (folga.cobertoPor ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50') : 'border-gray-100'}`}>
                                <div className="flex items-center gap-3">
                                  <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${corPorId[e.id]}`}>{e.inicial}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{e.tecnicoNome}</p>
                                    <p className="text-[11px] text-gray-400">
                                      {!folga ? 'Escalado' : folga.cobertoPor ? `Coberto por ${folga.cobertoPorNome}` : 'De folga — sem cobertura'}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    {!folga && (
                                      <button onClick={() => toggleFolga(e, diaSel)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                                        <Coffee size={14} /> Solicitar folga
                                      </button>
                                    )}
                                    {folga && !folga.cobertoPor && !editandoCob && (
                                      <button onClick={() => { setCoberturaPara(key); setCoberturaTecnicoId(''); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
                                        <UserPlus size={14} /> Fazer cobertura
                                      </button>
                                    )}
                                    {folga && folga.cobertoPor && (
                                      <button onClick={() => cancelarCobertura(folga)} className="text-[11px] text-gray-500 hover:text-red-600">Remover cobertura</button>
                                    )}
                                    {folga && (
                                      <button onClick={() => toggleFolga(e, diaSel)} className="text-[11px] text-gray-500 hover:text-emerald-700">Cancelar folga</button>
                                    )}
                                  </div>
                                </div>
                                {folga && !folga.cobertoPor && editandoCob && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <select value={coberturaTecnicoId} onChange={(ev) => setCoberturaTecnicoId(ev.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300">
                                      <option value="">Quem vai cobrir?</option>
                                      {tecnicos.filter((t) => t.id !== e.id).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                                    </select>
                                    <button onClick={() => fazerCobertura(folga, coberturaTecnicoId)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700">Confirmar</button>
                                    <button onClick={() => setCoberturaPara(null)} className="px-2 py-1.5 text-xs text-gray-500">Cancelar</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Escala;
