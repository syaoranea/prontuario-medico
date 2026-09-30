import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera, CheckCircle2, RefreshCw, X, LogOut, AlertTriangle, Sun, Moon,
  Paperclip, CalendarCheck,
} from 'lucide-react';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../config/auth/authContext';
import { useFeedback } from '../components/FeedbackProvider';
import { useAuditoria } from '../config/auditoria';
import { PlantaoEncerrado } from '../interface/interface';
import { formatarDataBR } from '../utils/datas';
import { normalizarNome } from '../utils/texto';
import {
  EscalaItem, Folga, TrocaPlantao, Turno, escaladosEm, rotuloTurno,
} from '../utils/escala';
import { plantaoDeAgora } from '../utils/plantao';
import CalendarioPlantoes from '../components/CalendarioPlantoes';

// Endpoint do seu API Gateway que devolve uma URL pré-assinada do S3.
// Configure em .env (local) e nas Environment Variables do Vercel.
const S3_UPLOAD_URL = import.meta.env.VITE_S3_UPLOAD_URL as string | undefined;

const MAX_ANEXOS = 5;

interface Anexo {
  arquivo: File;
  preview: string;
}

const EncerrarPlantao: React.FC = () => {
  const { user, perfil } = useAuth();
  const { notificar } = useFeedback();
  const { registrar } = useAuditoria();

  const inputRef = useRef<HTMLInputElement>(null);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const [encerrado, setEncerrado] = useState(false);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);

  // Qual plantão está sendo encerrado (pré-preenchido pelo horário, ajustável).
  const inicial = plantaoDeAgora();
  const [dataPlantao, setDataPlantao] = useState(inicial.data);
  const [turnoPlantao, setTurnoPlantao] = useState<Turno>(inicial.turno);

  // Dados da escala + plantões já encerrados (calendário e verificação).
  const [escala, setEscala] = useState<EscalaItem[]>([]);
  const [folgas, setFolgas] = useState<Record<string, Folga>>({});
  const [trocas, setTrocas] = useState<TrocaPlantao[]>([]);
  const [encerrados, setEncerrados] = useState<Record<string, PlantaoEncerrado>>({});
  const [carregando, setCarregando] = useState(true);

  // Muda depois de encerrar um plantão, para o calendário recarregar.
  const [recargaCalendario, setRecargaCalendario] = useState(0);

  // ── Carregamento ────────────────────────────────────────────────────────────
  const carregar = async () => {
    setCarregando(true);
    try {
      const [es, fs, trs, pes] = await Promise.all([
        getDocs(collection(db, 'escala')),
        getDocs(collection(db, 'folgas')),
        getDocs(collection(db, 'trocas')),
        getDocs(collection(db, 'plantoes-encerrados')),
      ]);
      setEscala(es.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EscalaItem, 'id'>) })));
      const mapaFolgas: Record<string, Folga> = {};
      fs.docs.forEach((d) => {
        const x = d.data() as Folga;
        if (x.tecnicoId && x.data) mapaFolgas[`${x.tecnicoId}_${x.data}`] = { ...x, turno: x.turno || 'diurno' };
      });
      setFolgas(mapaFolgas);
      setTrocas(trs.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TrocaPlantao, 'id'>) })));
      const mapaEnc: Record<string, PlantaoEncerrado> = {};
      pes.docs.forEach((d) => { mapaEnc[d.id] = { id: d.id, ...(d.data() as Omit<PlantaoEncerrado, 'id'>) }; });
      setEncerrados(mapaEnc);
    } catch (e) {
      console.error('Erro ao carregar plantões:', e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  // ── Verificação da escala ───────────────────────────────────────────────────
  const meuNome = normalizarNome(perfil?.nome);

  const esperados = useMemo(
    () => escaladosEm(escala, folgas, trocas, dataPlantao, turnoPlantao),
    [escala, folgas, trocas, dataPlantao, turnoPlantao]
  );

  /** O plantão selecionado é meu, pela escala? Casa por nome — a escala usa os
   *  ids da coleção `tecnicos`, e o login vive em `membrosEquipe`. */
  const souEuEscalado = useMemo(
    () => !!meuNome && esperados.some((x) => normalizarNome(x.nome) === meuNome),
    [esperados, meuNome]
  );

  const chavePlantao = `${dataPlantao}_${turnoPlantao}`;
  const jaEncerrado = encerrados[chavePlantao];

  // ── Anexos ──────────────────────────────────────────────────────────────────
  const abrirCamera = () => inputRef.current?.click();

  const onArquivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const escolhidos = Array.from(e.target.files ?? []);
    if (escolhidos.length === 0) return;

    const espaco = MAX_ANEXOS - anexos.length;
    if (espaco <= 0) {
      notificar('erro', `Máximo de ${MAX_ANEXOS} anexos.`);
      return;
    }
    const aceitos = escolhidos.slice(0, espaco);
    if (escolhidos.length > espaco) {
      notificar('erro', `Só cabiam mais ${espaco}. Os demais foram ignorados.`);
    }

    setAnexos((prev) => [...prev, ...aceitos.map((arquivo) => ({ arquivo, preview: URL.createObjectURL(arquivo) }))]);
    setEncerrado(false);
    setErroDetalhe(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removerAnexo = (idx: number) => {
    setAnexos((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const limpar = () => {
    anexos.forEach((a) => URL.revokeObjectURL(a.preview));
    setAnexos([]);
    setEncerrado(false);
    setErroDetalhe(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── Envio ───────────────────────────────────────────────────────────────────
  const enviarArquivo = async (arquivo: File, indice: number): Promise<string> => {
    const contentType = arquivo.type || 'image/jpeg';
    const nomeArquivo =
      `relatorios-plantao/${dataPlantao}_${turnoPlantao}` +
      `_${(perfil?.nome || 'tecnico').replace(/\s+/g, '-')}_${indice + 1}` +
      `_${Date.now()}.${contentType.includes('pdf') ? 'pdf' : 'jpg'}`;

    let resp: Response;
    try {
      resp = await fetch(S3_UPLOAD_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: nomeArquivo, contentType, tecnico: perfil?.nome ?? '' }),
      });
    } catch {
      throw new Error('Não foi possível falar com o servidor de envio. Se a internet está boa, é bloqueio de CORS no API Gateway.');
    }
    if (!resp.ok) throw new Error(`O servidor de envio respondeu ${resp.status}.`);

    const dados = await resp.json().catch(() => ({} as Record<string, string>));
    const uploadUrl: string | undefined = dados.uploadUrl || dados.url;
    if (!uploadUrl) throw new Error('O servidor respondeu, mas não mandou o endereço de upload (uploadUrl).');

    let up: Response;
    try {
      up = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: arquivo });
    } catch {
      throw new Error('A foto não chegou ao armazenamento. Quase sempre é CORS do bucket S3 não liberado para este aplicativo.');
    }
    if (!up.ok) throw new Error(`O armazenamento recusou a foto (${up.status}).`);

    return nomeArquivo;
  };

  const encerrarPlantao = async () => {
    if (anexos.length === 0) { notificar('erro', 'Anexe ao menos o relatório do plantão.'); return; }
    if (!S3_UPLOAD_URL) { notificar('erro', 'Envio indisponível. Avise o administrador.'); return; }
    if (!user) return;

    setEnviando(true);
    setErroDetalhe(null);
    setProgresso({ feitos: 0, total: anexos.length });

    let etapa = 'Preparando envio';
    try {
      // 1) Sobe os anexos, um a um, para saber exatamente qual falhou.
      const caminhos: string[] = [];
      for (let i = 0; i < anexos.length; i++) {
        etapa = `Enviando anexo ${i + 1} de ${anexos.length}`;
        caminhos.push(await enviarArquivo(anexos[i].arquivo, i));
        setProgresso({ feitos: i + 1, total: anexos.length });
      }

      // 2) Só então marca o plantão como encerrado. Id = data_turno, então
      // reenviar corrige o registro em vez de criar outro.
      etapa = 'Registrando o encerramento';
      const registro: Omit<PlantaoEncerrado, 'id'> = {
        data: dataPlantao,
        turno: turnoPlantao,
        tecnicoNome: perfil?.nome ?? '—',
        encerradoPor: user.uid,
        encerradoEm: new Date().toISOString(),
        anexos: caminhos,
        foraDaEscala: !souEuEscalado,
      };
      await setDoc(doc(db, 'plantoes-encerrados', chavePlantao), registro);
      setEncerrados((prev) => ({ ...prev, [chavePlantao]: { id: chavePlantao, ...registro } }));

      registrar(
        'criar',
        'plantao',
        chavePlantao,
        `Plantão ${rotuloTurno(turnoPlantao)} de ${formatarDataBR(dataPlantao)} encerrado por ${perfil?.nome ?? 'técnico'}` +
        ` · ${caminhos.length} anexo(s)${!souEuEscalado ? ' · FORA DA ESCALA' : ''}`
      );

      setRecargaCalendario((n) => n + 1);
      setEncerrado(true);
      notificar('sucesso', 'Plantão encerrado e relatório enviado!');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Erro ao encerrar plantão:', etapa, e);
      setErroDetalhe(
        `Etapa: ${etapa}\n${msg}\n\nApp: ${window.location.origin}\nQuando: ${new Date().toLocaleString('pt-BR')}`
      );
      notificar('erro', `Falha em: ${etapa}. Veja o detalhe na tela.`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <LogOut size={24} className="text-primary-600" /> Encerrar Plantão
        </h1>
        <p className="text-gray-500 text-sm mt-1">Anexe o relatório do plantão e finalize.</p>
      </div>

      {encerrado ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Plantão encerrado!</h2>
          <p className="text-sm text-gray-500 mt-1">
            {rotuloTurno(turnoPlantao)} de {formatarDataBR(dataPlantao)} · {progresso.total} anexo(s) enviado(s).
          </p>
          <button onClick={limpar} className="mt-6 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors">
            Novo envio
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          {/* Qual plantão está sendo encerrado */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Plantão que está sendo encerrado</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dataPlantao}
                onChange={(e) => setDataPlantao(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
                {(['diurno', 'noturno'] as Turno[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTurnoPlantao(t)}
                    className={`px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1 ${
                      turnoPlantao === t ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {t === 'diurno' ? <Sun size={13} /> : <Moon size={13} />}
                    {t === 'diurno' ? 'Dia' : 'Noite'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Verificação da escala */}
          {!carregando && (
            souEuEscalado ? (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                <span>Confere: este plantão é seu pela escala.</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  Pela escala, este plantão {esperados.length > 0 ? <>é de <b>{esperados.map((x) => x.nome).join(', ')}</b></> : 'não tem ninguém escalado'}.
                  Confira a data e o turno. Você pode encerrar assim mesmo — fica registrado que foi fora da escala.
                </span>
              </div>
            )
          )}

          {jaEncerrado && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs">
              <CalendarCheck size={14} className="shrink-0 mt-0.5" />
              <span>
                Este plantão já foi encerrado por <b>{jaEncerrado.tecnicoNome}</b> em{' '}
                {new Date(jaEncerrado.encerradoEm).toLocaleString('pt-BR')}. Enviar de novo substitui o registro.
              </span>
            </div>
          )}

          {/* Anexos */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            multiple
            className="hidden"
            onChange={onArquivos}
          />

          {anexos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {anexos.map((a, i) => (
                <div key={i} className="relative">
                  {a.arquivo.type.includes('pdf') ? (
                    <div className="w-full h-24 rounded-lg border border-gray-100 bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                      <Paperclip size={18} />
                      <span className="text-[10px] mt-1 px-1 truncate w-full text-center">{a.arquivo.name}</span>
                    </div>
                  ) : (
                    <img src={a.preview} alt={`Anexo ${i + 1}`} className="w-full h-24 object-cover rounded-lg border border-gray-100 bg-gray-50" />
                  )}
                  <button
                    onClick={() => removerAnexo(i)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                    title="Remover"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {anexos.length < MAX_ANEXOS && (
            <button
              onClick={abrirCamera}
              className={`w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-primary-300 hover:text-primary-600 transition-colors ${
                anexos.length === 0 ? 'py-12' : 'py-5'
              }`}
            >
              <Camera size={anexos.length === 0 ? 34 : 22} />
              <span className="text-sm font-medium">
                {anexos.length === 0 ? 'Anexar relatório' : 'Adicionar outro anexo'}
              </span>
              <span className="text-xs text-gray-400">
                {anexos.length}/{MAX_ANEXOS} · foto ou PDF
              </span>
            </button>
          )}

          {erroDetalhe && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={14} /> O envio falhou
              </p>
              <pre className="text-[11px] text-gray-700 whitespace-pre-wrap break-words font-sans leading-relaxed">
                {erroDetalhe}
              </pre>
              <p className="text-[11px] text-gray-500 mt-2">
                Os anexos continuam aqui. Tente de novo — se falhar igual, tire um print desta tela e mande para o administrador.
              </p>
            </div>
          )}

          <button
            onClick={encerrarPlantao}
            disabled={anexos.length === 0 || enviando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando
              ? <><RefreshCw size={18} className="animate-spin" /> Enviando {progresso.feitos}/{progresso.total}…</>
              : <><LogOut size={18} /> Encerrar plantão</>}
          </button>
        </div>
      )}

      <CalendarioPlantoes
        escala={escala}
        folgas={folgas}
        trocas={trocas}
        recarregar={recargaCalendario}
        onSelecionar={(data, turno) => {
          setDataPlantao(data);
          setTurnoPlantao(turno);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

    </div>
  );
};

export default EncerrarPlantao;
