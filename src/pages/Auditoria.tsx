import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { History, RefreshCw, Filter, ShieldCheck } from 'lucide-react';
import { db } from '../config/firebase';
import {
  AcaoAuditoria,
  ACAO_LABEL,
  EntidadeAuditoria,
  ENTIDADE_LABEL,
} from '../config/auditoria';
import { PAPEL_LABEL, Papel } from '../config/auth/authContext';

interface RegistroAuditoria {
  id: string;
  quem: string;
  quemNome: string;
  papel: Papel | string;
  acao: AcaoAuditoria;
  entidade: EntidadeAuditoria;
  entidadeId: string;
  resumo: string;
  timestamp?: { toDate: () => Date } | null;
}

const CORES_ACAO: Record<AcaoAuditoria, string> = {
  criar: 'bg-green-100 text-green-700',
  editar: 'bg-blue-100 text-blue-700',
  excluir: 'bg-red-100 text-red-700',
  status: 'bg-amber-100 text-amber-700',
};

const fmtDataHora = (ts?: { toDate: () => Date } | null) => {
  if (!ts?.toDate) return '—';
  const d = ts.toDate();
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const Auditoria: React.FC = () => {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroEntidade, setFiltroEntidade] = useState<string>('todas');

  const carregar = async () => {
    setCarregando(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'auditoria'), orderBy('timestamp', 'desc'), limit(300))
      );
      setRegistros(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RegistroAuditoria, 'id'>) })));
    } catch (e) {
      console.error('Erro ao carregar auditoria:', e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(
    () => registros.filter((r) => filtroEntidade === 'todas' || r.entidade === filtroEntidade),
    [registros, filtroEntidade]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <History size={24} className="text-primary-600" /> Trilha de Auditoria
          </h1>
          <p className="text-gray-500 text-sm">Quem criou, editou ou excluiu cada registro clínico — e quando.</p>
        </div>
        <button
          onClick={carregar}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={filtroEntidade}
            onChange={(e) => setFiltroEntidade(e.target.value)}
            className="py-2 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="todas">Todos os tipos</option>
            {(Object.keys(ENTIDADE_LABEL) as EntidadeAuditoria[]).map((e) => (
              <option key={e} value={e}>{ENTIDADE_LABEL[e]}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400 ml-auto">{filtrados.length} registro(s)</span>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma ação registrada ainda.</p>
            <p className="text-xs mt-1">As ações clínicas passam a aparecer aqui conforme forem feitas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data / Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quem</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registro</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtrados.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{fmtDataHora(r.timestamp)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-800">{r.quemNome}</div>
                      <div className="text-xs text-gray-400">{PAPEL_LABEL[r.papel as Papel] ?? r.papel}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${CORES_ACAO[r.acao] ?? 'bg-gray-100 text-gray-700'}`}>
                        {ACAO_LABEL[r.acao] ?? r.acao}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-800">{ENTIDADE_LABEL[r.entidade] ?? r.entidade}</div>
                      {r.resumo && <div className="text-xs text-gray-500">{r.resumo}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auditoria;
