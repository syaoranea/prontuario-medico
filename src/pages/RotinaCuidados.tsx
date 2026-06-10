import React, { useState, useEffect, Fragment } from 'react';
import {
  ClipboardList, CheckSquare, History, Plus, Edit2, Trash2, Save,
  Sun, Moon, AlertTriangle, User, Stethoscope, ChevronDown,
  ChevronUp, Clock, X, RefreshCw, Heart, Activity, ScrollText
} from 'lucide-react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, where, orderBy, writeBatch
} from 'firebase/firestore';

const sortItens = (arr: RotinaItem[]) =>
  [...arr].sort((a, b) => a.turno.localeCompare(b.turno) || a.ordem - b.ordem);
import { db } from '../config/firebase';
import { Dialog, Transition } from '@headlessui/react';
import { RotinaItem, RotinaExecucao, ItemExecucao } from '../interface/interface';

// ── Seed data (routine from the patient's home care plan) ──────────────────────

const ROTINA_INICIAL: Omit<RotinaItem, 'id'>[] = [
  // ── MANHÃ ──────────────────────────────────────────────────────────────────
  { turno: 'manha', secao: 'Início do turno', horario: '07:30', descricao: 'Aferir e registrar sinais vitais: FC, FR, SpO₂, PA, temperatura', responsavel: 'tecnico', ordem: 1, ativo: true },
  { turno: 'manha', secao: 'Início do turno', horario: '07:35', descricao: 'Retirar máscara do BIPAP com cuidado — verificar marcas de pressão no rosto e nariz. Higienizar máscara e guardar em local seco', responsavel: 'tecnico', ordem: 2, ativo: true },
  { turno: 'manha', secao: 'Início do turno', horario: '07:40', descricao: 'Higiene oral completa — escovação e enxague antisséptico', responsavel: 'tecnico', ordem: 3, ativo: true },
  { turno: 'manha', secao: 'Início do turno', horario: '07:45', descricao: 'Café da manhã — posicionar cabeceira 45°, levar alimentos à boca respeitando meu ritmo', responsavel: 'tecnico', ordem: 4, ativo: true },
  { turno: 'manha', secao: 'Início do turno', horario: '07:45', descricao: 'Mastigar e engolir no meu tempo — avisar se tiver dificuldade ou engasgo', responsavel: 'paciente', ordem: 5, ativo: true },
  { turno: 'manha', secao: 'Início do turno', horario: '08:20', descricao: 'Preparar para transferência à cadeira de rodas — posicionar para trabalho', responsavel: 'tecnico', ordem: 6, ativo: true },
  { turno: 'manha', secao: 'Fisioterapia', horario: '08:30', descricao: 'Sessão de fisioterapia — 40 minutos. Técnico permanece disponível mas não interfere durante a sessão', responsavel: 'fisioterapeuta', ordem: 7, ativo: true },
  { turno: 'manha', secao: 'Fisioterapia', horario: '09:10', descricao: 'Registrar: exercícios realizados, tolerância, intercorrências durante a fisioterapia', responsavel: 'tecnico', ordem: 8, ativo: true },
  { turno: 'manha', secao: 'Período de trabalho', horario: '10:00', descricao: 'Verificar postura na cadeira de rodas — reposicionamento se necessário, sem interromper trabalho desnecessariamente', responsavel: 'tecnico', ordem: 9, ativo: true },
  { turno: 'manha', secao: 'Período de trabalho', horario: '10:00', descricao: 'Aferir SpO₂ e registrar — pode ser feito discretamente sem interrupção', responsavel: 'tecnico', ordem: 10, ativo: true },
  { turno: 'manha', secao: 'Período de trabalho', horario: '11:00', descricao: 'Oferecer água — registrar aceitação', responsavel: 'tecnico', ordem: 11, ativo: true },
  { turno: 'manha', secao: 'Período de trabalho', horario: '11:50', descricao: 'Administrar sulfato ferroso — 30 minutos antes do almoço. Oferecer com suco de laranja. Registrar horário', responsavel: 'tecnico', ordem: 12, ativo: true },
  { turno: 'manha', secao: 'Almoço', horario: '12:15', descricao: 'Verificar posição — cabeceira ou postura na cadeira adequada para refeição', responsavel: 'tecnico', ordem: 13, ativo: true },
  { turno: 'manha', secao: 'Almoço', horario: '12:20', descricao: 'Levar alimentos à boca — respeitar meu ritmo e preferências. Não apressar', responsavel: 'tecnico', ordem: 14, ativo: true },
  { turno: 'manha', secao: 'Almoço', horario: '12:20', descricao: 'Mastigar e engolir no meu ritmo — avisar engasgos ou dificuldades', responsavel: 'paciente', ordem: 15, ativo: true },
  { turno: 'manha', secao: 'Almoço', horario: '13:00', descricao: 'Higiene oral pós-almoço', responsavel: 'tecnico', ordem: 16, ativo: true },
  { turno: 'manha', secao: 'Almoço', horario: '13:00', descricao: 'Aferir sinais vitais — 2ª aferição do turno. Registrar', responsavel: 'tecnico', ordem: 17, ativo: true },
  { turno: 'manha', secao: 'Almoço', horario: '13:00', descricao: 'Oferecer água — 1º copo da sequência horária', responsavel: 'tecnico', ordem: 18, ativo: true },
  { turno: 'manha', secao: 'Retorno ao trabalho', horario: '14:00', descricao: 'Oferecer água — registrar aceitação', responsavel: 'tecnico', ordem: 19, ativo: true },
  { turno: 'manha', secao: 'Retorno ao trabalho', horario: '14:45', descricao: 'Registrar evolução do turno da manhã e preparar passagem', responsavel: 'tecnico', ordem: 20, ativo: true },

  // ── MANHÃ (continuação) — itens anteriormente no turno tarde 15h–18h55 ────────
  { turno: 'manha', secao: 'Período de trabalho', horario: '15:00', descricao: 'Oferecer água — registrar', responsavel: 'tecnico', ordem: 21, ativo: true },
  { turno: 'manha', secao: 'Período de trabalho', horario: '15:30', descricao: 'Lanche da tarde — oferecer sem interromper trabalho, respeitar se quiser continuar primeiro', responsavel: 'tecnico', ordem: 22, ativo: true },
  { turno: 'manha', secao: 'Período de trabalho', horario: '16:00', descricao: 'Aferir sinais vitais — registrar. Oferecer água', responsavel: 'tecnico', ordem: 23, ativo: true },
  { turno: 'manha', secao: 'Período de trabalho', horario: '16:30', descricao: 'Administrar risdiplam — diluído conforme orientação médica. Registrar horário e lote. Não atrasar esta dose', responsavel: 'tecnico', ordem: 24, ativo: true },
  { turno: 'manha', secao: 'Período de trabalho', horario: '17:00', descricao: 'Oferecer água', responsavel: 'tecnico', ordem: 25, ativo: true },
  { turno: 'manha', secao: 'Período de trabalho', horario: '18:00', descricao: 'Oferecer água. Preparar banheiro e cadeira de banho para o banho das 18h30', responsavel: 'tecnico', ordem: 26, ativo: true },
  { turno: 'manha', secao: 'Banho', horario: '18:20', descricao: 'Preparar banheiro: água aquecida, cadeira de banho posicionada, toalha, roupa limpa, produtos de higiene — tudo acessível antes de transferir', responsavel: 'tecnico', ordem: 27, ativo: true },
  { turno: 'manha', secao: 'Banho', horario: '18:25', descricao: 'Transferência da cadeira de rodas para a cadeira de banho com segurança — dois técnicos se disponível', responsavel: 'tecnico', ordem: 28, ativo: true },
  { turno: 'manha', secao: 'Banho', horario: '18:30', descricao: 'Banho completo — respeitar privacidade, temperatura da água confortável, sem pressa', responsavel: 'tecnico', ordem: 29, ativo: true },
  { turno: 'manha', secao: 'Banho', horario: '18:30', descricao: 'Informar se água estiver quente/fria demais ou qualquer desconforto', responsavel: 'paciente', ordem: 30, ativo: true },
  { turno: 'manha', secao: 'Banho', horario: '18:50', descricao: 'Inspeção completa da pele durante secagem — sacro, calcâneos, maléolos, joelhos, occipital. Registrar qualquer alteração', responsavel: 'tecnico', ordem: 31, ativo: true },
  { turno: 'manha', secao: 'Banho', horario: '18:55', descricao: 'Hidratante corporal nas proeminências. Vestir roupa limpa. Transferência de volta à cadeira de rodas ou para a cama', responsavel: 'tecnico', ordem: 32, ativo: true },

  // ── NOITE ──────────────────────────────────────────────────────────────────
  { turno: 'noite', secao: 'Início do turno', horario: '19:00', descricao: 'Aproveitar que estou fora da cama: trocar toda a roupa de cama agora', responsavel: 'tecnico', ordem: 1, ativo: true },
  { turno: 'noite', secao: 'Jantar', horario: '19:25', descricao: 'Posicionar para refeição — cabeceira 45° se já na cama, ou postura adequada na cadeira', responsavel: 'tecnico', ordem: 2, ativo: true },
  { turno: 'noite', secao: 'Jantar', horario: '19:30', descricao: 'Levar jantar à boca — no meu ritmo. Oferecer água durante a refeição', responsavel: 'tecnico', ordem: 3, ativo: true },
  { turno: 'noite', secao: 'Jantar', horario: '20:15', descricao: 'Higiene oral pós-jantar', responsavel: 'tecnico', ordem: 4, ativo: true },
  { turno: 'noite', secao: 'Jantar', horario: '20:15', descricao: 'Aferir sinais vitais — 2ª aferição do turno da noite. Registrar', responsavel: 'tecnico', ordem: 5, ativo: true },
  { turno: 'noite', secao: 'Jantar', horario: '20:30', descricao: 'Transferência para cama se ainda não estiver. Posicionamento com coxins de apoio', responsavel: 'tecnico', ordem: 6, ativo: true },
  { turno: 'noite', secao: 'Preparação para BIPAP', horario: '21:00', descricao: 'Mudança de decúbito — registrar posição. Verificar calcâneos flutuantes e coxins', responsavel: 'tecnico', ordem: 7, ativo: true },
  { turno: 'noite', secao: 'Preparação para BIPAP', horario: '22:30', descricao: 'Posicionamento final para dormir — decúbito preferido, coxins, cabeceira adequada', responsavel: 'tecnico', ordem: 8, ativo: true },
  { turno: 'noite', secao: 'Preparação para BIPAP', horario: '23:00', descricao: 'Conectar BIPAP — ajustar máscara sem pressão excessiva, verificar ausência de vazamento', responsavel: 'tecnico', ordem: 9, ativo: true },
  { turno: 'noite', secao: 'Preparação para BIPAP', horario: '23:00', descricao: 'Avisar se máscara estiver desconfortável ou com vazamento — não tolerar em silêncio', responsavel: 'paciente', ordem: 10, ativo: true },
  { turno: 'noite', secao: 'Preparação para BIPAP', horario: '23:10', descricao: 'Confirmar SpO₂ estável após início do BIPAP — registrar. Registrar evolução e preparar passagem', responsavel: 'tecnico', ordem: 11, ativo: true },
  { turno: 'noite', secao: 'Passagem de plantão', horario: '19:00', descricao: 'Receber informações do plantão anterior: sinais vitais, alimentação, posições, intercorrências', responsavel: 'tecnico', ordem: 12, ativo: true },
  { turno: 'noite', secao: 'Monitoramento noturno', horario: '00:00', descricao: 'Aferir SpO₂ e FR — registrar sem acordar se estiver dormindo bem', responsavel: 'tecnico', ordem: 2, ativo: true },
  { turno: 'noite', secao: 'Monitoramento noturno', horario: '01:00', descricao: 'Mudança de decúbito com cuidado para não deslocar máscara do BIPAP — registrar posição', responsavel: 'tecnico', ordem: 3, ativo: true },
  { turno: 'noite', secao: 'Monitoramento noturno', horario: '03:00', descricao: 'Mudança de decúbito + verificar ajuste e vedação da máscara do BIPAP', responsavel: 'tecnico', ordem: 4, ativo: true },
  { turno: 'noite', secao: 'Monitoramento noturno', horario: '04:00', descricao: 'Aferir sinais vitais completos — registrar', responsavel: 'tecnico', ordem: 5, ativo: true },
  { turno: 'noite', secao: 'Monitoramento noturno', horario: '05:00', descricao: 'Mudança de decúbito — registrar', responsavel: 'tecnico', ordem: 6, ativo: true },
  { turno: 'noite', secao: 'Monitoramento noturno', horario: '06:50', descricao: 'Registrar evolução do turno: sono, SpO₂ mínima da noite, posições usadas, funcionamento do BIPAP, intercorrências', responsavel: 'tecnico', ordem: 7, ativo: true },
  { turno: 'noite', secao: 'Monitoramento noturno', horario: 'Qualquer hora', descricao: 'SpO₂ < 92% ou alarme do BIPAP → verificar máscara imediatamente. Se não resolver em 2 min → acionar médico', responsavel: 'urgencia', ordem: 8, ativo: true },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const TURNO_CONFIG = {
  manha: { label: 'Manhã', sublabel: '7h – 19h', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  noite: { label: 'Noite', sublabel: '19h – 7h', icon: Moon, color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-200' },
};

const RESPONSAVEL_CONFIG = {
  tecnico: { label: 'Técnico', color: 'bg-green-100 text-green-700' },
  enfermeiro: { label: 'Enfermeiro', color: 'bg-blue-100 text-blue-700' },
  paciente: { label: 'Minha participação', color: 'bg-amber-100 text-amber-700' },
  fisioterapeuta: { label: 'Fisioterapeuta', color: 'bg-purple-100 text-purple-700' },
  urgencia: { label: 'Urgência', color: 'bg-red-100 text-red-700' },
};

const hoje = () => new Date().toISOString().split('T')[0];

const formatarData = (data: string) => {
  const [y, m, d] = data.split('-');
  return `${d}/${m}/${y}`;
};

const formatarTurnoLabel = (turno: string) => {
  return TURNO_CONFIG[turno as keyof typeof TURNO_CONFIG]?.label ?? turno;
};

// ── Component ─────────────────────────────────────────────────────────────────

const RotinaCuidados: React.FC = () => {
  const [abaAtiva, setAbaAtiva] = useState<'rotina' | 'checklist' | 'historico'>('rotina');
  const [modo, setModo] = useState<'paciente' | 'auxiliar'>('paciente');
  const [turnoAtivo, setTurnoAtivo] = useState<'manha' | 'noite'>('manha');

  // Routine items
  const [itens, setItens] = useState<RotinaItem[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(true);

  // Checklist state
  const [dataChecklist, setDataChecklist] = useState(hoje());
  const [turnoChecklist, setTurnoChecklist] = useState<'manha' | 'noite'>('manha');
  const [auxiliarNome, setAuxiliarNome] = useState('');
  const [checkMap, setCheckMap] = useState<Record<string, { concluido: boolean; observacao: string; horarioConcluido?: string }>>({});
  const [obsGeral, setObsGeral] = useState('');
  const [execucaoAtualId, setExecucaoAtualId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [checklistSalvo, setChecklistSalvo] = useState(false);

  // History
  const [execucoes, setExecucoes] = useState<RotinaExecucao[]>([]);
  const [carregandoExec, setCarregandoExec] = useState(false);
  const [execucaoExpandida, setExecucaoExpandida] = useState<string | null>(null);

  // Modal add/edit item
  const [modalRegrasAberto, setModalRegrasAberto] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [itemEditandoId, setItemEditandoId] = useState<string | null>(null);
  const [formItem, setFormItem] = useState({
    turno: 'manha' as 'manha' | 'noite',
    secao: '',
    horario: '',
    descricao: '',
    responsavel: 'tecnico' as RotinaItem['responsavel'],
  });

  // Feedback
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);

  // ── Load routine items ──────────────────────────────────────────────────────
  const carregarItens = async () => {
    setCarregandoItens(true);
    try {
      const snap = await getDocs(collection(db, 'rotina-items'));
      if (snap.empty) {
        await seedRotina();
        return;
      }
      setItens(sortItens(snap.docs.map(d => ({ id: d.id, ...d.data() } as RotinaItem))));
    } catch (err) {
      console.error('Erro ao carregar rotina:', err);
    } finally {
      setCarregandoItens(false);
    }
  };

  const seedRotina = async () => {
    try {
      const batch = writeBatch(db);
      ROTINA_INICIAL.forEach(item => {
        const ref = doc(collection(db, 'rotina-items'));
        batch.set(ref, item);
      });
      await batch.commit();
      const snap = await getDocs(collection(db, 'rotina-items'));
      setItens(sortItens(snap.docs.map(d => ({ id: d.id, ...d.data() } as RotinaItem))));
    } catch (err) {
      console.error('Erro ao fazer seed da rotina:', err);
    } finally {
      setCarregandoItens(false);
    }
  };

  // ── Load history ────────────────────────────────────────────────────────────
  const carregarHistorico = async () => {
    setCarregandoExec(true);
    try {
      const snap = await getDocs(query(collection(db, 'rotina-execucoes'), orderBy('data', 'desc')));
      const execOrdenadas = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as RotinaExecucao))
        .sort((a, b) => b.data.localeCompare(a.data) || a.turno.localeCompare(b.turno));
      setExecucoes(execOrdenadas);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setCarregandoExec(false);
    }
  };

  // ── Load existing checklist for date+shift ───────────────────────────────────
  const carregarExecucaoExistente = async (data: string, turno: string) => {
    try {
      const snap = await getDocs(query(
        collection(db, 'rotina-execucoes'),
        where('data', '==', data),
        where('turno', '==', turno)
      ));
      if (!snap.empty) {
        const d = snap.docs[0];
        const exec = { id: d.id, ...d.data() } as RotinaExecucao;
        setExecucaoAtualId(exec.id);
        setAuxiliarNome(exec.auxiliar);
        setObsGeral(exec.observacaoGeral);
        const map: typeof checkMap = {};
        exec.itens.forEach(it => {
          map[it.rotinaItemId] = { concluido: it.concluido, observacao: it.observacao, horarioConcluido: it.horarioConcluido };
        });
        setCheckMap(map);
        setChecklistSalvo(true);
      } else {
        setExecucaoAtualId(null);
        setObsGeral('');
        setCheckMap({});
        setChecklistSalvo(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { carregarItens(); }, []);

  useEffect(() => {
    if (abaAtiva === 'historico') carregarHistorico();
  }, [abaAtiva]);

  useEffect(() => {
    if (abaAtiva === 'checklist') carregarExecucaoExistente(dataChecklist, turnoChecklist);
  }, [dataChecklist, turnoChecklist, abaAtiva]);

  // ── CRUD routine items ──────────────────────────────────────────────────────
  const abrirModalNovo = () => {
    setItemEditandoId(null);
    setFormItem({ turno: turnoAtivo, secao: '', horario: '', descricao: '', responsavel: 'tecnico' });
    setModalAberto(true);
  };

  const abrirModalEditar = (item: RotinaItem) => {
    setItemEditandoId(item.id);
    setFormItem({ turno: item.turno, secao: item.secao, horario: item.horario, descricao: item.descricao, responsavel: item.responsavel });
    setModalAberto(true);
  };

  const salvarItem = async () => {
    if (!formItem.descricao.trim()) return;
    try {
      const itensTurno = itens.filter(i => i.turno === formItem.turno);
      const ordemMax = itensTurno.length > 0 ? Math.max(...itensTurno.map(i => i.ordem)) : 0;

      if (itemEditandoId) {
        await updateDoc(doc(db, 'rotina-items', itemEditandoId), { ...formItem });
        setItens(prev => prev.map(i => i.id === itemEditandoId ? { ...i, ...formItem } : i));
      } else {
        const novoItem = { ...formItem, ordem: ordemMax + 1, ativo: true };
        const ref = await addDoc(collection(db, 'rotina-items'), novoItem);
        setItens(prev => [...prev, { id: ref.id, ...novoItem }]);
      }
      setModalAberto(false);
      mostrarFeedback('ok', itemEditandoId ? 'Item atualizado.' : 'Item adicionado à rotina.');
    } catch {
      mostrarFeedback('erro', 'Erro ao salvar item.');
    }
  };

  const excluirItem = async (id: string) => {
    if (!confirm('Excluir este item da rotina?')) return;
    try {
      await deleteDoc(doc(db, 'rotina-items', id));
      setItens(prev => prev.filter(i => i.id !== id));
      mostrarFeedback('ok', 'Item removido.');
    } catch {
      mostrarFeedback('erro', 'Erro ao excluir.');
    }
  };

  // ── Checklist ───────────────────────────────────────────────────────────────
  const toggleItem = (id: string) => {
    const agora = new Date().toTimeString().slice(0, 5);
    setCheckMap(prev => {
      const atual = prev[id] ?? { concluido: false, observacao: '' };
      return { ...prev, [id]: { ...atual, concluido: !atual.concluido, horarioConcluido: !atual.concluido ? agora : undefined } };
    });
    setChecklistSalvo(false);
  };

  const setObsItem = (id: string, obs: string) => {
    setCheckMap(prev => ({ ...prev, [id]: { ...(prev[id] ?? { concluido: false, observacao: '' }), observacao: obs } }));
    setChecklistSalvo(false);
  };

  const salvarChecklist = async () => {
    if (!auxiliarNome.trim()) { mostrarFeedback('erro', 'Informe o nome do técnico antes de salvar.'); return; }
    setSalvando(true);
    try {
      const itensTurno = itens.filter(i => i.turno === turnoChecklist && i.ativo);
      const itensSalvos: ItemExecucao[] = itensTurno.map(item => ({
        rotinaItemId: item.id,
        concluido: checkMap[item.id]?.concluido ?? false,
        observacao: checkMap[item.id]?.observacao ?? '',
        horarioConcluido: checkMap[item.id]?.horarioConcluido,
      }));

      const agora = new Date().toISOString();
      const payload = {
        data: dataChecklist,
        turno: turnoChecklist,
        auxiliar: auxiliarNome,
        itens: itensSalvos,
        observacaoGeral: obsGeral,
        atualizadoEm: agora,
      };

      if (execucaoAtualId) {
        await updateDoc(doc(db, 'rotina-execucoes', execucaoAtualId), payload);
      } else {
        const ref = await addDoc(collection(db, 'rotina-execucoes'), { ...payload, criadoEm: agora });
        setExecucaoAtualId(ref.id);
      }
      setChecklistSalvo(true);
      mostrarFeedback('ok', 'Checklist salvo com sucesso!');
    } catch {
      mostrarFeedback('erro', 'Erro ao salvar checklist.');
    } finally {
      setSalvando(false);
    }
  };

  // ── Feedback ────────────────────────────────────────────────────────────────
  const mostrarFeedback = (tipo: 'ok' | 'erro', msg: string) => {
    setFeedback({ tipo, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const itensPorTurnoSecao = (turno: 'manha' | 'noite') => {
    const filtrados = itens.filter(i => i.turno === turno && i.ativo);
    const secoes: Record<string, RotinaItem[]> = {};
    filtrados.forEach(item => {
      if (!secoes[item.secao]) secoes[item.secao] = [];
      secoes[item.secao].push(item);
    });
    return secoes;
  };

  const progressoChecklist = () => {
    const itensTurno = itens.filter(i => i.turno === turnoChecklist && i.ativo);
    const concluidos = itensTurno.filter(i => checkMap[i.id]?.concluido).length;
    return { concluidos, total: itensTurno.length };
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Heart size={22} className="text-primary-600" />
            Rotina de Home Care
          </h1>
          <p className="text-sm text-gray-500 mt-1">AME tipo 2 · BIPAP noturno · 3 turnos 24h</p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          {/* Regras da Casa */}
          <button
            onClick={() => setModalRegrasAberto(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all"
          >
            <ScrollText size={15} /> Regras da casa
          </button>

          {/* Mode toggle */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setModo('paciente')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${modo === 'paciente' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <User size={15} /> Paciente
            </button>
            <button
              onClick={() => setModo('auxiliar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${modo === 'auxiliar' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Stethoscope size={15} /> Técnico
            </button>
          </div>
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${feedback.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {[
          { id: 'rotina', label: 'Rotina', icon: ClipboardList },
          { id: 'checklist', label: modo === 'auxiliar' ? 'Checklist do Turno' : 'Checklist', icon: CheckSquare },
          { id: 'historico', label: 'Histórico', icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setAbaAtiva(tab.id as typeof abaAtiva)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium flex-1 justify-center transition-all ${abaAtiva === tab.id ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <tab.icon size={15} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── ABA: ROTINA ─────────────────────────────────────────────────── */}
      {abaAtiva === 'rotina' && (
        <div>
          {/* Legenda */}
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(RESPONSAVEL_CONFIG).map(([k, v]) => (
              <span key={k} className={`text-xs font-medium px-2.5 py-1 rounded-full ${v.color}`}>{v.label}</span>
            ))}
          </div>

          {/* Turno selector */}
          <div className="flex gap-2 mb-5">
            {(['manha', 'noite'] as const).map(t => {
              const cfg = TURNO_CONFIG[t];
              const Icon = cfg.icon;
              return (
                <button
                  key={t}
                  onClick={() => setTurnoAtivo(t)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${turnoAtivo === t ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <Icon size={15} />
                  <span>{cfg.label}</span>
                  <span className="hidden md:inline text-xs opacity-70">{cfg.sublabel}</span>
                </button>
              );
            })}
          </div>

          {carregandoItens ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> Carregando rotina...
            </div>
          ) : (
            <>
              {Object.entries(itensPorTurnoSecao(turnoAtivo)).map(([secao, items]) => (
                <div key={secao} className="mb-5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{secao}</h3>
                  <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                    {items.map(item => {
                      const resp = RESPONSAVEL_CONFIG[item.responsavel];
                      return (
                        <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                          <span className="text-xs font-mono text-gray-400 mt-0.5 min-w-[38px]">{item.horario}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${resp.color}`}>{resp.label}</span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">{item.descricao}</p>
                          </div>
                          {modo === 'paciente' && (
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                              <button onClick={() => abrirModalEditar(item)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => excluirItem(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {modo === 'paciente' && (
                <button
                  onClick={abrirModalNovo}
                  className="flex items-center gap-2 w-full justify-center px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-all mt-2"
                >
                  <Plus size={16} /> Adicionar item ao turno {TURNO_CONFIG[turnoAtivo].label.toLowerCase()}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ABA: CHECKLIST ──────────────────────────────────────────────── */}
      {abaAtiva === 'checklist' && (
        <div>
          {/* Date + shift + aux name */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Data</label>
              <input
                type="date"
                value={dataChecklist}
                onChange={e => { setDataChecklist(e.target.value); setChecklistSalvo(false); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Turno</label>
              <select
                value={turnoChecklist}
                onChange={e => { setTurnoChecklist(e.target.value as typeof turnoChecklist); setChecklistSalvo(false); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="manha">☀️ Manhã (7h–19h)</option>
                <option value="noite">🌙 Noite (19h–7h)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Técnico responsável</label>
              <input
                type="text"
                placeholder="Nome do técnico"
                value={auxiliarNome}
                onChange={e => { setAuxiliarNome(e.target.value); setChecklistSalvo(false); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>

          {/* Progress bar */}
          {(() => {
            const { concluidos, total } = progressoChecklist();
            const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;
            return (
              <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span className="font-medium">Progresso do turno</span>
                  <span className="font-semibold text-primary-600">{concluidos}/{total} itens · {pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}

          {/* Items to check */}
          {carregandoItens ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> Carregando...
            </div>
          ) : (
            <>
              {Object.entries(itensPorTurnoSecao(turnoChecklist)).map(([secao, secItems]) => (
                <div key={secao} className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{secao}</h3>
                  <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                    {secItems.map(item => {
                      const check = checkMap[item.id] ?? { concluido: false, observacao: '' };
                      const resp = RESPONSAVEL_CONFIG[item.responsavel];
                      return (
                        <div key={item.id} className={`px-4 py-3 transition-colors ${check.concluido ? 'bg-green-50/50' : ''}`}>
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => toggleItem(item.id)}
                              className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${check.concluido ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-primary-400'}`}
                            >
                              {check.concluido && <span className="text-white text-xs font-bold">✓</span>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-xs font-mono text-gray-400">{item.horario}</span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${resp.color}`}>{resp.label}</span>
                                {check.concluido && check.horarioConcluido && (
                                  <span className="text-xs text-green-600 flex items-center gap-1">
                                    <Clock size={10} /> Concluído às {check.horarioConcluido}
                                  </span>
                                )}
                              </div>
                              <p className={`text-sm leading-relaxed ${check.concluido ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.descricao}</p>
                              <input
                                type="text"
                                placeholder="Observação (opcional)"
                                value={check.observacao}
                                onChange={e => setObsItem(item.id, e.target.value)}
                                className="mt-2 w-full text-xs border border-gray-100 bg-gray-50 rounded-lg px-3 py-1.5 text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-200 focus:border-primary-300"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Observação geral */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Observação geral do turno</label>
                <textarea
                  rows={3}
                  placeholder="Intercorrências, sinais vitais relevantes, como o paciente se sentiu..."
                  value={obsGeral}
                  onChange={e => { setObsGeral(e.target.value); setChecklistSalvo(false); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              <button
                onClick={salvarChecklist}
                disabled={salvando}
                className={`flex items-center gap-2 w-full justify-center px-5 py-3 rounded-xl text-sm font-semibold transition-all ${checklistSalvo ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'}`}
              >
                {salvando ? <RefreshCw size={15} className="animate-spin" /> : checklistSalvo ? <><span>✓</span> Checklist salvo</> : <><Save size={15} /> Salvar checklist</>}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── ABA: HISTÓRICO ──────────────────────────────────────────────── */}
      {abaAtiva === 'historico' && (
        <div>
          {carregandoExec ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> Carregando histórico...
            </div>
          ) : execucoes.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <History size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum registro ainda.</p>
              <p className="text-xs mt-1">Os check-ins salvos pelo técnico aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {execucoes.map(exec => {
                const cfg = TURNO_CONFIG[exec.turno];
                const Icon = cfg.icon;
                const total = exec.itens.length;
                const concluidos = exec.itens.filter(i => i.concluido).length;
                const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;
                const aberto = execucaoExpandida === exec.id;

                return (
                  <div key={exec.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => setExecucaoExpandida(aberto ? null : exec.id)}
                      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className={`p-2 rounded-lg ${cfg.bg}`}>
                        <Icon size={16} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{formatarData(exec.data)}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">Técnico: {exec.auxiliar || '—'}</span>
                          <span className={`text-xs font-medium ${pct === 100 ? 'text-green-600' : 'text-amber-600'}`}>{concluidos}/{total} itens ({pct}%)</span>
                        </div>
                      </div>
                      {aberto ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                    </button>

                    {aberto && (
                      <div className="border-t border-gray-50 px-4 py-4">
                        {/* Agrupa itens por seção */}
                        {(() => {
                          const itensTurno = itens.filter(i => i.turno === exec.turno && i.ativo);
                          const secoes: Record<string, { item: RotinaItem; exec: ItemExecucao | undefined }[]> = {};
                          itensTurno.forEach(item => {
                            if (!secoes[item.secao]) secoes[item.secao] = [];
                            const execItem = exec.itens.find(e => e.rotinaItemId === item.id);
                            secoes[item.secao].push({ item, exec: execItem });
                          });
                          return Object.entries(secoes).map(([secao, items]) => (
                            <div key={secao} className="mb-4">
                              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{secao}</h4>
                              <div className="space-y-1.5">
                                {items.map(({ item, exec: execItem }) => (
                                  <div key={item.id} className="flex items-start gap-3">
                                    <span className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 ${execItem?.concluido ? 'bg-green-500' : 'bg-gray-100'}`}>
                                      {execItem?.concluido && <span className="text-white text-[9px] font-bold">✓</span>}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-gray-400">{item.horario}</span>
                                        <span className={`text-xs ${execItem?.concluido ? 'text-gray-500 line-through' : 'text-gray-600'}`}>{item.descricao}</span>
                                      </div>
                                      {execItem?.observacao && (
                                        <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded mt-1">💬 {execItem.observacao}</p>
                                      )}
                                      {execItem?.horarioConcluido && (
                                        <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                                          <Clock size={9} /> {execItem.horarioConcluido}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}

                        {exec.observacaoGeral && (
                          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
                            <p className="text-xs font-semibold text-blue-700 mb-1">Observação geral do turno</p>
                            <p className="text-sm text-blue-800">{exec.observacaoGeral}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modal Regras da Casa ────────────────────────────────────────── */}
      <Transition appear show={modalRegrasAberto} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setModalRegrasAberto(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto flex items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                  <Dialog.Title className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <ScrollText size={18} className="text-amber-600" />
                    Regras da casa — plantão 12h
                  </Dialog.Title>
                  <button onClick={() => setModalRegrasAberto(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    { n: 1, titulo: 'Troca de calçado obrigatória', desc: 'Sapatilha ou chinelo exclusivo ao entrar. Calçado da rua fica na entrada.' },
                    { n: 2, titulo: 'Higiene das mãos', desc: 'Álcool gel ao entrar, antes e após cada procedimento, sempre que for atender o paciente.' },
                    { n: 3, titulo: 'Evitar fazer barulho', desc: 'Durante 10h30 até as 11h30 paciente está em reunião.' },
                    { n: 4, titulo: 'Visitas não são permitidas', desc: 'O técnico não pode receber visitas pessoais durante o plantão.' },
                    { n: 5, titulo: 'Descanso', desc: 'O descanso de 1h pode ser feito no quarto.' },
                    { n: 6, titulo: 'Cozinha com responsabilidade', desc: 'Lavar e guardar tudo que usar.' },
                    { n: 7, titulo: 'Privacidade do paciente', desc: 'Fotos, vídeos e informações sobre o paciente e a casa são confidenciais.' },
                    { n: 8, titulo: 'Doença: avisar com antecedência', desc: 'Se estiver com sintomas gripais ou febre, avisar a empresa de home care com antecedência para substituição.' },
                    { n: 9, titulo: 'Respeito mútuo', desc: 'Este é o lar do paciente. Barulho, conversas altas e uso da TV em volume alto não são permitidos após as 22h.' },
                    { n: 10, titulo: 'Trocar de roupa ao começar plantão', desc: 'Ao chegar, trocar a roupa da rua por uniforme limpo antes de entrar no quarto do paciente. Roupa de rua pode carregar agentes contaminantes — especialmente importante para AME tipo 2 com risco respiratório. O técnico deve trazer seu próprio uniforme limpo a cada plantão.', obs: 'Vestir o uniforme por cima da blusa.' },
                  ].map(({ n, titulo, desc, obs }) => (
                    <div key={n} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{titulo}</p>
                        <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{desc}</p>
                        {obs && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-2">
                            <span className="font-semibold">Obs:</span> {obs}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setModalRegrasAberto(false)}
                  className="mt-5 w-full px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
                >
                  Entendido
                </button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* ── Modal add/edit item ──────────────────────────────────────────── */}
      <Transition appear show={modalAberto} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setModalAberto(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto flex items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-5">
                  <Dialog.Title className="text-base font-semibold text-gray-800">
                    {itemEditandoId ? 'Editar item' : 'Novo item da rotina'}
                  </Dialog.Title>
                  <button onClick={() => setModalAberto(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Turno</label>
                      <select value={formItem.turno} onChange={e => setFormItem(p => ({ ...p, turno: e.target.value as typeof formItem.turno }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                        <option value="manha">☀️ Manhã (7h–19h)</option>
                        <option value="noite">🌙 Noite (19h–7h)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Horário</label>
                      <input type="text" placeholder="ex: 08:00" value={formItem.horario} onChange={e => setFormItem(p => ({ ...p, horario: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Seção / Momento do turno</label>
                    <input type="text" placeholder="ex: Banho, Almoço, Início do turno" value={formItem.secao} onChange={e => setFormItem(p => ({ ...p, secao: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Descrição do item</label>
                    <textarea rows={3} placeholder="Descreva a tarefa ou cuidado a ser realizado..." value={formItem.descricao} onChange={e => setFormItem(p => ({ ...p, descricao: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Responsável</label>
                    <select value={formItem.responsavel} onChange={e => setFormItem(p => ({ ...p, responsavel: e.target.value as typeof formItem.responsavel }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                      <option value="tecnico">Técnico de enfermagem</option>
                      <option value="enfermeiro">Enfermeiro</option>
                      <option value="fisioterapeuta">Fisioterapeuta</option>
                      <option value="paciente">Minha participação (paciente)</option>
                      <option value="urgencia">Urgência</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setModalAberto(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={salvarItem} className="flex-1 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors">
                    {itemEditandoId ? 'Salvar alterações' : 'Adicionar item'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default RotinaCuidados;
