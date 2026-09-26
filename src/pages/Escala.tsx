import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X, Trash2, RefreshCw, Coffee, Sun, Moon, UserPlus, UserX, ArrowLeftRight,
} from 'lucide-react';
import { addDoc, collection, getDocs, setDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Tecnico } from '../interface/interface';
import { useAuth } from '../config/auth/authContext';
import { useFeedback } from '../components/FeedbackProvider';
import { useConfirm } from '../components/ConfirmProvider';
import { useAuditoria } from '../config/auditoria';
import { formatarDataBR } from '../utils/datas';

/**
 * Uma vigência de escala: técnico X cobre o turno Y nos dias pares/ímpares,
 * de `inicio` até `fim`. Trocar a escala NÃO reescreve o passado — encerra a
 * vigência atual (fim = ontem) e abre uma nova a partir de hoje.
 *
 * Registros antigos não têm `tecnicoId` (o id do documento era o do técnico)
 * nem `inicio`/`fim` — esses valem "desde sempre e até hoje", preservando o
 * calendário como ele sempre foi exibido.
 */
interface EscalaItem {
  id: string;
  tecnicoId?: string;
  tecnicoNome: string;
  inicial: string;
  paridade: 'par' | 'impar';
  turno: 'diurno' | 'noturno';
  inicio?: string;      // ISO — vale a partir de (ausente = desde sempre)
  fim?: string | null;  // ISO — vale até, inclusive (ausente/null = em vigor)
}

/** Registros antigos guardavam o id do técnico no próprio id do documento. */
const tecnicoIdDe = (e: EscalaItem) => e.tecnicoId || e.id;

/** A vigência cobre aquela data? */
const vigenteEm = (e: EscalaItem, dataISO: string) =>
  (!e.inicio || dataISO >= e.inicio) && (!e.fim || dataISO <= e.fim);

/**
 * Ausência de um técnico num dia/turno. A coleção continua se chamando `folgas`
 * por compatibilidade com o que já está gravado, mas hoje guarda dois casos:
 *
 * - `folga`: combinada antes, o técnico avisa e procura cobertura.
 * - `falta`: o técnico não compareceu ao plantão.
 *
 * Registros antigos não têm `tipo` — são folgas.
 */
interface Folga {
  tecnicoId: string;
  tecnicoNome: string;
  data: string; // ISO
  turno: 'diurno' | 'noturno';
  tipo?: 'folga' | 'falta';
  /** Só para falta: avisou antes (doença, imprevisto) ou simplesmente não veio. */
  avisou?: boolean;
  motivo?: string;
  cobertoPor?: string;      // tecnicoId de quem cobre
  cobertoPorNome?: string;
}

const ehFalta = (f?: Folga) => f?.tipo === 'falta';
const rotuloAusencia = (f?: Folga) => (ehFalta(f) ? 'Falta' : 'Folga');

/**
 * Troca pontual de plantão entre duas técnicas. Diferente de cobertura, que é
 * de mão única: aqui cada uma assume o plantão da outra.
 *
 * `origem` é quem propôs (cede o plantão dela) e `destino` é quem aceita. No
 * dia/turno da origem quem trabalha é a destino, e no dia/turno da destino
 * quem trabalha é a origem. Dia e turno são livres — não precisam ser da
 * mesma paridade nem do mesmo turno.
 */
interface TrocaPlantao {
  id: string;
  origemTecnicoId: string;
  origemTecnicoNome: string;
  origemData: string; // ISO
  origemTurno: 'diurno' | 'noturno';
  destinoTecnicoId: string;
  destinoTecnicoNome: string;
  destinoData: string; // ISO
  destinoTurno: 'diurno' | 'noturno';
  criadoEm: string;
  criadoPorNome: string;
  observacao?: string;
}

const chaveSlot = (tecnicoId: string, data: string, turno: string) => `${tecnicoId}_${data}_${turno}`;
const rotuloTurno = (t: string) => (t === 'noturno' ? 'Noturno' : 'Diurno');

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CORES = [
  'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700', 'bg-sky-100 text-sky-700', 'bg-cyan-100 text-cyan-700',
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
  const { temPapel, perfil } = useAuth();
  const { notificar } = useFeedback();
  const { confirmar } = useConfirm();
  const { registrar } = useAuditoria();
  const admin = temPapel(['admin']);
  // Registrar (e desfazer) falta é da gestão da casa: admin e família. A técnica
  // não marca o próprio não comparecimento nem o da colega.
  const podeRegistrarFalta = temPapel(['admin', 'familia']);

  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [escala, setEscala] = useState<EscalaItem[]>([]);
  const [folgas, setFolgas] = useState<Record<string, Folga>>({});
  const [trocas, setTrocas] = useState<TrocaPlantao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const hoje = new Date();
  const [refMes, setRefMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  const hojeISO = isoDe(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  // Toda troca de escala fecha a vigência anterior ontem: hoje já é do novo.
  const ontemISO = (() => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - 1);
    return isoDe(d.getFullYear(), d.getMonth(), d.getDate());
  })();

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

  // Registro de falta (não comparecimento) — formulário inline no modal do dia
  const [faltaPara, setFaltaPara] = useState<string | null>(null);
  const [faltaAvisou, setFaltaAvisou] = useState(false);
  const [faltaMotivo, setFaltaMotivo] = useState('');

  // Troca de plantão — formulário inline no modal do dia
  const [trocaPara, setTrocaPara] = useState<string | null>(null);
  const [trocaComId, setTrocaComId] = useState('');
  const [trocaData, setTrocaData] = useState('');
  const [trocaTurno, setTrocaTurno] = useState<'diurno' | 'noturno'>('diurno');
  const [salvandoTroca, setSalvandoTroca] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [ts, es, fs, trs] = await Promise.all([
        getDocs(collection(db, 'tecnicos')),
        getDocs(collection(db, 'escala')),
        getDocs(collection(db, 'folgas')),
        getDocs(collection(db, 'trocas')),
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
      setTrocas(trs.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TrocaPlantao, 'id'>) })));
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

  // Cor por TÉCNICO (e não por registro): quem sai e volta mantém a mesma cor.
  const corPorId = useMemo(() => {
    const m: Record<string, string> = {};
    let i = 0;
    escala.forEach((e) => {
      const tid = tecnicoIdDe(e);
      if (!m[tid]) { m[tid] = CORES[i % CORES.length]; i++; }
    });
    return m;
  }, [escala]);

  /** Vigências em vigor hoje — é o que a legenda e o cadastro mostram. */
  const escalaVigente = useMemo(
    () => escala.filter((e) => vigenteEm(e, hojeISO)),
    [escala, hojeISO]
  );

  /** Vigências já encerradas, da mais recente para a mais antiga. */
  const escalaEncerrada = useMemo(
    () => escala.filter((e) => !!e.fim && e.fim < hojeISO).sort((a, b) => (b.fim ?? '').localeCompare(a.fim ?? '')),
    [escala, hojeISO]
  );

  // ── Trocas ──────────────────────────────────────────────────────────────────
  // Cada troca tira as duas técnicas dos plantões delas e coloca uma no lugar
  // da outra. Duas visões do mesmo dado: quem SAIU de um slot e quem ENTROU.

  /** Slots (técnico + dia + turno) que deixaram de ser da pessoa por troca. */
  const trocaSaidas = useMemo(() => {
    const s = new Map<string, TrocaPlantao>();
    trocas.forEach((t) => {
      s.set(chaveSlot(t.origemTecnicoId, t.origemData, t.origemTurno), t);
      s.set(chaveSlot(t.destinoTecnicoId, t.destinoData, t.destinoTurno), t);
    });
    return s;
  }, [trocas]);

  /** Quem entra em cada dia/turno por troca. */
  const trocaEntradas = useMemo(() => {
    const m: Record<string, { tecnicoId: string; nome: string; noLugarDe: string; troca: TrocaPlantao }[]> = {};
    const add = (data: string, turno: string, v: { tecnicoId: string; nome: string; noLugarDe: string; troca: TrocaPlantao }) => {
      const k = `${data}_${turno}`;
      (m[k] = m[k] || []).push(v);
    };
    trocas.forEach((t) => {
      // No plantão da origem quem trabalha é a destino, e vice-versa.
      add(t.origemData, t.origemTurno, { tecnicoId: t.destinoTecnicoId, nome: t.destinoTecnicoNome, noLugarDe: t.origemTecnicoNome, troca: t });
      add(t.destinoData, t.destinoTurno, { tecnicoId: t.origemTecnicoId, nome: t.origemTecnicoNome, noLugarDe: t.destinoTecnicoNome, troca: t });
    });
    return m;
  }, [trocas]);

  const entradasNoDia = (dataISO: string, turno: 'diurno' | 'noturno') =>
    trocaEntradas[`${dataISO}_${turno}`] ?? [];

  /** A técnica está na escala fixa daquele dia/turno? Usado só para avisar. */
  const escaladoEm = (tecnicoId: string, dataISO: string, turno: 'diurno' | 'noturno') => {
    const dia = Number(dataISO.split('-')[2]);
    if (!dia) return false;
    const paridade = dia % 2 === 0 ? 'par' : 'impar';
    return escala.some(
      (e) =>
        tecnicoIdDe(e) === tecnicoId &&
        (e.turno || 'diurno') === turno &&
        e.paridade === paridade &&
        vigenteEm(e, dataISO)
    );
  };

  const escaladosNoDia = (dia: number, dataISO: string, turno: 'diurno' | 'noturno') => {
    const paridade = dia % 2 === 0 ? 'par' : 'impar';
    return escala.filter(
      (e) =>
        (e.turno || 'diurno') === turno &&
        e.paridade === paridade &&
        vigenteEm(e, dataISO) &&
        !folgas[`${tecnicoIdDe(e)}_${dataISO}`] &&
        !trocaSaidas.has(chaveSlot(tecnicoIdDe(e), dataISO, turno))
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

    const rotulo = `${selTurno === 'diurno' ? 'Diurno' : 'Noturno'} · dias ${selParidade === 'par' ? 'pares' : 'ímpares'}`;

    // Quem ocupa essa vaga (mesmo turno + mesma paridade) e ainda está em vigor.
    const ocupantes = escalaVigente.filter(
      (e) => (e.turno || 'diurno') === selTurno && e.paridade === selParidade
    );

    if (ocupantes.some((e) => tecnicoIdDe(e) === t.id)) {
      notificar('erro', `${t.nome} já está escalado em ${rotulo}.`);
      return;
    }

    // Um técnico novo numa vaga ocupada significa que ele está assumindo: o
    // anterior sai da escala a partir de hoje, sem mexer nos dias já passados.
    if (ocupantes.length > 0) {
      const saindo = ocupantes.map((e) => e.tecnicoNome).join(', ');
      const ok = await confirmar({
        titulo: 'Trocar quem está na escala',
        mensagem: `${t.nome} assume ${rotulo} a partir de hoje (${formatarDataBR(hojeISO)}), no lugar de ${saindo}. Os dias anteriores continuam registrados com ${ocupantes.length > 1 ? 'os técnicos atuais' : saindo}.`,
        textoConfirmar: 'Confirmar troca',
      });
      if (!ok) return;
    }

    setSalvandoCad(true);
    try {
      const batch = writeBatch(db);

      ocupantes.forEach((e) => {
        if (!e.inicio || e.inicio <= ontemISO) {
          // Já valeu algum dia: encerra ontem e o passado fica preservado.
          batch.update(doc(db, 'escala', e.id), { fim: ontemISO });
        } else {
          // Entrou hoje e já está saindo: nunca chegou a valer, some inteiro.
          batch.delete(doc(db, 'escala', e.id));
        }
      });

      const novoRef = doc(collection(db, 'escala'));
      batch.set(novoRef, {
        tecnicoId: t.id,
        tecnicoNome: t.nome,
        inicial: iniciaisDe(t.nome),
        paridade: selParidade,
        turno: selTurno,
        inicio: hojeISO,
        fim: null,
      });

      await batch.commit();

      registrar(
        'criar',
        'escala',
        novoRef.id,
        ocupantes.length > 0
          ? `${t.nome} assumiu ${rotulo} a partir de ${formatarDataBR(hojeISO)} (saiu: ${ocupantes.map((e) => e.tecnicoNome).join(', ')})`
          : `${t.nome} · ${rotulo} · a partir de ${formatarDataBR(hojeISO)}`
      );

      setModalCad(false);
      setSelTecnicoId('');
      setSelParidade('impar');
      setSelTurno('diurno');
      await carregar();
      notificar('sucesso', ocupantes.length > 0 ? 'Troca registrada a partir de hoje.' : 'Escala salva.');
    } catch (e) {
      console.error('Erro ao salvar escala:', e);
      notificar('erro', 'Erro ao salvar a escala.');
    } finally {
      setSalvandoCad(false);
    }
  };

  const removerEscala = async (e: EscalaItem) => {
    // Se a vigência começa hoje ou depois, ela nunca apareceu no passado e pode
    // sumir. Caso contrário, encerra ontem para não apagar o histórico.
    const nuncaValeu = !!e.inicio && e.inicio > ontemISO;

    const ok = await confirmar({
      titulo: nuncaValeu ? 'Remover da escala' : 'Encerrar na escala',
      mensagem: nuncaValeu
        ? `Remover ${e.tecnicoNome} da escala? Como ela entrou hoje, nada fica registrado.`
        : `${e.tecnicoNome} sai da escala a partir de hoje (${formatarDataBR(hojeISO)}). Os dias já passados continuam registrados com ela.`,
      textoConfirmar: nuncaValeu ? 'Remover' : 'Encerrar',
      destrutivo: true,
    });
    if (!ok) return;

    try {
      if (nuncaValeu) {
        await deleteDoc(doc(db, 'escala', e.id));
        registrar('excluir', 'escala', e.id, `Removido da escala: ${e.tecnicoNome}`);
      } else {
        await updateDoc(doc(db, 'escala', e.id), { fim: ontemISO });
        registrar('editar', 'escala', e.id, `${e.tecnicoNome} saiu da escala em ${formatarDataBR(hojeISO)}`);
      }
      await carregar();
    } catch (err) {
      console.error(err);
      notificar('erro', 'Erro ao encerrar a escala.');
    }
  };

  // ── Folga ─────────────────────────────────────────────────────────────────
  /** Registra folga combinada ou falta (não comparecimento) no dia/turno. */
  const marcarAusencia = async (
    item: EscalaItem,
    dataISO: string,
    tipo: 'folga' | 'falta',
    extras?: { avisou?: boolean; motivo?: string }
  ) => {
    const key = `${tecnicoIdDe(item)}_${dataISO}`;
    try {
      const nova: Folga = {
        tecnicoId: tecnicoIdDe(item),
        tecnicoNome: item.tecnicoNome,
        data: dataISO,
        turno: item.turno || 'diurno',
        tipo,
        // O Firestore rejeita undefined: só manda o que existe.
        ...(tipo === 'falta' ? { avisou: !!extras?.avisou, motivo: (extras?.motivo ?? '').trim() } : {}),
      };
      await setDoc(doc(db, 'folgas', key), nova);
      setFolgas((prev) => ({ ...prev, [key]: nova }));
      registrar(
        'criar',
        'escala',
        key,
        `${tipo === 'falta' ? 'Falta' : 'Folga'} · ${item.tecnicoNome} · ${formatarDataBR(dataISO)}${
          tipo === 'falta' ? ` · ${extras?.avisou ? 'avisou' : 'não avisou'}` : ''
        }`
      );
      notificar('sucesso', tipo === 'falta' ? 'Falta registrada.' : 'Folga registrada.');
    } catch (e) {
      console.error('Erro ao registrar ausência:', e);
      notificar('erro', 'Erro ao registrar.');
    }
  };

  const removerAusencia = async (item: EscalaItem, dataISO: string) => {
    const key = `${tecnicoIdDe(item)}_${dataISO}`;
    const atual = folgas[key];
    try {
      await deleteDoc(doc(db, 'folgas', key));
      setFolgas((prev) => { const n = { ...prev }; delete n[key]; return n; });
      registrar(
        'excluir',
        'escala',
        key,
        `${rotuloAusencia(atual)} cancelada · ${item.tecnicoNome} · ${formatarDataBR(dataISO)}`
      );
    } catch (e) {
      console.error('Erro ao cancelar ausência:', e);
      notificar('erro', 'Erro ao cancelar.');
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

  // ── Troca de plantão ──────────────────────────────────────────────────────
  const criarTroca = async (
    item: EscalaItem,
    dataISO: string,
    turno: 'diurno' | 'noturno',
    comTecnicoId: string,
    dataDestino: string,
    turnoDestino: 'diurno' | 'noturno'
  ) => {
    const outra = tecnicos.find((t) => t.id === comTecnicoId);
    if (!outra) { notificar('erro', 'Escolha com quem vai trocar.'); return; }
    if (!dataDestino) { notificar('erro', 'Informe o dia do plantão que você vai assumir.'); return; }
    if (outra.id === tecnicoIdDe(item)) { notificar('erro', 'Escolha outra técnica.'); return; }

    // Nenhum dos dois lados pode já estar trocado, senão um plantão teria dois donos.
    if (trocaSaidas.has(chaveSlot(outra.id, dataDestino, turnoDestino))) {
      notificar('erro', `${outra.nome} já trocou o plantão de ${formatarDataBR(dataDestino)} (${rotuloTurno(turnoDestino)}).`);
      return;
    }

    setSalvandoTroca(true);
    try {
      const nova: Omit<TrocaPlantao, 'id'> = {
        origemTecnicoId: tecnicoIdDe(item),
        origemTecnicoNome: item.tecnicoNome,
        origemData: dataISO,
        origemTurno: turno,
        destinoTecnicoId: outra.id,
        destinoTecnicoNome: outra.nome,
        destinoData: dataDestino,
        destinoTurno: turnoDestino,
        criadoEm: new Date().toISOString(),
        criadoPorNome: perfil?.nome ?? '—',
      };
      const ref = await addDoc(collection(db, 'trocas'), nova);
      setTrocas((prev) => [...prev, { id: ref.id, ...nova }]);
      registrar(
        'criar',
        'troca-plantao',
        ref.id,
        `${item.tecnicoNome} (${formatarDataBR(dataISO)} ${rotuloTurno(turno)}) ↔ ${outra.nome} (${formatarDataBR(dataDestino)} ${rotuloTurno(turnoDestino)})`
      );
      setTrocaPara(null);
      notificar('sucesso', `Troca registrada: ${outra.nome} assume ${formatarDataBR(dataISO)}.`);
    } catch (e) {
      console.error('Erro ao registrar troca:', e);
      notificar('erro', 'Erro ao registrar a troca.');
    } finally {
      setSalvandoTroca(false);
    }
  };

  const desfazerTroca = async (t: TrocaPlantao) => {
    const ok = await confirmar({
      titulo: 'Desfazer troca',
      mensagem: `Cada uma volta para o próprio plantão: ${t.origemTecnicoNome} em ${formatarDataBR(t.origemData)} (${rotuloTurno(t.origemTurno)}) e ${t.destinoTecnicoNome} em ${formatarDataBR(t.destinoData)} (${rotuloTurno(t.destinoTurno)}).`,
      textoConfirmar: 'Desfazer',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'trocas', t.id));
      setTrocas((prev) => prev.filter((x) => x.id !== t.id));
      registrar('excluir', 'troca-plantao', t.id, `Troca desfeita: ${t.origemTecnicoNome} ↔ ${t.destinoTecnicoNome}`);
      notificar('sucesso', 'Troca desfeita.');
    } catch (e) {
      console.error('Erro ao desfazer troca:', e);
      notificar('erro', 'Erro ao desfazer a troca.');
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
  // Folga cujo dia já chegou (ou passou) sem ninguém ter confirmado a cobertura:
  // o paciente fica sem equipe naquele turno, então é destacado em vermelho.
  const folgasSemCoberturaNoDia = (dataISO: string, turno: 'diurno' | 'noturno') =>
    dataISO <= hojeISO
      ? Object.values(folgas).filter(
          (f) => f.data === dataISO && (f.turno || 'diurno') === turno && !f.cobertoPor
        )
      : [];

  const diaSelNum = diaSel ? Number(diaSel.split('-')[2]) : 0;
  // Só quem estava (ou está) escalado naquele dia específico.
  const escalaDoDiaSel = diaSel
    ? escala.filter((e) => e.paridade === (diaSelNum % 2 === 0 ? 'par' : 'impar') && vigenteEm(e, diaSel))
    : [];

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

      {/* Legenda dos técnicos escalados hoje */}
      {escalaVigente.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {escalaVigente.map((e) => (
            <span key={e.id} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${corPorId[tecnicoIdDe(e)]}`}>
              <b>{e.inicial}</b> {e.tecnicoNome}
              <span className="opacity-70">· {(e.turno || 'diurno') === 'diurno' ? '☀ Diurno' : '🌙 Noturno'} · {e.paridade === 'par' ? 'pares' : 'ímpares'}</span>
            </span>
          ))}
        </div>
      )}

      {/* No celular a célula mostra só as iniciais, então esta legenda explica
          o que cada cor significa. No desktop os rótulos aparecem por extenso. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 sm:hidden">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" /> cobertura
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-violet-100 border border-violet-200" /> troca
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-50 border border-red-300" /> <b className="text-red-600">!</b> sem cobertura
        </span>
        <span className="text-gray-400">Toque no dia para ver os nomes.</span>
      </div>

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
                const semCobDiurno = folgasSemCoberturaNoDia(dataISO, 'diurno');
                const semCobNoturno = folgasSemCoberturaNoDia(dataISO, 'noturno');
                const trocaDiurno = entradasNoDia(dataISO, 'diurno');
                const trocaNoturno = entradasNoDia(dataISO, 'noturno');
                // Dia com algum turno descoberto ganha borda vermelha.
                const diaDescoberto = semCobDiurno.length > 0 || semCobNoturno.length > 0;
                const ehHoje = dataISO === hojeISO;
                return (
                  <button
                    key={dataISO}
                    onClick={() => setDiaSel(dataISO)}
                    className={`min-h-[62px] sm:min-h-[112px] rounded-lg p-0.5 sm:p-1 text-left transition-colors flex flex-col ${
                      diaDescoberto
                        ? `border-2 border-red-500 ${ehHoje ? 'bg-primary-50/40' : 'bg-red-50/40 hover:bg-red-50/70'}`
                        : ehHoje
                        ? 'border border-primary-400 bg-primary-50/40'
                        : 'border border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-xs font-semibold px-0.5 ${ehHoje ? 'text-primary-600' : 'text-gray-400'}`}>{dia}</span>
                    <div className="flex-1 flex flex-col gap-0.5 mt-0.5">
                      <div className="rounded bg-amber-50/70 flex items-start gap-0.5 sm:gap-1 px-0.5 sm:px-1 py-0.5">
                        <Sun size={10} className="text-amber-500 shrink-0 mt-0.5" />
                        <div className="flex flex-wrap sm:flex-col gap-0.5 min-w-0">
                          {diurno.map((e) => (
                            <span key={e.id} className={`text-[10px] leading-tight font-semibold px-1 py-0.5 rounded break-words ${corPorId[tecnicoIdDe(e)]}`} title={`${e.tecnicoNome} (diurno)`}><span className="sm:hidden">{e.inicial}</span><span className="hidden sm:inline">{e.tecnicoNome}</span></span>
                          ))}
                          {cobDiurno.map((f) => (
                            <span key={`c${f.tecnicoId}`} className="text-[10px] leading-tight font-semibold px-1 py-0.5 rounded break-words bg-emerald-100 text-emerald-700" title={`${f.cobertoPorNome} cobrindo ${f.tecnicoNome}`}><span className="sm:hidden">{iniciaisDe(f.cobertoPorNome || '')}</span><span className="hidden sm:inline">{f.cobertoPorNome} <span className="opacity-70">(cob.)</span></span></span>
                          ))}
                          {semCobDiurno.map((f) => (
                            <span key={`s${f.tecnicoId}`} className="text-[10px] leading-tight px-1 py-0.5 rounded break-words bg-red-50" title={`${rotuloAusencia(f)} de ${f.tecnicoNome} sem cobertura`}>
                              <span className="sm:hidden font-bold text-red-600 whitespace-nowrap">! {iniciaisDe(f.tecnicoNome)}</span>
                              <span className="hidden sm:inline font-bold text-red-600">{rotuloAusencia(f)} sem cobertura</span>
                              <span className="hidden sm:inline font-semibold text-gray-600"> · {f.tecnicoNome}</span>
                            </span>
                          ))}
                          {trocaDiurno.map((x) => (
                            <span key={`t${x.troca.id}`} className="text-[10px] leading-tight font-semibold px-1 py-0.5 rounded break-words bg-violet-100 text-violet-700" title={`${x.nome} no lugar de ${x.noLugarDe} (troca de plantão)`}><span className="sm:hidden">{iniciaisDe(x.nome)}</span><span className="hidden sm:inline">{x.nome} <span className="opacity-70">(troca)</span></span></span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded bg-indigo-50/70 flex items-start gap-0.5 sm:gap-1 px-0.5 sm:px-1 py-0.5">
                        <Moon size={10} className="text-indigo-400 shrink-0 mt-0.5" />
                        <div className="flex flex-wrap sm:flex-col gap-0.5 min-w-0">
                          {noturno.map((e) => (
                            <span key={e.id} className={`text-[10px] leading-tight font-semibold px-1 py-0.5 rounded break-words ${corPorId[tecnicoIdDe(e)]}`} title={`${e.tecnicoNome} (noturno)`}><span className="sm:hidden">{e.inicial}</span><span className="hidden sm:inline">{e.tecnicoNome}</span></span>
                          ))}
                          {cobNoturno.map((f) => (
                            <span key={`c${f.tecnicoId}`} className="text-[10px] leading-tight font-semibold px-1 py-0.5 rounded break-words bg-emerald-100 text-emerald-700" title={`${f.cobertoPorNome} cobrindo ${f.tecnicoNome}`}><span className="sm:hidden">{iniciaisDe(f.cobertoPorNome || '')}</span><span className="hidden sm:inline">{f.cobertoPorNome} <span className="opacity-70">(cob.)</span></span></span>
                          ))}
                          {semCobNoturno.map((f) => (
                            <span key={`s${f.tecnicoId}`} className="text-[10px] leading-tight px-1 py-0.5 rounded break-words bg-red-50" title={`${rotuloAusencia(f)} de ${f.tecnicoNome} sem cobertura`}>
                              <span className="sm:hidden font-bold text-red-600 whitespace-nowrap">! {iniciaisDe(f.tecnicoNome)}</span>
                              <span className="hidden sm:inline font-bold text-red-600">{rotuloAusencia(f)} sem cobertura</span>
                              <span className="hidden sm:inline font-semibold text-gray-600"> · {f.tecnicoNome}</span>
                            </span>
                          ))}
                          {trocaNoturno.map((x) => (
                            <span key={`t${x.troca.id}`} className="text-[10px] leading-tight font-semibold px-1 py-0.5 rounded break-words bg-violet-100 text-violet-700" title={`${x.nome} no lugar de ${x.noLugarDe} (troca de plantão)`}><span className="sm:hidden">{iniciaisDe(x.nome)}</span><span className="hidden sm:inline">{x.nome} <span className="opacity-70">(troca)</span></span></span>
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

      {escalaVigente.length === 0 && !carregando && (
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
                {escalaVigente.length > 0 && (
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Escala atual</p>
                    <div className="space-y-1.5">
                      {escalaVigente.map((e) => (
                        <div key={e.id} className="flex items-center justify-between text-sm gap-2">
                          <span className="text-gray-700 min-w-0">
                            <b className={`px-1.5 py-0.5 rounded ${corPorId[tecnicoIdDe(e)]}`}>{e.inicial}</b> {e.tecnicoNome} · {(e.turno || 'diurno') === 'diurno' ? 'Diurno' : 'Noturno'} · {e.paridade === 'par' ? 'pares' : 'ímpares'}
                            {e.inicio && <span className="text-xs text-gray-400 block ml-0.5">desde {formatarDataBR(e.inicio)}</span>}
                          </span>
                          <button onClick={() => removerEscala(e)} className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Escalas encerradas — o passado do calendário continua vindo daqui */}
                {escalaEncerrada.length > 0 && (
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Histórico da escala</p>
                    <p className="text-[11px] text-gray-400 mb-2">
                      Períodos encerrados. O calendário dos dias passados continua mostrando estes técnicos.
                    </p>
                    <div className="space-y-1.5">
                      {escalaEncerrada.map((e) => (
                        <div key={e.id} className="text-sm text-gray-500">
                          <b className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{e.inicial}</b> {e.tecnicoNome} ·{' '}
                          {(e.turno || 'diurno') === 'diurno' ? 'Diurno' : 'Noturno'} · {e.paridade === 'par' ? 'pares' : 'ímpares'}
                          <span className="text-xs text-gray-400 block ml-0.5">
                            {e.inicio ? `${formatarDataBR(e.inicio)} → ` : 'até '}{formatarDataBR(e.fim!)}
                          </span>
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

            {escalaDoDiaSel.length === 0 &&
             entradasNoDia(diaSel, 'diurno').length === 0 &&
             entradasNoDia(diaSel, 'noturno').length === 0 ? (
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
                            const key = `${tecnicoIdDe(e)}_${diaSel}`;
                            const folga = folgas[key];
                            const editandoCob = coberturaPara === key;
                            // Chegou o dia da folga e ninguém confirmou cobertura.
                            const semCobertura = !!folga && !folga.cobertoPor && diaSel <= hojeISO;
                            const slot = chaveSlot(tecnicoIdDe(e), diaSel, turno);
                            const trocou = trocaSaidas.get(slot);

                            // Plantão trocado: quem trabalha aqui é a outra técnica,
                            // então nem folga nem falta fazem sentido neste card.
                            if (trocou) {
                              const euSouOrigem = trocou.origemTecnicoId === tecnicoIdDe(e);
                              const outraNome = euSouOrigem ? trocou.destinoTecnicoNome : trocou.origemTecnicoNome;
                              const minhaData = euSouOrigem ? trocou.destinoData : trocou.origemData;
                              const meuTurno = euSouOrigem ? trocou.destinoTurno : trocou.origemTurno;
                              return (
                                <div key={e.id} className="p-3 rounded-xl border border-violet-200 bg-violet-50">
                                  <div className="flex items-center gap-3">
                                    <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${corPorId[tecnicoIdDe(e)]}`}>{e.inicial}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-800 truncate">{e.tecnicoNome}</p>
                                      <p className="text-[11px] text-violet-700 font-semibold">
                                        Trocou com {outraNome}
                                      </p>
                                      <p className="text-[11px] text-gray-500">
                                        Vai fazer {formatarDataBR(minhaData)} · {rotuloTurno(meuTurno)}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => desfazerTroca(trocou)}
                                      className="shrink-0 text-[11px] text-gray-500 hover:text-red-600"
                                    >
                                      Desfazer troca
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={e.id} className={`p-3 rounded-xl border ${folga ? (folga.cobertoPor ? 'border-emerald-200 bg-emerald-50' : semCobertura ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50') : 'border-gray-100'}`}>
                                <div className="flex items-center gap-3">
                                  <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${corPorId[tecnicoIdDe(e)]}`}>{e.inicial}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{e.tecnicoNome}</p>
                                    {semCobertura ? (
                                      <p className="text-[11px] font-bold text-red-600">{rotuloAusencia(folga)} sem cobertura</p>
                                    ) : (
                                      <p className="text-[11px] text-gray-400">
                                        {!folga
                                          ? 'Escalado'
                                          : folga.cobertoPor
                                          ? `${rotuloAusencia(folga)} coberta por ${folga.cobertoPorNome}`
                                          : ehFalta(folga)
                                          ? 'Não compareceu — aguardando cobertura'
                                          : 'De folga — aguardando cobertura'}
                                      </p>
                                    )}
                                    {ehFalta(folga) && (
                                      <p className="text-[11px] text-gray-500 mt-0.5">
                                        <span className={folga.avisou ? 'text-amber-700' : 'text-red-600 font-semibold'}>
                                          {folga.avisou ? 'Avisou antes' : 'Não avisou'}
                                        </span>
                                        {folga.motivo ? ` · ${folga.motivo}` : ''}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    {!folga && (
                                      <button onClick={() => marcarAusencia(e, diaSel, 'folga')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                                        <Coffee size={14} /> Solicitar folga
                                      </button>
                                    )}
                                    {/* Falta: só admin e família, e só em dia que já chegou. */}
                                    {!folga && podeRegistrarFalta && diaSel <= hojeISO && faltaPara !== key && (
                                      <button
                                        onClick={() => { setFaltaPara(key); setFaltaAvisou(false); setFaltaMotivo(''); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                                      >
                                        <UserX size={14} /> Não compareceu
                                      </button>
                                    )}
                                    {!folga && trocaPara !== slot && (
                                      <button
                                        onClick={() => { setTrocaPara(slot); setTrocaComId(''); setTrocaData(''); setTrocaTurno('diurno'); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100"
                                      >
                                        <ArrowLeftRight size={14} /> Trocar plantão
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
                                    {/* Cancelar falta segue a mesma regra de registrar,
                                        senão a restrição não valeria de nada. */}
                                    {folga && (!ehFalta(folga) || podeRegistrarFalta) && (
                                      <button onClick={() => removerAusencia(e, diaSel)} className="text-[11px] text-gray-500 hover:text-emerald-700">
                                        Cancelar {rotuloAusencia(folga).toLowerCase()}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {folga && !folga.cobertoPor && editandoCob && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <select value={coberturaTecnicoId} onChange={(ev) => setCoberturaTecnicoId(ev.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300">
                                      <option value="">Quem vai cobrir?</option>
                                      {tecnicos.filter((t) => t.id !== tecnicoIdDe(e)).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                                    </select>
                                    <button onClick={() => fazerCobertura(folga, coberturaTecnicoId)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700">Confirmar</button>
                                    <button onClick={() => setCoberturaPara(null)} className="px-2 py-1.5 text-xs text-gray-500">Cancelar</button>
                                  </div>
                                )}

                                {/* Registro de falta */}
                                {!folga && podeRegistrarFalta && faltaPara === key && (
                                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                      Registrar falta de {e.tecnicoNome}
                                    </p>

                                    <div className="grid grid-cols-2 gap-2">
                                      {([
                                        { v: true, label: 'Avisou antes' },
                                        { v: false, label: 'Não avisou' },
                                      ] as const).map((op) => (
                                        <button
                                          key={String(op.v)}
                                          onClick={() => setFaltaAvisou(op.v)}
                                          className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                                            faltaAvisou === op.v
                                              ? op.v
                                                ? 'bg-amber-500 text-white border-amber-500'
                                                : 'bg-red-500 text-white border-red-500'
                                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                          }`}
                                        >
                                          {op.label}
                                        </button>
                                      ))}
                                    </div>

                                    <input
                                      type="text"
                                      value={faltaMotivo}
                                      onChange={(ev) => setFaltaMotivo(ev.target.value)}
                                      placeholder="Motivo (opcional). Ex: atestado, problema de saúde"
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
                                    />

                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={async () => {
                                          await marcarAusencia(e, diaSel, 'falta', { avisou: faltaAvisou, motivo: faltaMotivo });
                                          setFaltaPara(null);
                                        }}
                                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700"
                                      >
                                        Registrar falta
                                      </button>
                                      <button onClick={() => setFaltaPara(null)} className="px-2 py-1.5 text-xs text-gray-500">
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Troca de plantão */}
                                {!folga && trocaPara === slot && (
                                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                                      {e.tecnicoNome} troca este plantão
                                    </p>
                                    <p className="text-[11px] text-gray-400">
                                      Quem escolher assume {formatarDataBR(diaSel)} · {rotuloTurno(turno)}, e {e.tecnicoNome.split(' ')[0]} assume o plantão abaixo.
                                    </p>

                                    <select
                                      value={trocaComId}
                                      onChange={(ev) => setTrocaComId(ev.target.value)}
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
                                    >
                                      <option value="">Trocar com quem?</option>
                                      {tecnicos.filter((t) => t.id !== tecnicoIdDe(e)).map((t) => (
                                        <option key={t.id} value={t.id}>{t.nome}</option>
                                      ))}
                                    </select>

                                    <div className="flex gap-2">
                                      <input
                                        type="date"
                                        value={trocaData}
                                        onChange={(ev) => setTrocaData(ev.target.value)}
                                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
                                      />
                                      <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
                                        {(['diurno', 'noturno'] as const).map((tt) => (
                                          <button
                                            key={tt}
                                            onClick={() => setTrocaTurno(tt)}
                                            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1 ${
                                              trocaTurno === tt ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                                            }`}
                                          >
                                            {tt === 'diurno' ? <Sun size={12} /> : <Moon size={12} />}
                                            {tt === 'diurno' ? 'Dia' : 'Noite'}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {trocaComId && trocaData && !escaladoEm(trocaComId, trocaData, trocaTurno) && (
                                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                                        {tecnicos.find((t) => t.id === trocaComId)?.nome} não está na escala de{' '}
                                        {formatarDataBR(trocaData)} · {rotuloTurno(trocaTurno)}. A troca vale mesmo assim, mas
                                        confira o dia.
                                      </p>
                                    )}

                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => criarTroca(e, diaSel, turno, trocaComId, trocaData, trocaTurno)}
                                        disabled={salvandoTroca}
                                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                                      >
                                        {salvandoTroca ? <RefreshCw size={13} className="animate-spin" /> : <ArrowLeftRight size={13} />}
                                        Confirmar troca
                                      </button>
                                      <button onClick={() => setTrocaPara(null)} className="px-2 py-1.5 text-xs text-gray-500">
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Quem entra neste turno por troca (não está na escala fixa do dia) */}
                      {entradasNoDia(diaSel, turno).length > 0 && (
                        <div className="space-y-2 mt-2">
                          {entradasNoDia(diaSel, turno).map((x) => (
                            <div key={`ent${x.troca.id}`} className="p-3 rounded-xl border border-violet-200 bg-violet-50 flex items-center gap-3">
                              <span className="text-xs font-bold px-2 py-1 rounded shrink-0 bg-violet-100 text-violet-700">
                                {iniciaisDe(x.nome)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{x.nome}</p>
                                <p className="text-[11px] text-violet-700 font-semibold">
                                  Entra por troca, no lugar de {x.noLugarDe}
                                </p>
                              </div>
                              <button
                                onClick={() => desfazerTroca(x.troca)}
                                className="shrink-0 text-[11px] text-gray-500 hover:text-red-600"
                              >
                                Desfazer troca
                              </button>
                            </div>
                          ))}
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
