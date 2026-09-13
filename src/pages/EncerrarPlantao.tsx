import React, { useRef, useState } from 'react';
import { Camera, CheckCircle2, RefreshCw, X, LogOut, AlertTriangle } from 'lucide-react';
import { useAuth } from '../config/auth/authContext';
import { useFeedback } from '../components/FeedbackProvider';
import { useAuditoria } from '../config/auditoria';

// Endpoint do seu API Gateway que devolve uma URL pré-assinada do S3.
// Configure em .env (local) e nas Environment Variables do Vercel.
const S3_UPLOAD_URL = import.meta.env.VITE_S3_UPLOAD_URL as string | undefined;

const EncerrarPlantao: React.FC = () => {
  const { perfil } = useAuth();
  const { notificar } = useFeedback();
  const { registrar } = useAuditoria();

  const inputRef = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [enviando, setEnviando] = useState(false);
  const [encerrado, setEncerrado] = useState(false);

  const abrirCamera = () => inputRef.current?.click();

  const onFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    setPreview(URL.createObjectURL(file));
    setEncerrado(false);
  };

  const limpar = () => {
    setFoto(null);
    setPreview('');
    setEncerrado(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const encerrarPlantao = async () => {
    if (!foto) { notificar('erro', 'Tire a foto do relatório antes de encerrar.'); return; }
    if (!S3_UPLOAD_URL) { notificar('erro', 'Envio não configurado (VITE_S3_UPLOAD_URL). Contate o administrador.'); return; }
    setEnviando(true);
    try {
      const agora = new Date();
      const nomeArquivo = `relatorios-plantao/${agora.toISOString().replace(/[:.]/g, '-')}_${(perfil?.nome || 'tecnico').replace(/\s+/g, '-')}.jpg`;
      const contentType = foto.type || 'image/jpeg';

      // 1) Pede a URL pré-assinada ao API Gateway (não expõe credenciais AWS no cliente).
      const resp = await fetch(S3_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: nomeArquivo, contentType, tecnico: perfil?.nome ?? '' }),
      });
      if (!resp.ok) throw new Error(`Falha ao obter URL de upload (${resp.status})`);
      const dados = await resp.json();
      const uploadUrl: string | undefined = dados.uploadUrl || dados.url;
      if (!uploadUrl) throw new Error('Resposta do servidor sem uploadUrl.');

      // 2) Envia o arquivo direto ao S3 usando a URL pré-assinada.
      const up = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: foto,
      });
      if (!up.ok) throw new Error(`Falha no envio ao S3 (${up.status})`);

      registrar('criar', 'plantao', nomeArquivo, `Plantão encerrado · relatório enviado por ${perfil?.nome ?? 'técnico'}`);
      setEncerrado(true);
      notificar('sucesso', 'Plantão encerrado e relatório enviado!');
    } catch (e) {
      console.error('Erro ao encerrar plantão:', e);
      notificar('erro', 'Não foi possível enviar o relatório. Verifique a conexão e tente novamente.');
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
        <p className="text-gray-500 text-sm mt-1">Fotografe o relatório do plantão e finalize.</p>
      </div>

      {!S3_UPLOAD_URL && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          Envio ao S3 ainda não configurado. O administrador precisa definir a variável <b>VITE_S3_UPLOAD_URL</b>.
        </div>
      )}

      {encerrado ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Plantão encerrado!</h2>
          <p className="text-sm text-gray-500 mt-1">O relatório foi enviado com sucesso.</p>
          <button onClick={limpar} className="mt-6 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors">
            Novo envio
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          {/* Câmera */}
          <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFoto} />

          {preview ? (
            <div className="relative">
              <img src={preview} alt="Relatório do plantão" className="w-full rounded-xl border border-gray-100 max-h-96 object-contain bg-gray-50" />
              <button onClick={limpar} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70" title="Remover">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={abrirCamera}
              className="w-full flex flex-col items-center justify-center gap-2 py-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-primary-300 hover:text-primary-600 transition-colors"
            >
              <Camera size={34} />
              <span className="text-sm font-medium">Enviar relatório</span>
              <span className="text-xs text-gray-400">Toque para abrir a câmera</span>
            </button>
          )}

          {preview && (
            <button
              onClick={abrirCamera}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Camera size={16} /> Tirar outra foto
            </button>
          )}

          <button
            onClick={encerrarPlantao}
            disabled={!foto || enviando}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando ? <><RefreshCw size={18} className="animate-spin" /> Enviando…</> : <><LogOut size={18} /> Encerrar plantão</>}
          </button>
        </div>
      )}
    </div>
  );
};

export default EncerrarPlantao;
