import React, { useEffect, useMemo, useState } from 'react';
import {
  Package, PackagePlus, ClipboardCheck, ArrowDownUp, Plus, Edit2, Trash2,
  RefreshCw, X, AlertTriangle, Settings2, Boxes,
} from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../config/auth/authContext';
import { useAuditoria } from '../config/auditoria';
import { useFeedback } from '../components/FeedbackProvider';
import { useConfirm } from '../components/ConfirmProvider';
import { MovimentoSuprimento, Suprimento } from '../interface/interface';
import { hojeISO, formatarDataBR } from '../utils/datas';
import {
  CATEGORIA_LABEL, diasRestantes, emUnidades, formatarQtd, necessidadeMensal,
  nivelDe, saldosPorSuprimento, TIPO_LABEL,
} from '../utils/suprimentos';

// ── Carga inicial ─────────────────────────────────────────────────────────────
// Base: dispensação 4425/4429 de 23/06/2026 (31 dias) do convênio, com os
// consumos diários confirmados pelo Eduardo. A sonda de alívio vem de entrega
// separada. Só o admin dispara essa carga, e só quando a coleção está vazia.
const SUPRIMENTOS_INICIAIS: Omit<Suprimento, 'id'>[] = [
  { nome: 'Sonda de alívio', categoria: 'material', unidade: 'un', consumoDiario: 4, alertaDias: 7, ativo: true },
  { nome: 'Pró-pé', categoria: 'material', unidade: 'un', consumoDiario: 13, alertaDias: 7, ativo: true },
  { nome: 'Luva de procedimento M', categoria: 'material', unidade: 'un', unidadeCompra: 'caixa', qtdPorEmbalagem: 100, consumoDiario: 13, alertaDias: 7, ativo: true },
  { nome: 'Luva de vinil G sem pó', categoria: 'material', unidade: 'un', unidadeCompra: 'caixa', qtdPorEmbalagem: 100, consumoDiario: 6.5, alertaDias: 7, ativo: true },
  { nome: 'Compressa gaze estéril 7,5x7,5cm c/10', categoria: 'material', unidade: 'pc', consumoDiario: 4, alertaDias: 7, ativo: true },
  { nome: 'Agulha 30x8mm', categoria: 'material', unidade: 'un', consumoDiario: 2, alertaDias: 7, ativo: true },
  { nome: 'Equipo p/ irrigação vesical com Urostop', categoria: 'material', unidade: 'un', consumoDiario: 1, alertaDias: 7, ativo: true },
  { nome: 'Seringa 3ml bico luer lock', categoria: 'material', unidade: 'un', consumoDiario: 1, alertaDias: 7, ativo: true },
  { nome: 'Seringa 60ml bico luer lock', categoria: 'material', unidade: 'un', consumoDiario: 1, alertaDias: 7, ativo: true },
  { nome: 'Cloreto de sódio 0,9% 100ml (soro)', categoria: 'medicamento', unidade: 'bolsa', consumoDiario: 1, alertaDias: 7, ativo: true },
  { nome: 'Gentamicina inj 80mg ampola 2ml', categoria: 'medicamento', unidade: 'ampola', consumoDiario: 1, alertaDias: 7, ativo: true },
];

const CORES_NIVEL = {
  ok: { texto: 'text-emerald-600', barra: 'bg-emerald-500', borda: 'border-gray-100', chip: 'bg-emerald-50 text-emerald-700' },
  atencao: { texto: 'text-amber-600', barra: 'bg-amber-500', borda: 'border-amber-200', chip: 'bg-amber-50 text-amber-700' },
  critico: { texto: 'text-red-600', barra: 'bg-red-500', borda: 'border-red-300', chip: 'bg-red-50 text-red-700' },
  zerado: { texto: 'text-red-600', barra: 'bg-red-500', borda: 'border-red-400', chip: 'bg-red-100 text-red-700' },
};

const FORM_VAZIO: Omit<Suprimento, 'id'> = {
  nome: '', categoria: 'material', unidade: 'un', unidadeCompra: '',
  qtdPorEmbalagem: 0, consumoDiario: 1, alertaDias: 7, ativo: true,
};

const Suprimentos: React.FC = () => {
  const { user, perfil, temPapel } = useAuth();
  const { registrar } = useAuditoria();
  const { notificar } = useFeedback();
  const { confirmar } = useConfirm();

  const [suprimentos, setSuprimentos] = useState<Suprimento[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoSuprimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'estoque' | 'cadastro'>('estoque');
  const [semeando, setSemeando] = useState(false);

  // Modal de movimento
  const [movSuprimento, setMovSuprimento] = useState<Suprimento | null>(null);
  const [movTipo, setMovTipo] = useState<'entrada' | 'ajuste' | 'contagem'>('entrada');
  const [movQtd, setMovQtd] = useState('');
  const [movEmCaixas, setMovEmCaixas] = useState(false);
  const [movSinal, setMovSinal] = useState<'mais' | 'menos'>('menos');
  const [movData, setMovData] = useState(hojeISO());
  const [movObs, setMovObs] = useState('');
  const [salvandoMov, setSalvandoMov] = useState(false);

  // Modal de cadastro
  const [modalCad, setModalCad] = useState(false);
  const [cadEditandoId, setCadEditandoId] = useState<string | null>(null);
  const [formCad, setFormCad] = useState<Omit<Suprimento, 'id'>>(FORM_VAZIO);
  const [salvandoCad, setSalvandoCad] = useState(false);

  const admin = temPapel(['admin']);
  const podeDarEntrada = temPapel(['enfermeiro', 'medico', 'admin']);
  const podeMovimentar = temPapel(['tecnico', 'enfermeiro', 'medico', 'admin']);

  // ── Carregamento ────────────────────────────────────────────────────────────
  const carregar = async () => {
    setCarregando(true);
    try {
      const [snapSup, snapMov] = await Promise.all([
        getDocs(collection(db, 'suprimentos')),
        getDocs(collection(db, 'suprimentos-movimentos')),
      ]);
      setSuprimentos(snapSup.docs.map((d) => ({ id: d.id, ...d.data() } as Suprimento)));
      setMovimentos(snapMov.docs.map((d) => ({ id: d.id, ...d.data() } as MovimentoSuprimento)));
    } catch (e) {
      console.error('Erro ao carregar suprimentos:', e);
      notificar('erro', 'Não foi possível carregar os suprimentos.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derivados ───────────────────────────────────────────────────────────────
  const saldos = useMemo(() => saldosPorSuprimento(movimentos), [movimentos]);

  const lista = useMemo(() => {
    const ordem: Record<Suprimento['categoria'], number> = { material: 0, medicamento: 1, higiene: 2 };
    return [...suprimentos]
      .filter((s) => s.ativo !== false)
      .map((s) => {
        const saldo = saldos[s.id] ?? 0;
        const dias = diasRestantes(saldo, s.consumoDiario);
        return { sup: s, saldo, dias, nivel: nivelDe(saldo, dias, s.alertaDias) };
      })
      // Quem está mais perto de acabar aparece primeiro.
      .sort((a, b) => {
        const da = a.dias ?? Number.MAX_SAFE_INTEGER;
        const dbb = b.dias ?? Number.MAX_SAFE_INTEGER;
        return da - dbb || ordem[a.sup.categoria] - ordem[b.sup.categoria] || a.sup.nome.localeCompare(b.sup.nome);
      });
  }, [suprimentos, saldos]);

  const emAlerta = lista.filter((l) => l.nivel === 'critico' || l.nivel === 'zerado').length;

  const ultimosMovimentos = (suprimentoId: string) =>
    movimentos
      .filter((m) => m.suprimentoId === suprimentoId)
      .sort((a, b) => (b.criadoEm ?? '').localeCompare(a.criadoEm ?? ''))
      .slice(0, 5);

  // ── Carga inicial ───────────────────────────────────────────────────────────
  const semearLista = async () => {
    const ok = await confirmar({
      titulo: 'Carregar lista inicial',
      mensagem: `Cadastrar os ${SUPRIMENTOS_INICIAIS.length} suprimentos do home care com os consumos diários já definidos? O estoque começa zerado — registre as entradas depois.`,
      textoConfirmar: 'Carregar',
    });
    if (!ok) return;
    setSemeando(true);
    try {
      const batch = writeBatch(db);
      SUPRIMENTOS_INICIAIS.forEach((s) => batch.set(doc(collection(db, 'suprimentos')), s));
      await batch.commit();
      registrar('criar', 'suprimento', '—', `Carga inicial de ${SUPRIMENTOS_INICIAIS.length} suprimentos`);
      notificar('sucesso', 'Lista inicial cadastrada!');
      carregar();
    } catch (e) {
      console.error('Erro na carga inicial:', e);
      notificar('erro', 'Não foi possível cadastrar a lista inicial.');
    } finally {
      setSemeando(false);
    }
  };

  // ── Movimentos ──────────────────────────────────────────────────────────────
  const abrirMovimento = (sup: Suprimento, tipo: 'entrada' | 'ajuste' | 'contagem') => {
    setMovSuprimento(sup);
    setMovTipo(tipo);
    setMovQtd('');
    setMovEmCaixas(tipo === 'entrada' && !!sup.qtdPorEmbalagem);
    setMovSinal('menos');
    setMovData(hojeISO());
    setMovObs('');
  };

  const fecharMovimento = () => setMovSuprimento(null);

  const salvarMovimento = async () => {
    if (!movSuprimento || !user) return;

    const informado = Number(String(movQtd).replace(',', '.'));
    if (!Number.isFinite(informado) || informado < 0) {
      notificar('erro', 'Informe uma quantidade válida.');
      return;
    }
    if (movTipo !== 'contagem' && informado <= 0) {
      notificar('erro', 'A quantidade precisa ser maior que zero.');
      return;
    }
    if (movTipo === 'ajuste' && !movObs.trim()) {
      notificar('erro', 'Descreva o motivo do ajuste.');
      return;
    }

    const saldoAtual = saldos[movSuprimento.id] ?? 0;
    let quantidade: number;

    if (movTipo === 'entrada') {
      quantidade = emUnidades(informado, movEmCaixas, movSuprimento);
    } else if (movTipo === 'ajuste') {
      quantidade = movSinal === 'mais' ? informado : -informado;
    } else {
      // Contagem: grava a diferença entre o que foi contado e o saldo calculado.
      quantidade = informado - saldoAtual;
      if (quantidade === 0) {
        notificar('sucesso', 'Contagem bate com o saldo do sistema. Nada a corrigir.');
        fecharMovimento();
        return;
      }
    }

    setSalvandoMov(true);
    try {
      const novo: Omit<MovimentoSuprimento, 'id'> = {
        suprimentoId: movSuprimento.id,
        tipo: movTipo,
        quantidade,
        data: movData || hojeISO(),
        origem: movTipo === 'entrada' ? 'dispensacao' : 'manual',
        quem: user.uid,
        quemNome: perfil?.nome ?? user.email ?? '—',
        criadoEm: new Date().toISOString(),
        observacao: movObs.trim(),
      };
      const ref = await addDoc(collection(db, 'suprimentos-movimentos'), novo);
      setMovimentos((prev) => [...prev, { id: ref.id, ...novo }]);

      const sinal = quantidade > 0 ? '+' : '';
      registrar(
        'criar',
        'suprimento-movimento',
        ref.id,
        `${TIPO_LABEL[movTipo]} · ${movSuprimento.nome} · ${sinal}${formatarQtd(quantidade)} ${movSuprimento.unidade}`
      );

      notificar('sucesso', `${TIPO_LABEL[movTipo]} registrada!`);
      fecharMovimento();
    } catch (e) {
      console.error('Erro ao registrar movimento:', e);
      notificar('erro', 'Não foi possível registrar o movimento.');
    } finally {
      setSalvandoMov(false);
    }
  };

  // ── Cadastro ────────────────────────────────────────────────────────────────
  const abrirCadNovo = () => {
    setCadEditandoId(null);
    setFormCad(FORM_VAZIO);
    setModalCad(true);
  };

  const abrirCadEditar = (s: Suprimento) => {
    setCadEditandoId(s.id);
    setFormCad({
      nome: s.nome,
      categoria: s.categoria,
      unidade: s.unidade,
      unidadeCompra: s.unidadeCompra ?? '',
      qtdPorEmbalagem: s.qtdPorEmbalagem ?? 0,
      consumoDiario: s.consumoDiario,
      alertaDias: s.alertaDias ?? 7,
      ativo: s.ativo !== false,
    });
    setModalCad(true);
  };

  const salvarCadastro = async () => {
    if (!formCad.nome.trim()) {
      notificar('erro', 'Informe o nome do suprimento.');
      return;
    }
    setSalvandoCad(true);
    try {
      // O Firestore rejeita undefined: normaliza os campos opcionais.
      const dados: Omit<Suprimento, 'id'> = {
        ...formCad,
        nome: formCad.nome.trim(),
        unidade: formCad.unidade.trim() || 'un',
        unidadeCompra: formCad.unidadeCompra?.trim() || '',
        qtdPorEmbalagem: Number(formCad.qtdPorEmbalagem) || 0,
        consumoDiario: Number(formCad.consumoDiario) || 0,
        alertaDias: Number(formCad.alertaDias) || 7,
      };

      if (cadEditandoId) {
        await setDoc(doc(db, 'suprimentos', cadEditandoId), dados);
        setSuprimentos((prev) => prev.map((s) => (s.id === cadEditandoId ? { id: cadEditandoId, ...dados } : s)));
        registrar('editar', 'suprimento', cadEditandoId, dados.nome);
      } else {
        const ref = await addDoc(collection(db, 'suprimentos'), dados);
        setSuprimentos((prev) => [...prev, { id: ref.id, ...dados }]);
        registrar('criar', 'suprimento', ref.id, dados.nome);
      }
      notificar('sucesso', cadEditandoId ? 'Suprimento atualizado!' : 'Suprimento cadastrado!');
      setModalCad(false);
    } catch (e) {
      console.error('Erro ao salvar suprimento:', e);
      notificar('erro', 'Não foi possível salvar o suprimento.');
    } finally {
      setSalvandoCad(false);
    }
  };

  const excluirSuprimento = async (s: Suprimento) => {
    const temMovimento = movimentos.some((m) => m.suprimentoId === s.id);
    const ok = await confirmar({
      titulo: `Excluir ${s.nome}`,
      mensagem: temMovimento
        ? 'Este suprimento já tem movimentos registrados. Excluir vai deixar esse histórico órfão — prefira desativar pela edição.'
        : 'Tem certeza que deseja excluir este suprimento?',
      textoConfirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'suprimentos', s.id));
      setSuprimentos((prev) => prev.filter((x) => x.id !== s.id));
      registrar('excluir', 'suprimento', s.id, s.nome);
      notificar('sucesso', 'Suprimento excluído.');
    } catch (e) {
      console.error('Erro ao excluir suprimento:', e);
      notificar('erro', 'Não foi possível excluir.');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const saldoMovAtual = movSuprimento ? saldos[movSuprimento.id] ?? 0 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package size={24} className="text-primary-600" /> Suprimentos
          </h1>
          <p className="text-gray-500 text-sm">
            Estoque dos insumos do home care. O saldo é a soma dos movimentos registrados.
          </p>
        </div>
        {admin && abaAtiva === 'cadastro' && (
          <button
            onClick={abrirCadNovo}
            className="flex items-center justify-center bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={20} className="mr-2" /> Novo suprimento
          </button>
        )}
      </div>

      {emAlerta > 0 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            <b>{emAlerta}</b> {emAlerta === 1 ? 'suprimento está' : 'suprimentos estão'} acabando. Vale
            programar a reposição com o convênio.
          </span>
        </div>
      )}

      {/* Abas */}
      {admin && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {[
            { id: 'estoque', label: 'Estoque', icon: Boxes },
            { id: 'cadastro', label: 'Cadastro', icon: Settings2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAbaAtiva(tab.id as typeof abaAtiva)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium flex-1 justify-center transition-all ${
                abaAtiva === tab.id ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {carregando ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" /> Carregando...
        </div>
      ) : suprimentos.length === 0 ? (
        <div className="text-center py-14 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum suprimento cadastrado ainda.</p>
          {admin ? (
            <button
              onClick={semearLista}
              disabled={semeando}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {semeando ? <RefreshCw size={16} className="animate-spin" /> : <PackagePlus size={16} />}
              Carregar lista inicial do home care
            </button>
          ) : (
            <p className="text-xs mt-1">O administrador ainda não cadastrou os suprimentos.</p>
          )}
        </div>
      ) : abaAtiva === 'estoque' ? (
        // ── Estoque ─────────────────────────────────────────────────────────
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {lista.map(({ sup, saldo, dias, nivel }) => {
            const cor = CORES_NIVEL[nivel];
            const pct = dias === null ? 100 : Math.max(0, Math.min(100, (dias / Math.max(sup.alertaDias * 3, 1)) * 100));
            return (
              <div key={sup.id} className={`bg-white rounded-xl border p-4 shadow-sm ${cor.borda}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800 leading-snug">{sup.nome}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {CATEGORIA_LABEL[sup.categoria]} · consumo {formatarQtd(sup.consumoDiario)} {sup.unidade}/dia ·{' '}
                      {necessidadeMensal(sup.consumoDiario)} {sup.unidade}/mês
                    </p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${cor.chip}`}>
                    {dias === null ? 'sem consumo' : nivel === 'zerado' ? 'sem estoque' : `${dias} dia(s)`}
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5 mt-3">
                  <span className={`text-2xl font-extrabold ${cor.texto}`}>{formatarQtd(saldo)}</span>
                  <span className="text-xs text-gray-400">{sup.unidade} em estoque</span>
                </div>

                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div className={`h-full ${cor.barra} transition-all`} style={{ width: `${pct}%` }} />
                </div>

                {podeMovimentar && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {podeDarEntrada && (
                      <button
                        onClick={() => abrirMovimento(sup, 'entrada')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        <PackagePlus size={14} /> Entrada
                      </button>
                    )}
                    <button
                      onClick={() => abrirMovimento(sup, 'ajuste')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                    >
                      <ArrowDownUp size={14} /> Ajuste
                    </button>
                    <button
                      onClick={() => abrirMovimento(sup, 'contagem')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      <ClipboardCheck size={14} /> Contagem
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // ── Cadastro (admin) ────────────────────────────────────────────────
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {[...suprimentos].sort((a, b) => a.nome.localeCompare(b.nome)).map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  {s.nome}
                  {s.ativo === false && <span className="ml-2 text-[11px] text-gray-400">(inativo)</span>}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {CATEGORIA_LABEL[s.categoria]} · {formatarQtd(s.consumoDiario)} {s.unidade}/dia · alerta em{' '}
                  {s.alertaDias} dia(s)
                  {s.qtdPorEmbalagem ? ` · ${s.unidadeCompra || 'embalagem'} c/${s.qtdPorEmbalagem}` : ''}
                </p>
              </div>
              <button
                onClick={() => abrirCadEditar(s)}
                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <Edit2 size={15} />
              </button>
              <button
                onClick={() => excluirSuprimento(s)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal de movimento ─────────────────────────────────────────────── */}
      {movSuprimento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={fecharMovimento}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-800">{movSuprimento.nome}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Saldo atual: <b>{formatarQtd(saldoMovAtual)}</b> {movSuprimento.unidade}
                </p>
              </div>
              <button onClick={fecharMovimento} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Tipo de movimento */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {([
                { id: 'entrada', label: 'Entrada', icon: PackagePlus, habilitado: podeDarEntrada },
                { id: 'ajuste', label: 'Ajuste', icon: ArrowDownUp, habilitado: true },
                { id: 'contagem', label: 'Contagem', icon: ClipboardCheck, habilitado: true },
              ] as const).filter((t) => t.habilitado).map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setMovTipo(t.id); setMovEmCaixas(t.id === 'entrada' && !!movSuprimento.qtdPorEmbalagem); }}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    movTipo === t.id ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <t.icon size={16} />
                  {t.label}
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-4">
              {movTipo === 'entrada' && 'Chegou dispensação do convênio. A quantidade é somada ao estoque.'}
              {movTipo === 'ajuste' && 'Usou mais ou menos do que o previsto. Some ou subtraia informando o motivo.'}
              {movTipo === 'contagem' && 'Conferência física do armário. Informe quanto tem de verdade — o sistema lança a diferença.'}
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  {movTipo === 'contagem' ? 'Quantidade contada' : 'Quantidade'}
                </label>
                <div className="flex gap-2">
                  {movTipo === 'ajuste' && (
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
                      {(['menos', 'mais'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setMovSinal(s)}
                          className={`px-3 py-2 text-sm font-bold transition-colors ${
                            movSinal === s ? (s === 'mais' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : 'text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {s === 'mais' ? '+' : '−'}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={movQtd}
                    onChange={(e) => setMovQtd(e.target.value)}
                    placeholder="0"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>

                {movTipo === 'entrada' && !!movSuprimento.qtdPorEmbalagem && (
                  <label className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                    <input type="checkbox" checked={movEmCaixas} onChange={(e) => setMovEmCaixas(e.target.checked)} className="rounded" />
                    Informar em {movSuprimento.unidadeCompra || 'embalagens'} de {movSuprimento.qtdPorEmbalagem} {movSuprimento.unidade}
                    {movEmCaixas && movQtd && (
                      <span className="text-primary-600 font-semibold">
                        = {formatarQtd(Number(String(movQtd).replace(',', '.')) * (movSuprimento.qtdPorEmbalagem || 1))} {movSuprimento.unidade}
                      </span>
                    )}
                  </label>
                )}

                {movTipo === 'contagem' && movQtd !== '' && (
                  <p className="text-xs text-gray-500 mt-2">
                    Diferença a lançar:{' '}
                    <b className={Number(String(movQtd).replace(',', '.')) - saldoMovAtual >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {Number(String(movQtd).replace(',', '.')) - saldoMovAtual >= 0 ? '+' : ''}
                      {formatarQtd(Number(String(movQtd).replace(',', '.')) - saldoMovAtual)}
                    </b>{' '}
                    {movSuprimento.unidade}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Data</label>
                <input
                  type="date"
                  value={movData}
                  onChange={(e) => setMovData(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  {movTipo === 'ajuste' ? 'Motivo (obrigatório)' : 'Observação'}
                </label>
                <textarea
                  value={movObs}
                  onChange={(e) => setMovObs(e.target.value)}
                  rows={2}
                  placeholder={movTipo === 'entrada' ? 'Ex: Dispensação 4425' : movTipo === 'ajuste' ? 'Ex: 2 sondas a mais na madrugada' : 'Ex: conferência do armário'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={fecharMovimento} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={salvarMovimento}
                  disabled={salvandoMov}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {salvandoMov ? <RefreshCw size={15} className="animate-spin" /> : 'Registrar'}
                </button>
              </div>
            </div>

            {/* Últimos movimentos deste item */}
            {ultimosMovimentos(movSuprimento.id).length > 0 && (
              <div className="pt-4 mt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Últimos movimentos</p>
                <div className="space-y-1.5">
                  {ultimosMovimentos(movSuprimento.id).map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-xs">
                      <span className={`font-bold w-14 shrink-0 ${m.quantidade >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {m.quantidade >= 0 ? '+' : ''}{formatarQtd(m.quantidade)}
                      </span>
                      <span className="text-gray-500 shrink-0">{TIPO_LABEL[m.tipo]}</span>
                      <span className="text-gray-400 truncate flex-1">{m.quemNome}</span>
                      <span className="text-gray-400 shrink-0">{formatarDataBR(m.data)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal de cadastro ──────────────────────────────────────────────── */}
      {modalCad && admin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalCad(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-800">
                {cadEditandoId ? 'Editar suprimento' : 'Novo suprimento'}
              </h2>
              <button onClick={() => setModalCad(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Nome</label>
                <input
                  type="text"
                  value={formCad.nome}
                  onChange={(e) => setFormCad({ ...formCad, nome: e.target.value })}
                  placeholder="Ex: Sonda de alívio"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Categoria</label>
                  <select
                    value={formCad.categoria}
                    onChange={(e) => setFormCad({ ...formCad, categoria: e.target.value as Suprimento['categoria'] })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    {(Object.keys(CATEGORIA_LABEL) as Suprimento['categoria'][]).map((c) => (
                      <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Unidade</label>
                  <input
                    type="text"
                    value={formCad.unidade}
                    onChange={(e) => setFormCad({ ...formCad, unidade: e.target.value })}
                    placeholder="un, pc, bolsa..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Embalagem de compra</label>
                  <input
                    type="text"
                    value={formCad.unidadeCompra ?? ''}
                    onChange={(e) => setFormCad({ ...formCad, unidadeCompra: e.target.value })}
                    placeholder="caixa (opcional)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Unidades por embalagem</label>
                  <input
                    type="number"
                    min="0"
                    value={formCad.qtdPorEmbalagem || ''}
                    onChange={(e) => setFormCad({ ...formCad, qtdPorEmbalagem: Number(e.target.value) })}
                    placeholder="100"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Consumo por dia</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formCad.consumoDiario}
                    onChange={(e) => setFormCad({ ...formCad, consumoDiario: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    {necessidadeMensal(Number(formCad.consumoDiario) || 0)} {formCad.unidade || 'un'} por mês (31 dias)
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Avisar com (dias)</label>
                  <input
                    type="number"
                    min="1"
                    value={formCad.alertaDias}
                    onChange={(e) => setFormCad({ ...formCad, alertaDias: Number(e.target.value) })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={formCad.ativo !== false}
                  onChange={(e) => setFormCad({ ...formCad, ativo: e.target.checked })}
                  className="rounded"
                />
                Ativo (aparece na tela de estoque)
              </label>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalCad(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={salvarCadastro}
                  disabled={salvandoCad}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {salvandoCad ? <RefreshCw size={15} className="animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suprimentos;
