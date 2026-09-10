import React, { useEffect, useState } from 'react';
import {
  Users, Plus, X, ShieldCheck, ShieldOff, Trash2, Edit, Copy, RefreshCw, KeyRound,
} from 'lucide-react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, firebaseConfig } from '../config/firebase';
import { Papel, PAPEL_LABEL, useAuth } from '../config/auth/authContext';
import { useConfirm } from '../components/ConfirmProvider';

interface Membro {
  uid: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
  email?: string;
  celular?: string; // sem DDD
}

const PAPEIS: Papel[] = ['tecnico', 'enfermeiro', 'medico', 'familia', 'admin'];

const CORES_PAPEL: Record<Papel, string> = {
  admin: 'bg-purple-100 text-purple-700',
  medico: 'bg-blue-100 text-blue-700',
  enfermeiro: 'bg-red-100 text-red-700',
  tecnico: 'bg-green-100 text-green-700',
  familia: 'bg-amber-100 text-amber-700',
};

// Cria o usuário no Firebase Auth usando uma instância SECUNDÁRIA do app, para que
// a sessão do admin atual NÃO seja substituída pela do usuário recém-criado.
async function criarUsuarioAuth(email: string, senha: string): Promise<string> {
  const secundario = initializeApp(firebaseConfig, `secundario-${Date.now()}`);
  try {
    const cred = await createUserWithEmailAndPassword(getAuth(secundario), email.trim(), senha);
    return cred.user.uid;
  } finally {
    await signOut(getAuth(secundario)).catch(() => {});
    await deleteApp(secundario).catch(() => {});
  }
}

const Equipe: React.FC = () => {
  const { user } = useAuth();
  const { confirmar } = useConfirm();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null);

  // Form
  const [editUid, setEditUid] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState<Papel>('tecnico');
  const [modoNovo, setModoNovo] = useState(true); // true = cria Auth; false = vincula UID existente
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [celular, setCelular] = useState('');
  const [celularOriginal, setCelularOriginal] = useState('');
  const [uidExistente, setUidExistente] = useState('');

  const mostrar = (tipo: 'ok' | 'erro', msg: string) => {
    setFeedback({ tipo, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const carregar = async () => {
    setCarregando(true);
    try {
      const snap = await getDocs(collection(db, 'membrosEquipe'));
      const dados = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Membro, 'uid'>) }));
      dados.sort((a, b) => a.nome.localeCompare(b.nome));
      setMembros(dados);
    } catch (e) {
      console.error('Erro ao carregar equipe:', e);
      mostrar('erro', 'Não foi possível carregar a equipe.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const resetForm = () => {
    setEditUid(null);
    setNome('');
    setPapel('tecnico');
    setModoNovo(true);
    setEmail('');
    setSenha('');
    setCelular('');
    setCelularOriginal('');
    setUidExistente('');
  };

  const abrirNovo = () => {
    resetForm();
    setModalAberto(true);
  };

  const abrirEdicao = (m: Membro) => {
    setEditUid(m.uid);
    setNome(m.nome);
    setPapel(m.papel);
    setEmail(m.email || '');
    setCelular(m.celular || '');
    setCelularOriginal(m.celular || '');
    setModalAberto(true);
  };

  const fechar = () => {
    setModalAberto(false);
    resetForm();
  };

  // Mantém a coleção pública loginTelefone/{celular} = { email } (best-effort).
  const sincronizarLoginTelefone = async (celularNovo: string, celularAntigo: string, email: string) => {
    try {
      if (celularAntigo && celularAntigo !== celularNovo) {
        await deleteDoc(doc(db, 'loginTelefone', celularAntigo));
      }
      if (celularNovo && email) {
        await setDoc(doc(db, 'loginTelefone', celularNovo), { email });
      }
    } catch (e) {
      console.error('Erro ao sincronizar login por telefone:', e);
    }
  };

  const salvar = async () => {
    if (!nome.trim()) {
      mostrar('erro', 'Informe o nome.');
      return;
    }
    setSalvando(true);
    try {
      // EDIÇÃO: só altera campos do Firestore (nome/papel). E-mail/senha do Auth
      // de terceiros exigem Admin SDK no servidor, então não são editáveis aqui.
      const celularLimpo = celular.replace(/\D/g, ''); // só dígitos, sem DDD
      if (editUid) {
        await updateDoc(doc(db, 'membrosEquipe', editUid), { nome: nome.trim(), papel, celular: celularLimpo });
        await sincronizarLoginTelefone(celularLimpo, celularOriginal, email.trim());
        mostrar('ok', 'Membro atualizado.');
        fechar();
        carregar();
        return;
      }

      // NOVO: descobre o UID (cria no Auth ou usa o informado) e grava o papel.
      let uid: string;
      if (modoNovo) {
        if (!email.trim() || senha.length < 6) {
          mostrar('erro', 'Informe e-mail e uma senha de pelo menos 6 caracteres.');
          setSalvando(false);
          return;
        }
        uid = await criarUsuarioAuth(email, senha);
      } else {
        if (!uidExistente.trim()) {
          mostrar('erro', 'Informe o UID do usuário (aba Authentication do console).');
          setSalvando(false);
          return;
        }
        uid = uidExistente.trim();
      }

      await setDoc(doc(db, 'membrosEquipe', uid), {
        nome: nome.trim(),
        papel,
        ativo: true,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(celularLimpo ? { celular: celularLimpo } : {}),
      });
      await sincronizarLoginTelefone(celularLimpo, '', email.trim());

      mostrar('ok', 'Membro cadastrado com sucesso.');
      fechar();
      carregar();
    } catch (e: any) {
      console.error('Erro ao salvar membro:', e);
      const cod = e?.code;
      if (cod === 'auth/email-already-in-use') {
        mostrar('erro', 'Este e-mail já tem acesso. Use "Vincular UID existente".');
      } else if (cod === 'auth/invalid-email') {
        mostrar('erro', 'E-mail inválido.');
      } else if (cod === 'auth/weak-password') {
        mostrar('erro', 'Senha fraca (mínimo 6 caracteres).');
      } else {
        mostrar('erro', 'Erro ao salvar membro.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (m: Membro) => {
    if (m.uid === user?.uid) {
      mostrar('erro', 'Você não pode desativar o próprio acesso.');
      return;
    }
    try {
      await updateDoc(doc(db, 'membrosEquipe', m.uid), { ativo: !m.ativo });
      carregar();
    } catch (e) {
      console.error(e);
      mostrar('erro', 'Erro ao alterar o status.');
    }
  };

  const remover = async (m: Membro) => {
    if (m.uid === user?.uid) {
      mostrar('erro', 'Você não pode remover o próprio acesso.');
      return;
    }
    const ok = await confirmar({
      titulo: 'Remover acesso',
      mensagem: `Remover o acesso de ${m.nome}? A conta no Authentication continua existindo (remova-a no console se necessário).`,
      textoConfirmar: 'Remover',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'membrosEquipe', m.uid));
      if (m.celular) await deleteDoc(doc(db, 'loginTelefone', m.celular)).catch(() => {});
      mostrar('ok', 'Acesso removido.');
      carregar();
    } catch (e) {
      console.error(e);
      mostrar('erro', 'Erro ao remover.');
    }
  };

  const copiarUid = (uid: string) => {
    navigator.clipboard?.writeText(uid).then(
      () => mostrar('ok', 'UID copiado.'),
      () => {}
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users size={24} className="text-primary-600" /> Gestão de Equipe e Acessos
          </h1>
          <p className="text-gray-500 text-sm">Cadastre profissionais, defina papéis e controle quem acessa o prontuário.</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center justify-center bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={20} className="mr-2" /> Novo Acesso
        </button>
      </div>

      {feedback && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${feedback.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {feedback.msg}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {carregando ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : membros.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum membro cadastrado ainda.</p>
            <p className="text-xs mt-1">O primeiro admin precisa ser criado manualmente no console (veja SECURITY-SETUP.md).</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Papel</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-mail</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {membros.map((m) => (
                  <tr key={m.uid} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-800">{m.nome}</div>
                      <button
                        onClick={() => copiarUid(m.uid)}
                        className="text-[11px] text-gray-400 hover:text-primary-600 flex items-center gap-1 mt-0.5"
                        title="Copiar UID"
                      >
                        <Copy size={11} /> {m.uid.slice(0, 10)}…
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${CORES_PAPEL[m.papel]}`}>
                        {PAPEL_LABEL[m.papel]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div>{m.email || '—'}</div>
                      {m.celular && <div className="text-xs text-gray-400">📱 {m.celular}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {m.ativo ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                          <ShieldCheck size={14} /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                          <ShieldOff size={14} /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEdicao(m)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Editar">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => alternarAtivo(m)} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title={m.ativo ? 'Desativar' : 'Ativar'}>
                          {m.ativo ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                        </button>
                        <button onClick={() => remover(m)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Remover">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">{editUid ? 'Editar membro' : 'Novo acesso'}</h2>
              <button onClick={fechar} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Maria Souza"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Papel</label>
                <select
                  value={papel} onChange={(e) => setPapel(e.target.value as Papel)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                >
                  {PAPEIS.map((p) => (
                    <option key={p} value={p}>{PAPEL_LABEL[p]}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Família = somente leitura. Técnico/Enfermeiro/Médico/Admin editam dados clínicos. Admin gerencia a equipe.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Celular (sem DDD)</label>
                <input
                  type="tel" inputMode="numeric" maxLength={9}
                  value={celular}
                  onChange={(e) => setCelular(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ex: 957080582"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              {!editUid && (
                <>
                  <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
                    <button
                      type="button" onClick={() => setModoNovo(true)}
                      className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${modoNovo ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'}`}
                    >
                      Criar novo acesso
                    </button>
                    <button
                      type="button" onClick={() => setModoNovo(false)}
                      className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${!modoNovo ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500'}`}
                    >
                      Vincular UID existente
                    </button>
                  </div>

                  {modoNovo ? (
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">E-mail (login)</label>
                        <input
                          type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Senha provisória</label>
                        <input
                          type="text" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mínimo 6 caracteres"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">Combine com o profissional para ele trocar depois.</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <KeyRound size={14} /> UID (Authentication)
                      </label>
                      <input
                        type="text" value={uidExistente} onChange={(e) => setUidExistente(e.target.value)} placeholder="Cole o UID da aba Authentication"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 font-mono text-sm"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={fechar} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={salvar} disabled={salvando}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {salvando ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (editUid ? 'Salvar' : 'Cadastrar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Equipe;
