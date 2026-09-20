import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ClipboardList, CheckSquare, History, Plus, Edit2, Trash2, Save,
  Sun, Moon, AlertTriangle, User, Stethoscope, ChevronDown,
  ChevronUp, Clock, X, RefreshCw, Heart, Activity, ScrollText,
  Phone, UserPlus, BadgeCheck, Trophy, Crown, Star, Zap, Gift, Sparkles, Flame, Flag, GripVertical,
  MessageSquare
} from 'lucide-react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, setDoc, query, where, orderBy, writeBatch
} from 'firebase/firestore';

const sortItens = (arr: RotinaItem[]) =>
  [...arr].sort((a, b) => a.turno.localeCompare(b.turno) || a.ordem - b.ordem);
import { db } from '../config/firebase';
import { Dialog, Transition } from '@headlessui/react';
import { RotinaItem, RotinaExecucao, ItemExecucao, Tecnico } from '../interface/interface';
import { useConfirm } from '../components/ConfirmProvider';
import { useAuditoria } from '../config/auditoria';
import { useAuth } from '../config/auth/authContext';
import { formatarDataHoraBR, formatarDataBR, paraISO } from '../utils/datas';
import { normalizarNome } from '../utils/texto';

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

// Data local no formato YYYY-MM-DD. NÃO usar toISOString() aqui: ela converte
// para UTC e, no fuso do Brasil (UTC-3), a partir das 21h a data "pula" para o
// dia seguinte — o que faria o plantão da noite registrar o checklist no dia errado.
const hoje = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};

const formatarData = (data: string) => {
  const [y, m, d] = data.split('-');
  return `${d}/${m}/${y}`;
};

const formatarTurnoLabel = (turno: string) => {
  return TURNO_CONFIG[turno as keyof typeof TURNO_CONFIG]?.label ?? turno;
};

// ── Gamificação ─────────────────────────────────────────────────────────────

interface PontoExtra {
  id: string;
  tecnico: string;
  pontos: number;
  motivo: string;
  dadoPor: string;
  criadoEm: string;
}

// Avaliação de "quem executou melhor" cada tarefa da rotina (1º/2º/3º).
interface AvaliacaoTarefa {
  primeiro?: string;
  segundo?: string;
  terceiro?: string;
  atualizadoEm?: string;
}

interface RankingSnapshot {
  nome: string;
  total: number;
  pontosRotina: number;
  pontosExtras: number;
  pontosTarefa: number;
  plantoes: number;
}

interface Competicao {
  id: string;
  inicio: string | null;     // ISO (null = placar acumulado, sem início formal)
  fim?: string | null;       // ISO quando encerrada
  status: 'ativa' | 'encerrada';
  vencedor?: string | null;
  ranking?: RankingSnapshot[];
}

// Pontos por % de itens concluídos no plantão.
const pontosPorPercentual = (pct: number): number => {
  if (pct >= 100) return 6;
  if (pct >= 90) return 5;
  if (pct >= 80) return 4;
  if (pct >= 70) return 3;
  if (pct >= 60) return 2;
  if (pct >= 50) return 1;
  return 0;
};

const NIVEIS = [
  { min: 0, titulo: 'Novato', icon: Star, cor: 'from-slate-500 to-slate-600' },
  { min: 10, titulo: 'Bronze', icon: Flame, cor: 'from-amber-600 to-orange-700' },
  { min: 30, titulo: 'Prata', icon: Zap, cor: 'from-slate-300 to-slate-400' },
  { min: 60, titulo: 'Ouro', icon: Crown, cor: 'from-yellow-400 to-amber-500' },
  { min: 100, titulo: 'Lendário', icon: Trophy, cor: 'from-fuchsia-500 to-purple-600' },
];

const nivelDe = (total: number) => {
  let i = 0;
  for (let k = 0; k < NIVEIS.length; k++) if (total >= NIVEIS[k].min) i = k;
  const atual = NIVEIS[i];
  const prox = NIVEIS[i + 1];
  const pct = prox ? Math.round(((total - atual.min) / (prox.min - atual.min)) * 100) : 100;
  return { ...atual, prox, pct, restante: prox ? prox.min - total : 0 };
};

// ── Component ─────────────────────────────────────────────────────────────────

const RotinaCuidados: React.FC = () => {
  const { confirmar } = useConfirm();
  const { registrar } = useAuditoria();
  const { temPapel, perfil } = useAuth();
  // Quem chega pelo card de observação no Dashboard já cai na aba Histórico.
  const abaInicial = (useLocation().state as { aba?: string } | null)?.aba;
  const [abaAtiva, setAbaAtiva] = useState<'rotina' | 'checklist' | 'historico' | 'observacoes' | 'tecnicos' | 'gamificacao'>(
    abaInicial === 'historico' || abaInicial === 'observacoes' ? abaInicial : 'rotina'
  );

  // Gamificação
  const [pontosExtras, setPontosExtras] = useState<PontoExtra[]>([]);
  const [carregandoPontos, setCarregandoPontos] = useState(false);
  const [modalPontosAberto, setModalPontosAberto] = useState(false);
  const [salvandoPontos, setSalvandoPontos] = useState(false);
  const [formPontos, setFormPontos] = useState({ tecnico: '', pontos: 3, motivo: '' });

  // Filtro do histórico por técnico
  const [filtroTecnicoHist, setFiltroTecnicoHist] = useState<string>('todos');

  // Filtro da aba Observações por técnico (independente do filtro do histórico)
  const [filtroTecnicoObs, setFiltroTecnicoObs] = useState<string>('todos');

  // Placar: sub-abas e avaliação por tarefa
  const [abaPlacar, setAbaPlacar] = useState<'ranking' | 'avaliacao'>('ranking');
  const [avaliacoes, setAvaliacoes] = useState<Record<string, AvaliacaoTarefa>>({});

  // Competições (temporadas)
  const [competicaoAtiva, setCompeticaoAtiva] = useState<Competicao | null>(null);
  const [ultimaCompeticao, setUltimaCompeticao] = useState<Competicao | null>(null);
  const [competicoesEncerradas, setCompeticoesEncerradas] = useState<Competicao[]>([]);
  const [competicaoExpandida, setCompeticaoExpandida] = useState<string | null>(null);
  const [processandoComp, setProcessandoComp] = useState(false);

  // Técnicos de plantão
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [carregandoTecnicos, setCarregandoTecnicos] = useState(true);
  const [modalTecnicoAberto, setModalTecnicoAberto] = useState(false);
  const [salvandoTecnico, setSalvandoTecnico] = useState(false);
  const [tecnicoEditandoId, setTecnicoEditandoId] = useState<string | null>(null);
  const [formTecnico, setFormTecnico] = useState<Omit<Tecnico, 'id'>>({
    nome: '',
    telefone: '',
    registro: '',
    turnoPreferencial: 'ambos',
    ativo: true,
  });
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
  // Drag & drop de reordenação do checklist
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragSecao, setDragSecao] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
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
        // Pré-seleciona o técnico quando há exatamente um dedicado a este turno
        // (preferência estrita, não "ambos"), agilizando o registro no plantão.
        const dedicados = tecnicos.filter(t => t.ativo && t.turnoPreferencial === turno);
        if (dedicados.length === 1) setAuxiliarNome(dedicados[0].nome);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ── CRUD de técnicos de plantão ───────────────────────────────────────────
  const carregarTecnicos = async () => {
    setCarregandoTecnicos(true);
    try {
      const snap = await getDocs(collection(db, 'tecnicos'));
      const dados = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<Tecnico, 'id'>) }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setTecnicos(dados);
    } catch (err) {
      console.error('Erro ao carregar técnicos:', err);
    } finally {
      setCarregandoTecnicos(false);
    }
  };

  const abrirNovoTecnico = () => {
    setTecnicoEditandoId(null);
    setFormTecnico({ nome: '', telefone: '', registro: '', turnoPreferencial: 'ambos', ativo: true });
    setModalTecnicoAberto(true);
  };

  const abrirEdicaoTecnico = (t: Tecnico) => {
    setTecnicoEditandoId(t.id);
    setFormTecnico({
      nome: t.nome,
      telefone: t.telefone ?? '',
      registro: t.registro ?? '',
      turnoPreferencial: t.turnoPreferencial ?? 'ambos',
      ativo: t.ativo,
    });
    setModalTecnicoAberto(true);
  };

  const salvarTecnico = async () => {
    if (!formTecnico.nome.trim()) { mostrarFeedback('erro', 'Informe o nome do técnico.'); return; }
    setSalvandoTecnico(true);
    try {
      if (tecnicoEditandoId) {
        await updateDoc(doc(db, 'tecnicos', tecnicoEditandoId), { ...formTecnico, nome: formTecnico.nome.trim() });
        registrar('editar', 'tecnico', tecnicoEditandoId, formTecnico.nome.trim());
      } else {
        const ref = await addDoc(collection(db, 'tecnicos'), { ...formTecnico, nome: formTecnico.nome.trim() });
        registrar('criar', 'tecnico', ref.id, formTecnico.nome.trim());
      }
      setModalTecnicoAberto(false);
      await carregarTecnicos();
      mostrarFeedback('ok', tecnicoEditandoId ? 'Técnico atualizado.' : 'Técnico cadastrado.');
    } catch (err) {
      console.error('Erro ao salvar técnico:', err);
      mostrarFeedback('erro', 'Erro ao salvar técnico.');
    } finally {
      setSalvandoTecnico(false);
    }
  };

  const excluirTecnico = async (t: Tecnico) => {
    const ok = await confirmar({
      titulo: 'Excluir técnico',
      mensagem: `Excluir ${t.nome} da lista de técnicos? Os plantões já registrados com esse nome não são afetados.`,
      textoConfirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'tecnicos', t.id));
      registrar('excluir', 'tecnico', t.id, t.nome);
      await carregarTecnicos();
      mostrarFeedback('ok', 'Técnico removido.');
    } catch (err) {
      console.error('Erro ao excluir técnico:', err);
      mostrarFeedback('erro', 'Erro ao excluir técnico.');
    }
  };

  const tecnicosAtivos = tecnicos.filter(t => t.ativo);

  useEffect(() => { carregarItens(); carregarTecnicos(); }, []);

  const carregarPontosExtras = async () => {
    setCarregandoPontos(true);
    try {
      const snap = await getDocs(collection(db, 'pontos-extras'));
      setPontosExtras(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PontoExtra, 'id'>) })));
    } catch (err) {
      console.error('Erro ao carregar pontos extras:', err);
    } finally {
      setCarregandoPontos(false);
    }
  };

  const carregarAvaliacoes = async () => {
    try {
      const snap = await getDocs(collection(db, 'avaliacoes-tarefa'));
      const map: Record<string, AvaliacaoTarefa> = {};
      snap.docs.forEach(d => { map[d.id] = d.data() as AvaliacaoTarefa; });
      setAvaliacoes(map);
    } catch (err) {
      console.error('Erro ao carregar avaliações por tarefa:', err);
    }
  };

  const carregarCompeticao = async () => {
    try {
      const snap = await getDocs(collection(db, 'competicoes'));
      const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Competicao, 'id'>) }));
      setCompeticaoAtiva(docs.find(c => c.status === 'ativa') ?? null);
      const encerradas = docs.filter(c => c.status === 'encerrada').sort((a, b) => (b.fim ?? '').localeCompare(a.fim ?? ''));
      setUltimaCompeticao(encerradas[0] ?? null);
      setCompeticoesEncerradas(encerradas);
    } catch (err) {
      console.error('Erro ao carregar competição:', err);
    }
  };

  useEffect(() => {
    if (abaAtiva === 'historico' || abaAtiva === 'observacoes') carregarHistorico();
    if (abaAtiva === 'gamificacao') { carregarHistorico(); carregarPontosExtras(); carregarAvaliacoes(); carregarCompeticao(); }
  }, [abaAtiva]);

  // Início da competição ativa (null = conta tudo / sem competição em andamento).
  const inicioComp = competicaoAtiva?.inicio ?? null;
  const noPeriodoComp = (iso?: string) => !inicioComp || (!!iso && iso >= inicioComp);

  // Ranking dos técnicos: pontos de rotina (por % do plantão) + pontos extras.
  const ranking = useMemo(() => {
    // Só conta eventos ocorridos dentro da competição ativa (ou tudo se não houver).
    const inicio = competicaoAtiva?.inicio ?? null;
    const noPeriodo = (iso?: string) => !inicio || (!!iso && iso >= inicio);

    const mapa: Record<string, { nome: string; pontosRotina: number; pontosExtras: number; pontosTarefa: number; plantoes: number }> = {};
    const garantir = (nome?: string) => {
      if (!nome) return null;
      if (!mapa[nome]) mapa[nome] = { nome, pontosRotina: 0, pontosExtras: 0, pontosTarefa: 0, plantoes: 0 };
      return mapa[nome];
    };
    tecnicos.forEach(t => { if (t.ativo) garantir(t.nome); });
    execucoes.forEach(ex => {
      if (!noPeriodo(ex.criadoEm)) return;
      const total = ex.itens.length;
      const concl = ex.itens.filter(i => i.concluido).length;
      const pct = total > 0 ? Math.round((concl / total) * 100) : 0;
      const r = garantir(ex.auxiliar);
      if (r) { r.pontosRotina += pontosPorPercentual(pct); r.plantoes += 1; }
    });
    pontosExtras.forEach(p => {
      if (!noPeriodo(p.criadoEm)) return;
      const r = garantir(p.tecnico);
      if (r) r.pontosExtras += Number(p.pontos) || 0;
    });
    // Cada tarefa avaliada (na competição atual) dá 1 ponto a quem ficou em 1º lugar.
    Object.values(avaliacoes).forEach(av => {
      if (!noPeriodo(av.atualizadoEm)) return;
      const r = garantir(av.primeiro);
      if (r) r.pontosTarefa += 1;
    });
    return Object.values(mapa)
      .map(r => ({ ...r, total: r.pontosRotina + r.pontosExtras + r.pontosTarefa }))
      .sort((a, b) => b.total - a.total || b.plantoes - a.plantoes || a.nome.localeCompare(b.nome));
  }, [execucoes, pontosExtras, tecnicos, avaliacoes, competicaoAtiva]);

  // Disponibilidade do serviço: % de turnos (2/dia) com técnica presente.
  // "Presente" = existe registro de checklist para aquela data+turno. Sem registro = falta.
  // Só contamos turnos JÁ ENCERRADOS (manhã termina 19h; noite termina 7h do dia seguinte),
  // para nunca penalizar um turno em andamento ou futuro.
  const disponibilidade = useMemo(() => {
    const cobertosSet = new Set(execucoes.map(e => `${paraISO(e.data)}|${e.turno}`));
    const agora = new Date();
    const calc = (dias: number) => {
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      inicio.setDate(inicio.getDate() - (dias - 1));
      let esperados = 0;
      let cobertos = 0;
      const d = new Date(inicio);
      while (d <= agora) {
        const dataStr = paraISO(d);
        const fimManha = new Date(d); fimManha.setHours(19, 0, 0, 0);
        const fimNoite = new Date(d); fimNoite.setDate(fimNoite.getDate() + 1); fimNoite.setHours(7, 0, 0, 0);
        if (fimManha <= agora) { esperados++; if (cobertosSet.has(`${dataStr}|manha`)) cobertos++; }
        if (fimNoite <= agora) { esperados++; if (cobertosSet.has(`${dataStr}|noite`)) cobertos++; }
        d.setDate(d.getDate() + 1);
      }
      return { cobertos, esperados, pct: esperados > 0 ? Math.round((cobertos / esperados) * 100) : null };
    };
    return { semanal: calc(7), mensal: calc(30), anual: calc(365) };
  }, [execucoes]);

  const abrirModalPontos = () => {
    setFormPontos({ tecnico: '', pontos: 3, motivo: '' });
    setModalPontosAberto(true);
  };

  // Define/atualiza a colocação (1º/2º/3º) de uma tarefa e persiste.
  const definirAvaliacao = async (item: RotinaItem, posicao: 'primeiro' | 'segundo' | 'terceiro', nome: string) => {
    const agoraIso = new Date().toISOString();
    const atual = avaliacoes[item.id] ?? {};
    const nova: AvaliacaoTarefa = { ...atual, [posicao]: nome || undefined, atualizadoEm: agoraIso };
    setAvaliacoes(prev => ({ ...prev, [item.id]: nova })); // otimista
    try {
      await setDoc(doc(db, 'avaliacoes-tarefa', item.id), {
        ...nova,
        rotinaItemId: item.id,
        descricao: item.descricao,
        turno: item.turno,
        atualizadoEm: agoraIso,
      }, { merge: true });
      registrar('editar', 'avaliacao-tarefa', item.id, `${posicao}: ${nome || '—'} · ${item.descricao.slice(0, 40)}`);
    } catch (err) {
      console.error('Erro ao salvar avaliação:', err);
      mostrarFeedback('erro', 'Erro ao salvar a avaliação.');
      carregarAvaliacoes(); // reverte para o estado do servidor
    }
  };

  const salvarPontosExtras = async () => {
    const pts = Number(formPontos.pontos);
    if (!formPontos.tecnico) { mostrarFeedback('erro', 'Selecione o técnico.'); return; }
    if (!pts || pts <= 0) { mostrarFeedback('erro', 'Informe uma pontuação maior que zero.'); return; }
    if (!formPontos.motivo.trim()) { mostrarFeedback('erro', 'Descreva o motivo dos pontos extras.'); return; }
    setSalvandoPontos(true);
    try {
      const ref = await addDoc(collection(db, 'pontos-extras'), {
        tecnico: formPontos.tecnico,
        pontos: pts,
        motivo: formPontos.motivo.trim(),
        dadoPor: perfil?.nome ?? 'admin',
        criadoEm: new Date().toISOString(),
      });
      registrar('criar', 'ponto-extra', ref.id, `+${pts} p/ ${formPontos.tecnico}: ${formPontos.motivo.trim()}`);
      setModalPontosAberto(false);
      await carregarPontosExtras();
      mostrarFeedback('ok', `+${pts} pontos para ${formPontos.tecnico}!`);
    } catch (err) {
      console.error('Erro ao dar pontos:', err);
      mostrarFeedback('erro', 'Erro ao registrar os pontos.');
    } finally {
      setSalvandoPontos(false);
    }
  };

  const iniciarCompeticao = async () => {
    const ok = await confirmar({
      titulo: 'Iniciar nova competição',
      mensagem: 'Começar uma nova competição? A pontuação recomeça do zero a partir de agora — o resultado anterior continua salvo no histórico.',
      textoConfirmar: 'Iniciar',
    });
    if (!ok) return;
    setProcessandoComp(true);
    try {
      const agoraIso = new Date().toISOString();
      const ref = await addDoc(collection(db, 'competicoes'), {
        inicio: agoraIso,
        fim: null,
        status: 'ativa',
        criadoPor: perfil?.nome ?? 'admin',
        criadoEm: agoraIso,
      });
      registrar('criar', 'competicao', ref.id, 'Competição iniciada');
      await carregarCompeticao();
      mostrarFeedback('ok', 'Nova competição iniciada! 🏁');
    } catch (err) {
      console.error('Erro ao iniciar competição:', err);
      mostrarFeedback('erro', 'Erro ao iniciar a competição.');
    } finally {
      setProcessandoComp(false);
    }
  };

  const encerrarCompeticao = async () => {
    const vencedor = ranking[0]?.nome ?? null;
    // Sem competição ativa = estamos encerrando o placar acumulado (pré-existente).
    const encerrandoPlacarInicial = !competicaoAtiva;
    const ok = await confirmar({
      titulo: encerrandoPlacarInicial ? 'Encerrar placar atual' : 'Encerrar competição',
      mensagem: encerrandoPlacarInicial
        ? `Salvar a pontuação acumulada até agora como a primeira competição encerrada? 🥇 1º lugar: ${vencedor ?? '—'}. Depois você poderá iniciar uma nova competição do zero.`
        : `Encerrar a competição atual e salvar o resultado? 🥇 1º lugar: ${vencedor ?? '—'}. A competição ficará pausada até você iniciar uma nova.`,
      textoConfirmar: 'Encerrar e salvar',
    });
    if (!ok) return;
    setProcessandoComp(true);
    try {
      const snapshot: RankingSnapshot[] = ranking.map(r => ({
        nome: r.nome, total: r.total, pontosRotina: r.pontosRotina,
        pontosExtras: r.pontosExtras, pontosTarefa: r.pontosTarefa, plantoes: r.plantoes,
      }));
      const fimIso = new Date().toISOString();
      if (competicaoAtiva) {
        await updateDoc(doc(db, 'competicoes', competicaoAtiva.id), {
          status: 'encerrada', fim: fimIso, vencedor, ranking: snapshot,
        });
        registrar('editar', 'competicao', competicaoAtiva.id, `Encerrada · 1º ${vencedor ?? '—'}`);
      } else {
        // Placar acumulado, sem documento de competição: cria um já encerrado.
        const ref = await addDoc(collection(db, 'competicoes'), {
          inicio: null, fim: fimIso, status: 'encerrada', vencedor, ranking: snapshot,
          criadoPor: perfil?.nome ?? 'admin', criadoEm: fimIso,
        });
        registrar('criar', 'competicao', ref.id, `Placar inicial encerrado · 1º ${vencedor ?? '—'}`);
      }
      await carregarCompeticao();
      mostrarFeedback('ok', 'Placar encerrado e resultado salvo! 🏆');
    } catch (err) {
      console.error('Erro ao encerrar competição:', err);
      mostrarFeedback('erro', 'Erro ao encerrar a competição.');
    } finally {
      setProcessandoComp(false);
    }
  };

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
    const ok = await confirmar({
      titulo: 'Excluir item da rotina',
      mensagem: 'Tem certeza que deseja excluir este item da rotina?',
      textoConfirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
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

  // Reordena um item dentro da seção (arrastar e soltar) e persiste o campo `ordem`.
  const reordenarItem = async (turno: 'manha' | 'noite', secao: string, fromId: string, toId: string) => {
    if (fromId === toId) return;
    const secoes = itensPorTurnoSecao(turno);
    const lista = [...(secoes[secao] || [])];
    const fromIdx = lista.findIndex(i => i.id === fromId);
    const toIdx = lista.findIndex(i => i.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [movido] = lista.splice(fromIdx, 1);
    lista.splice(toIdx, 0, movido);
    secoes[secao] = lista;

    // Reconstrói a lista plana do turno na ordem das seções e reatribui `ordem`.
    const flat = Object.values(secoes).flat();
    const novaOrdem = new Map(flat.map((it, idx) => [it.id, idx + 1]));

    // Atualiza a tela imediatamente (otimista).
    setItens(prev => sortItens(prev.map(it => (novaOrdem.has(it.id) ? { ...it, ordem: novaOrdem.get(it.id)! } : it))));

    try {
      const batch = writeBatch(db);
      flat.forEach((it, idx) => batch.update(doc(db, 'rotina-items', it.id), { ordem: idx + 1 }));
      await batch.commit();
      registrar('editar', 'rotina-item', movido.id, `Reordenado em "${secao}"`);
    } catch (err) {
      console.error('Erro ao reordenar:', err);
      mostrarFeedback('erro', 'Erro ao salvar a nova ordem.');
      carregarItens();
    }
  };

  const salvarChecklist = async () => {
    if (!auxiliarNome.trim()) { mostrarFeedback('erro', 'Informe o nome do técnico antes de salvar.'); return; }
    setSalvando(true);
    try {
      const itensTurno = itens.filter(i => i.turno === turnoChecklist && i.ativo);
      const itensSalvos: ItemExecucao[] = itensTurno.map(item => {
        const check = checkMap[item.id];
        const registro: ItemExecucao = {
          rotinaItemId: item.id,
          concluido: check?.concluido ?? false,
          observacao: check?.observacao ?? '',
        };
        // O Firestore rejeita `undefined`: só inclui horarioConcluido quando existe.
        if (check?.horarioConcluido) registro.horarioConcluido = check.horarioConcluido;
        return registro;
      });

      const agora = new Date().toISOString();
      const payload = {
        data: dataChecklist,
        turno: turnoChecklist,
        auxiliar: auxiliarNome,
        itens: itensSalvos,
        observacaoGeral: obsGeral,
        atualizadoEm: agora,
      };

      const resumoAud = `${formatarTurnoLabel(turnoChecklist)} · ${formatarData(dataChecklist)}`;
      if (execucaoAtualId) {
        await updateDoc(doc(db, 'rotina-execucoes', execucaoAtualId), payload);
        registrar('editar', 'rotina-execucao', execucaoAtualId, resumoAud);
      } else {
        const ref = await addDoc(collection(db, 'rotina-execucoes'), { ...payload, criadoEm: agora });
        setExecucaoAtualId(ref.id);
        registrar('criar', 'rotina-execucao', ref.id, resumoAud);
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

  // Criar, editar, excluir e reordenar itens da rotina é exclusivo do admin.
  // Os demais papéis enxergam a rotina apenas para consulta.
  const podeEditarRotina = modo === 'paciente' && temPapel(['admin']);

  // Histórico: gestão e família veem todos os plantões e a disponibilidade do
  // serviço. O técnico só enxerga os plantões salvos no próprio nome.
  const historicoCompleto = temPapel(['admin', 'familia', 'enfermeiro', 'medico']);

  const execucoesVisiveis = useMemo(() => {
    if (historicoCompleto) return execucoes;
    const meuNome = normalizarNome(perfil?.nome);
    return meuNome ? execucoes.filter(e => normalizarNome(e.auxiliar) === meuNome) : [];
  }, [execucoes, historicoCompleto, perfil?.nome]);

  // Todos os registros de observação já salvos: a observação geral do plantão e
  // as observações item a item, com o item da rotina resolvido pelo id.
  const observacoesRegistradas = useMemo(() => {
    return execucoesVisiveis
      .map(exec => {
        const geral = (exec.observacaoGeral ?? '').trim();
        const porItem = (exec.itens ?? [])
          .filter(i => (i.observacao ?? '').trim())
          .map(i => {
            const item = itens.find(it => it.id === i.rotinaItemId);
            return {
              rotinaItemId: i.rotinaItemId,
              horario: item?.horario ?? '',
              descricao: item?.descricao ?? 'Item que não está mais na rotina',
              concluido: i.concluido,
              texto: (i.observacao ?? '').trim(),
            };
          })
          .sort((a, b) => a.horario.localeCompare(b.horario));
        return { exec, geral, porItem };
      })
      .filter(o => o.geral || o.porItem.length > 0);
  }, [execucoesVisiveis, itens]);

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
          { id: 'tecnicos', label: 'Técnicos', icon: Stethoscope },
          { id: 'gamificacao', label: 'Placar', icon: Trophy },
          { id: 'observacoes', label: 'Observações', icon: MessageSquare },
          { id: 'historico', label: 'Histórico', icon: History },
        ].filter(tab => {
          // Checklist e Técnicos: só admin. Placar: admin e família.
          if (['checklist', 'tecnicos'].includes(tab.id)) return temPapel(['admin']);
          if (tab.id === 'gamificacao') return temPapel(['admin', 'familia']);
          return true;
        }).map(tab => (
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
                        <div
                          key={item.id}
                          onDragOver={(e) => { if (podeEditarRotina && dragItemId && dragSecao === secao) { e.preventDefault(); setDragOverId(item.id); } }}
                          onDragLeave={() => setDragOverId(prev => (prev === item.id ? null : prev))}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (podeEditarRotina && dragItemId && dragSecao === secao) reordenarItem(turnoAtivo, secao, dragItemId, item.id);
                            setDragItemId(null); setDragSecao(null); setDragOverId(null);
                          }}
                          className={`flex items-start gap-3 px-4 py-3 ${dragOverId === item.id ? 'ring-2 ring-primary-300 ring-inset rounded-lg' : ''} ${dragItemId === item.id ? 'opacity-40' : ''}`}
                        >
                          {podeEditarRotina && (
                            <span
                              draggable
                              onDragStart={() => { setDragItemId(item.id); setDragSecao(secao); }}
                              onDragEnd={() => { setDragItemId(null); setDragSecao(null); setDragOverId(null); }}
                              className="mt-0.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0"
                              title="Arraste para reordenar"
                            >
                              <GripVertical size={16} />
                            </span>
                          )}
                          <span className="text-xs font-mono text-gray-400 mt-0.5 min-w-[38px]">{item.horario}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${resp.color}`}>{resp.label}</span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">{item.descricao}</p>
                          </div>
                          {podeEditarRotina && (
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

              {podeEditarRotina && (
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
      {abaAtiva === 'checklist' && temPapel(['admin']) && (
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
              {tecnicosAtivos.length > 0 ? (
                <select
                  value={auxiliarNome}
                  onChange={e => { setAuxiliarNome(e.target.value); setChecklistSalvo(false); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="">Selecione o técnico</option>
                  {(() => {
                    // Técnicos "deste turno": preferência == turno escolhido ou "ambos".
                    const pref = (t: Tecnico) => t.turnoPreferencial ?? 'ambos';
                    const deste = tecnicosAtivos.filter(t => pref(t) === turnoChecklist || pref(t) === 'ambos');
                    const outros = tecnicosAtivos.filter(t => !(pref(t) === turnoChecklist || pref(t) === 'ambos'));
                    return (
                      <>
                        {deste.length > 0 && (
                          <optgroup label={`Deste turno (${turnoChecklist === 'manha' ? 'Manhã' : 'Noite'})`}>
                            {deste.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                          </optgroup>
                        )}
                        {outros.length > 0 && (
                          <optgroup label="Outros turnos">
                            {outros.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                          </optgroup>
                        )}
                      </>
                    );
                  })()}
                  {/* Mantém nome antigo (de um plantão já registrado) que não está mais na lista */}
                  {auxiliarNome && !tecnicosAtivos.some(t => t.nome === auxiliarNome) && (
                    <option value={auxiliarNome}>{auxiliarNome}</option>
                  )}
                </select>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Nome do técnico"
                    value={auxiliarNome}
                    onChange={e => { setAuxiliarNome(e.target.value); setChecklistSalvo(false); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                  <button
                    type="button"
                    onClick={() => setAbaAtiva('tecnicos')}
                    className="text-xs text-primary-600 hover:text-primary-700 mt-1"
                  >
                    + Cadastrar técnicos na aba Técnicos
                  </button>
                </>
              )}
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
                        <div
                          key={item.id}
                          onDragOver={(e) => { if (dragItemId && dragSecao === secao) { e.preventDefault(); setDragOverId(item.id); } }}
                          onDragLeave={() => setDragOverId(prev => (prev === item.id ? null : prev))}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragItemId && dragSecao === secao) reordenarItem(turnoChecklist, secao, dragItemId, item.id);
                            setDragItemId(null); setDragSecao(null); setDragOverId(null);
                          }}
                          className={`px-4 py-3 transition-colors ${check.concluido ? 'bg-green-50/50' : ''} ${dragOverId === item.id ? 'ring-2 ring-primary-300 ring-inset rounded-lg' : ''} ${dragItemId === item.id ? 'opacity-40' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              draggable
                              onDragStart={() => { setDragItemId(item.id); setDragSecao(secao); }}
                              onDragEnd={() => { setDragItemId(null); setDragSecao(null); setDragOverId(null); }}
                              className="mt-0.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0"
                              title="Arraste para reordenar"
                            >
                              <GripVertical size={16} />
                            </span>
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

      {/* ── ABA: TÉCNICOS ───────────────────────────────────────────────── */}
      {abaAtiva === 'tecnicos' && temPapel(['admin']) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Técnicos que assumem os plantões. Aparecem como opção ao preencher o checklist.</p>
            <button
              onClick={abrirNovoTecnico}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors shrink-0"
            >
              <UserPlus size={16} /> Novo técnico
            </button>
          </div>

          {carregandoTecnicos ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> Carregando técnicos...
            </div>
          ) : tecnicos.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
              <Stethoscope size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum técnico cadastrado ainda.</p>
              <p className="text-xs mt-1">Cadastre os técnicos para selecioná-los no checklist do plantão.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {tecnicos.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`p-2 rounded-lg ${t.ativo ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    <Stethoscope size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{t.nome}</span>
                      {!t.ativo && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inativo</span>}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                        {t.turnoPreferencial === 'manha' ? 'Manhã' : t.turnoPreferencial === 'noite' ? 'Noite' : 'Ambos'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-0.5 text-xs text-gray-500">
                      {t.telefone && <span className="flex items-center gap-1"><Phone size={11} /> {t.telefone}</span>}
                      {t.registro && <span className="flex items-center gap-1"><BadgeCheck size={11} /> {t.registro}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => abrirEdicaoTecnico(t)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => excluirTecnico(t)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ABA: GAMIFICAÇÃO ────────────────────────────────────────────── */}
      {abaAtiva === 'gamificacao' && temPapel(['admin', 'familia']) && (
        <div>
          {/* Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 p-6 text-white mb-5 shadow-lg">
            <div className="absolute -right-6 -top-8 opacity-20 pointer-events-none"><Trophy size={130} /></div>
            <div className="relative flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles size={20} /> Placar dos Técnicos</h2>
                <p className="text-sm text-white/80 mt-1 max-w-md">
                  Cada plantão vale pontos conforme a % de itens da rotina concluídos. Quanto mais completo o checklist, mais pontos!
                </p>
              </div>
              {temPapel(['admin']) && competicaoAtiva && (
                <button
                  onClick={abrirModalPontos}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur text-sm font-semibold border border-white/20 transition-colors shrink-0"
                >
                  <Gift size={16} /> Dar pontos extras
                </button>
              )}
            </div>
            <div className="relative flex flex-wrap gap-2 mt-4">
              {[['100%', '6'], ['90–99%', '5'], ['80–89%', '4'], ['70–79%', '3'], ['60–69%', '2'], ['50–59%', '1']].map(([faixa, pts]) => (
                <span key={faixa} className="text-xs bg-white/15 border border-white/20 rounded-full px-2.5 py-1 font-medium">
                  {faixa} = {pts} pts
                </span>
              ))}
            </div>
          </div>

          {/* Sub-abas do Placar */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5">
            {[
              { id: 'ranking', label: 'Ranking', icon: Trophy },
              { id: 'avaliacao', label: 'Avaliação por tarefa', icon: Star },
            ].filter(st => st.id !== 'avaliacao' || temPapel(['admin'])).map(st => (
              <button
                key={st.id}
                onClick={() => setAbaPlacar(st.id as typeof abaPlacar)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium flex-1 justify-center transition-all ${abaPlacar === st.id ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <st.icon size={15} />
                <span className="hidden sm:inline">{st.label}</span>
              </button>
            ))}
          </div>

          {abaPlacar === 'ranking' && (
          <div>
          {/* Controle da competição */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
            {competicaoAtiva ? (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium">Competição em andamento</span>
                <span className="text-gray-400">desde {formatarDataBR(competicaoAtiva.inicio)}</span>
              </div>
            ) : ultimaCompeticao ? (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-2 h-2 rounded-full bg-gray-300" />
                <span className="font-medium">Competição pausada</span>
                <span className="text-gray-400">última encerrada em {formatarDataBR(ultimaCompeticao.fim)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-2 h-2 rounded-full bg-gray-300" />
                <span>Nenhuma competição em andamento</span>
              </div>
            )}

            {temPapel(['admin']) && (
              competicaoAtiva ? (
                <button onClick={encerrarCompeticao} disabled={processandoComp}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-sm font-semibold transition-colors disabled:opacity-50">
                  {processandoComp ? <RefreshCw size={15} className="animate-spin" /> : <Flag size={15} />} Encerrar competição
                </button>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Placar acumulado de antes das competições: permite encerrá-lo e salvar */}
                  {!ultimaCompeticao && ranking.some(r => r.total > 0) && (
                    <button onClick={encerrarCompeticao} disabled={processandoComp}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-sm font-semibold transition-colors disabled:opacity-50">
                      {processandoComp ? <RefreshCw size={15} className="animate-spin" /> : <Flag size={15} />} Encerrar placar atual
                    </button>
                  )}
                  <button onClick={iniciarCompeticao} disabled={processandoComp}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                    {processandoComp ? <RefreshCw size={15} className="animate-spin" /> : <Flag size={15} />} {ultimaCompeticao ? 'Iniciar nova competição' : 'Iniciar competição'}
                  </button>
                </div>
              )
            )}
          </div>

          {/* Pausada (sem competição ativa mas com resultado salvo) → mostra o resultado final */}
          {!competicaoAtiva && ultimaCompeticao ? (
            <div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 p-5 text-white mb-4 flex items-center gap-3">
                <Trophy size={28} />
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/80 font-semibold">Resultado da última competição</p>
                  <p className="text-lg font-bold">🏆 {ultimaCompeticao.vencedor ?? 'Sem vencedor'}</p>
                </div>
              </div>
              <div className="space-y-3">
                {(ultimaCompeticao.ranking ?? []).map((r, idx) => {
                  const medalha = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                  return (
                    <div key={r.nome} className="rounded-2xl border border-gray-100 bg-white p-4 flex items-center gap-4">
                      <div className="w-10 text-center shrink-0">
                        {medalha ? <span className="text-2xl">{medalha}</span> : <span className="text-lg font-bold text-gray-400">{idx + 1}º</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-gray-800">{r.nome}</span>
                        <p className="text-[11px] text-gray-400 mt-0.5">{r.plantoes} plantão(ões) · {r.pontosRotina} de rotina{r.pontosTarefa > 0 ? ` · +${r.pontosTarefa} tarefas` : ''}{r.pontosExtras > 0 ? ` · +${r.pontosExtras} extras` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-extrabold text-primary-600">{r.total}</div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-400">pontos</div>
                      </div>
                    </div>
                  );
                })}
                {(ultimaCompeticao.ranking ?? []).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">A competição foi encerrada sem pontuação registrada.</p>
                )}
              </div>
            </div>
          ) : (
          <>
          {/* Ranking */}
          {(carregandoExec || carregandoPontos) ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> Carregando placar...
            </div>
          ) : ranking.filter(r => r.total > 0 || r.plantoes > 0).length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
              <Trophy size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Ainda não há pontuação.</p>
              <p className="text-xs mt-1">Os pontos aparecem conforme os checklists de plantão forem salvos.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ranking.map((r, idx) => {
                const nv = nivelDe(r.total);
                const NvIcon = nv.icon;
                const medalha = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                const destaque = idx === 0;
                return (
                  <div
                    key={r.nome}
                    className={`rounded-2xl border p-4 flex items-center gap-4 transition-all ${
                      destaque ? 'bg-gradient-to-r from-slate-900 to-slate-800 border-fuchsia-500/40 text-white shadow-lg' : 'bg-white border-gray-100'
                    }`}
                  >
                    <div className="w-10 text-center shrink-0">
                      {medalha ? (
                        <span className="text-2xl">{medalha}</span>
                      ) : (
                        <span className={`text-lg font-bold ${destaque ? 'text-white/70' : 'text-gray-400'}`}>{idx + 1}º</span>
                      )}
                    </div>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${nv.cor} flex items-center justify-center shrink-0 shadow`}>
                      <NvIcon size={22} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold truncate ${destaque ? 'text-white' : 'text-gray-800'}`}>{r.nome}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold bg-gradient-to-r ${nv.cor} text-white`}>{nv.titulo}</span>
                      </div>
                      <div className="mt-2">
                        <div className={`h-2 rounded-full overflow-hidden ${destaque ? 'bg-white/15' : 'bg-gray-100'}`}>
                          <div className={`h-full bg-gradient-to-r ${nv.cor} transition-all`} style={{ width: `${nv.pct}%` }} />
                        </div>
                        <div className={`flex justify-between text-[11px] mt-1 ${destaque ? 'text-white/60' : 'text-gray-400'}`}>
                          <span>{r.plantoes} plantão(ões) · {r.pontosRotina} de rotina{r.pontosTarefa > 0 ? ` · +${r.pontosTarefa} tarefas` : ''}{r.pontosExtras > 0 ? ` · +${r.pontosExtras} extras` : ''}</span>
                          <span>{nv.prox ? `${nv.restante} p/ ${nv.prox.titulo}` : 'nível máximo'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-2xl font-extrabold leading-none ${destaque ? 'text-fuchsia-300' : 'text-primary-600'}`}>{r.total}</div>
                      <div className={`text-[10px] uppercase tracking-wider ${destaque ? 'text-white/50' : 'text-gray-400'}`}>pontos</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pontos extras recentes */}
          {pontosExtras.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Gift size={13} /> Pontos extras concedidos
              </h3>
              <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                {[...pontosExtras].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 10).map(p => (
                  <div key={p.id} className="px-4 py-2.5 flex items-start gap-3">
                    <span className="text-sm font-bold text-fuchsia-600 shrink-0 mt-0.5">+{p.pontos}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800"><span className="font-medium">{p.tecnico}</span> — {p.motivo}</p>
                      <p className="text-[11px] text-gray-400">por {p.dadoPor} · {formatarDataHoraBR(p.criadoEm)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
          )}

          {/* Histórico de competições anteriores */}
          {competicoesEncerradas.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <History size={13} /> Competições anteriores
              </h3>
              <div className="space-y-2">
                {competicoesEncerradas.map(comp => {
                  const aberto = competicaoExpandida === comp.id;
                  return (
                    <div key={comp.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                      <button
                        onClick={() => setCompeticaoExpandida(aberto ? null : comp.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="p-2 rounded-lg bg-amber-50 text-amber-500"><Trophy size={16} /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">🏆 {comp.vencedor ?? 'Sem vencedor'}</p>
                          <p className="text-[11px] text-gray-400">{formatarDataBR(comp.inicio)} — {formatarDataBR(comp.fim)}</p>
                        </div>
                        {aberto ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                      </button>
                      {aberto && (
                        <div className="border-t border-gray-50 px-4 py-3 space-y-1.5">
                          {(comp.ranking ?? []).length === 0 ? (
                            <p className="text-xs text-gray-400 py-2">Sem pontuação registrada nesta competição.</p>
                          ) : (
                            (comp.ranking ?? []).map((r, idx) => {
                              const medalha = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                              return (
                                <div key={r.nome} className="flex items-center gap-3">
                                  <span className="w-7 text-center shrink-0 text-sm">{medalha ?? <span className="text-xs font-bold text-gray-400">{idx + 1}º</span>}</span>
                                  <span className="flex-1 text-sm text-gray-700 truncate">{r.nome}</span>
                                  <span className="text-sm font-bold text-primary-600 shrink-0">{r.total} pts</span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
          )}

          {abaPlacar === 'avaliacao' && temPapel(['admin']) && (
            <div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
                <p className="text-sm text-gray-600">
                  Para cada tarefa da rotina, indique quem executou melhor:{' '}
                  <span className="font-semibold text-yellow-600">1º</span>,{' '}
                  <span className="font-semibold text-gray-500">2º</span> e{' '}
                  <span className="font-semibold text-amber-700">3º</span>.{' '}
                  <span className="font-medium">Quem fica em 1º ganha 1 ponto no placar.</span>
                </p>
                {!temPapel(['admin']) ? (
                  <p className="text-xs text-amber-600 mt-2">Somente o administrador pode editar as avaliações.</p>
                ) : !competicaoAtiva ? (
                  <p className="text-xs text-amber-600 mt-2">Inicie uma competição (aba Ranking) para avaliar as tarefas e pontuar.</p>
                ) : null}
              </div>

              {tecnicosAtivos.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
                  <Stethoscope size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Cadastre técnicos na aba <span className="font-medium">Técnicos</span> para poder avaliar as tarefas.</p>
                </div>
              ) : itens.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                  <RefreshCw size={20} className="animate-spin mr-2" /> Carregando tarefas...
                </div>
              ) : (
                (['manha', 'noite'] as const).map(turno => {
                  const secoes = itensPorTurnoSecao(turno);
                  const cfg = TURNO_CONFIG[turno];
                  const TurnoIcon = cfg.icon;
                  return (
                    <div key={turno} className="mb-6">
                      <div className={`flex items-center gap-2 mb-3 ${cfg.color}`}>
                        <TurnoIcon size={16} />
                        <h3 className="text-sm font-semibold">{cfg.label}</h3>
                      </div>
                      {Object.entries(secoes).map(([secao, items]) => (
                        <div key={secao} className="mb-4">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{secao}</h4>
                          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
                            {items.map(item => {
                              // Mostra a avaliação apenas se for da competição atual.
                              const av = noPeriodoComp(avaliacoes[item.id]?.atualizadoEm) ? (avaliacoes[item.id] ?? {}) : {};
                              return (
                                <div key={item.id} className="px-4 py-3">
                                  <div className="flex items-start gap-2 mb-2">
                                    <span className="text-xs font-mono text-gray-400 mt-0.5 min-w-[38px]">{item.horario}</span>
                                    <p className="text-sm text-gray-700 flex-1">{item.descricao}</p>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:pl-[46px]">
                                    {([['primeiro', '1º', 'text-yellow-600'], ['segundo', '2º', 'text-gray-500'], ['terceiro', '3º', 'text-amber-700']] as const).map(([pos, label, cor]) => (
                                      <div key={pos} className="flex items-center gap-2">
                                        <span className={`text-xs font-bold w-5 shrink-0 ${cor}`}>{label}</span>
                                        <select
                                          value={av[pos] ?? ''}
                                          disabled={!temPapel(['admin']) || !competicaoAtiva}
                                          onChange={e => definirAvaliacao(item, pos, e.target.value)}
                                          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50 disabled:text-gray-500"
                                        >
                                          <option value="">—</option>
                                          {tecnicosAtivos.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                                        </select>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ABA: OBSERVAÇÕES ────────────────────────────────────────────── */}
      {abaAtiva === 'observacoes' && (
        <div>
          {carregandoExec ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> Carregando observações...
            </div>
          ) : observacoesRegistradas.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {historicoCompleto ? 'Nenhuma observação registrada ainda.' : 'Você ainda não registrou observações.'}
              </p>
              <p className="text-xs mt-1">As observações salvas no checklist do plantão aparecem aqui.</p>
            </div>
          ) : (() => {
            const nomesComObs = Array.from(
              new Set(observacoesRegistradas.map(o => o.exec.auxiliar).filter(Boolean))
            ).sort((a, b) => a.localeCompare(b));
            const lista = filtroTecnicoObs === 'todos'
              ? observacoesRegistradas
              : observacoesRegistradas.filter(o => o.exec.auxiliar === filtroTecnicoObs);
            const totalObs = lista.reduce((soma, o) => soma + (o.geral ? 1 : 0) + o.porItem.length, 0);
            return (
            <div className="space-y-3">
              {/* Filtro por técnico — só faz sentido para quem vê todos os plantões. */}
              <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-2 flex-wrap">
                <MessageSquare size={16} className="text-gray-400" />
                {historicoCompleto ? (
                  <>
                    <label className="text-sm text-gray-600">Técnico:</label>
                    <select
                      value={filtroTecnicoObs}
                      onChange={e => setFiltroTecnicoObs(e.target.value)}
                      className="py-1.5 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
                    >
                      <option value="todos">Todos os técnicos</option>
                      {nomesComObs.map(nome => (
                        <option key={nome} value={nome}>{nome}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <span className="text-sm text-gray-600">Suas observações</span>
                )}
                <span className="text-xs text-gray-400 ml-auto">
                  {totalObs} observação(ões) em {lista.length} plantão(ões)
                </span>
              </div>

              {lista.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
                  <p className="text-sm">Nenhuma observação para este técnico.</p>
                </div>
              ) : (
                lista.map(({ exec, geral, porItem }) => {
                  const cfg = TURNO_CONFIG[exec.turno];
                  const Icon = cfg.icon;
                  return (
                    <div key={exec.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                        <div className={`p-2 rounded-lg ${cfg.bg}`}>
                          <Icon size={16} className={cfg.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-800">{formatarData(exec.data)}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">Técnico: {exec.auxiliar || '—'}</p>
                        </div>
                        {temPapel(['admin']) && (
                          <button
                            onClick={() => {
                              setDataChecklist(exec.data);
                              setTurnoChecklist(exec.turno);
                              setAbaAtiva('checklist');
                            }}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
                          >
                            <Edit2 size={13} /> Abrir checklist
                          </button>
                        )}
                      </div>

                      <div className="px-4 py-3 space-y-3">
                        {geral && (
                          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 mb-1">
                              Observação do plantão
                            </p>
                            <p className="text-sm text-gray-700 whitespace-pre-line">{geral}</p>
                          </div>
                        )}

                        {porItem.map(o => (
                          <div key={o.rotinaItemId} className="flex items-start gap-3">
                            <span className="text-xs font-mono text-gray-400 mt-0.5 min-w-[38px]">{o.horario || '--:--'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500">{o.descricao}</p>
                              <p className="text-sm text-gray-700 whitespace-pre-line mt-0.5">{o.texto}</p>
                            </div>
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${o.concluido ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {o.concluido ? 'Concluído' : 'Não concluído'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            );
          })()}
        </div>
      )}

      {/* ── ABA: HISTÓRICO ──────────────────────────────────────────────── */}
      {abaAtiva === 'historico' && (
        <div>
          {/* Card de disponibilidade do serviço — métrica do serviço inteiro,
              por isso fica só para gestão e família. */}
          {historicoCompleto && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><Activity size={18} /></div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Disponibilidade do serviço</h3>
                <p className="text-xs text-gray-400">% de turnos com técnica presente (registro de checklist). Turno sem registro = falta.</p>
              </div>
            </div>
            {carregandoExec ? (
              <div className="flex items-center justify-center py-6 text-gray-400">
                <RefreshCw size={18} className="animate-spin mr-2" /> Calculando...
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Semanal', sub: '7 dias', dado: disponibilidade.semanal },
                  { label: 'Mensal', sub: '30 dias', dado: disponibilidade.mensal },
                  { label: 'Anual', sub: '365 dias', dado: disponibilidade.anual },
                ].map(({ label, sub, dado }) => {
                  const pct = dado.pct;
                  const cor = pct === null ? 'text-gray-400' : pct >= 90 ? 'text-emerald-600' : pct >= 75 ? 'text-amber-500' : 'text-red-500';
                  const barra = pct === null ? 'bg-gray-200' : pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={label} className="rounded-xl border border-gray-100 p-3 text-center">
                      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">{label}</p>
                      <p className="text-[10px] text-gray-300 -mt-0.5">{sub}</p>
                      <p className={`text-2xl font-extrabold mt-1 ${cor}`}>{pct === null ? '—' : `${pct}%`}</p>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                        <div className={`h-full ${barra} transition-all`} style={{ width: pct === null ? '0%' : `${pct}%` }} />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">{dado.cobertos}/{dado.esperados} turnos</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {carregandoExec ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> Carregando histórico...
            </div>
          ) : execucoesVisiveis.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <History size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{historicoCompleto ? 'Nenhum registro ainda.' : 'Você ainda não tem plantões registrados.'}</p>
              <p className="text-xs mt-1">
                {historicoCompleto
                  ? 'Os check-ins salvos pelo técnico aparecerão aqui.'
                  : 'Os checklists que você salvar aparecerão aqui.'}
              </p>
            </div>
          ) : (() => {
            // Nomes de técnicos presentes no histórico (para o filtro).
            const nomesNoHistorico = Array.from(new Set(execucoesVisiveis.map(e => e.auxiliar).filter(Boolean))).sort((a, b) => a.localeCompare(b));
            const execucoesFiltradas = filtroTecnicoHist === 'todos'
              ? execucoesVisiveis
              : execucoesVisiveis.filter(e => e.auxiliar === filtroTecnicoHist);
            return (
            <div className="space-y-3">
              {/* Filtro por técnico — só faz sentido para quem vê o histórico inteiro. */}
              {historicoCompleto ? (
                <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-2 flex-wrap">
                  <Stethoscope size={16} className="text-gray-400" />
                  <label className="text-sm text-gray-600">Técnico:</label>
                  <select
                    value={filtroTecnicoHist}
                    onChange={e => setFiltroTecnicoHist(e.target.value)}
                    className="py-1.5 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    <option value="todos">Todos os técnicos</option>
                    {nomesNoHistorico.map(nome => (
                      <option key={nome} value={nome}>{nome}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-400 ml-auto">{execucoesFiltradas.length} plantão(ões)</span>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-2 flex-wrap">
                  <Stethoscope size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-600">Seus plantões</span>
                  <span className="text-xs text-gray-400 ml-auto">{execucoesFiltradas.length} plantão(ões)</span>
                </div>
              )}

              {execucoesFiltradas.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
                  <p className="text-sm">Nenhum plantão registrado para este técnico.</p>
                </div>
              ) : (
              execucoesFiltradas.map(exec => {
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
                        {/* Admin pode corrigir um registro de plantão já salvo */}
                        {temPapel(['admin']) && (
                          <div className="flex justify-end mb-4">
                            <button
                              onClick={() => {
                                setDataChecklist(exec.data);
                                setTurnoChecklist(exec.turno);
                                setAbaAtiva('checklist');
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
                            >
                              <Edit2 size={14} /> Editar este registro
                            </button>
                          </div>
                        )}

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
              })
              )}
            </div>
            );
          })()}
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
                    { n: 11, titulo: 'Folga ou falta: garantir a cobertura', desc: 'Ao solicitar folga ou precisar faltar, procure a cobertura primeiro com uma plantonista do mesmo turno. Se ela não puder cobrir, procure uma plantonista de outro turno. O paciente não pode ficar sem cobertura da equipe.', obs: 'Registre a folga na aba Escala — quem vai cobrir confirma por lá, no botão "Fazer cobertura".' },
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

      {/* ── Modal cadastro/edição de técnico ─────────────────────────────── */}
      {modalTecnicoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalTecnicoAberto(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-800">
                {tecnicoEditandoId ? 'Editar técnico' : 'Novo técnico'}
              </h2>
              <button onClick={() => setModalTecnicoAberto(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Nome</label>
                <input
                  type="text" value={formTecnico.nome} placeholder="Ex: Maria Souza"
                  onChange={e => setFormTecnico(p => ({ ...p, nome: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Telefone</label>
                  <input
                    type="text" value={formTecnico.telefone} placeholder="(00) 00000-0000"
                    onChange={e => setFormTecnico(p => ({ ...p, telefone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">COREN</label>
                  <input
                    type="text" value={formTecnico.registro} placeholder="COREN 000000"
                    onChange={e => setFormTecnico(p => ({ ...p, registro: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Turno preferencial</label>
                  <select
                    value={formTecnico.turnoPreferencial}
                    onChange={e => setFormTecnico(p => ({ ...p, turnoPreferencial: e.target.value as Tecnico['turnoPreferencial'] }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    <option value="ambos">Ambos</option>
                    <option value="manha">Manhã (7h–19h)</option>
                    <option value="noite">Noite (19h–7h)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Situação</label>
                  <select
                    value={formTecnico.ativo ? 'ativo' : 'inativo'}
                    onChange={e => setFormTecnico(p => ({ ...p, ativo: e.target.value === 'ativo' }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalTecnicoAberto(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={salvarTecnico} disabled={salvandoTecnico}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {salvandoTecnico ? <RefreshCw size={15} className="animate-spin" /> : (tecnicoEditandoId ? 'Salvar' : 'Cadastrar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal conceder pontos extras (admin) ─────────────────────────── */}
      {modalPontosAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalPontosAberto(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Gift size={18} className="text-fuchsia-600" /> Dar pontos extras
              </h2>
              <button onClick={() => setModalPontosAberto(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Técnico</label>
                <select
                  value={formPontos.tecnico}
                  onChange={e => setFormPontos(p => ({ ...p, tecnico: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="">Selecione o técnico</option>
                  {ranking.map(r => <option key={r.nome} value={r.nome}>{r.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Pontos</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[1, 3, 5, 10].map(v => (
                    <button
                      key={v} type="button"
                      onClick={() => setFormPontos(p => ({ ...p, pontos: v }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                        formPontos.pontos === v ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      +{v}
                    </button>
                  ))}
                  <input
                    type="number" min={1} value={formPontos.pontos}
                    onChange={e => setFormPontos(p => ({ ...p, pontos: Number(e.target.value) }))}
                    className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Motivo <span className="text-red-500">*</span></label>
                <textarea
                  rows={3} value={formPontos.motivo}
                  onChange={e => setFormPontos(p => ({ ...p, motivo: e.target.value }))}
                  placeholder="Ex: assumiu plantão extra, cuidado excepcional com o paciente, organização impecável..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalPontosAberto(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={salvarPontosExtras} disabled={salvandoPontos}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {salvandoPontos ? <RefreshCw size={15} className="animate-spin" /> : <><Gift size={15} /> Conceder</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RotinaCuidados;
