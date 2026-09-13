import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './auth/authContext';

export type AcaoAuditoria = 'criar' | 'editar' | 'excluir' | 'status';

export type EntidadeAuditoria =
  | 'medicamento'
  | 'agendamento'
  | 'historico'
  | 'metrica'
  | 'rotina-item'
  | 'rotina-execucao'
  | 'profissional'
  | 'documento'
  | 'paciente'
  | 'membro-equipe'
  | 'tecnico'
  | 'ponto-extra'
  | 'avaliacao-tarefa'
  | 'competicao'
  | 'escala'
  | 'plantao';

export const ACAO_LABEL: Record<AcaoAuditoria, string> = {
  criar: 'Criou',
  editar: 'Editou',
  excluir: 'Excluiu',
  status: 'Alterou status',
};

export const ENTIDADE_LABEL: Record<EntidadeAuditoria, string> = {
  medicamento: 'Medicamento',
  agendamento: 'Agendamento',
  historico: 'Registro do histórico',
  metrica: 'Métrica',
  'rotina-item': 'Item da rotina',
  'rotina-execucao': 'Checklist de plantão',
  profissional: 'Profissional',
  documento: 'Documento',
  paciente: 'Dados do paciente',
  'membro-equipe': 'Acesso da equipe',
  tecnico: 'Técnico de plantão',
  'ponto-extra': 'Pontos extras',
  'avaliacao-tarefa': 'Avaliação por tarefa',
  competicao: 'Competição',
  escala: 'Escala / folga',
  plantao: 'Encerramento de plantão',
};

/**
 * Hook para registrar ações na trilha de auditoria (coleção `auditoria`, imutável).
 * O registro é best-effort: uma falha aqui NUNCA deve interromper a ação principal.
 */
export const useAuditoria = () => {
  const { user, perfil } = useAuth();

  const registrar = async (
    acao: AcaoAuditoria,
    entidade: EntidadeAuditoria,
    entidadeId: string,
    resumo?: string
  ) => {
    if (!user) return; // sem sessão não há o que registrar

    try {
      await addDoc(collection(db, 'auditoria'), {
        quem: user.uid,
        quemNome: perfil?.nome ?? user.email ?? '—',
        papel: perfil?.papel ?? '—',
        acao,
        entidade,
        entidadeId: entidadeId || '—',
        resumo: resumo ?? '',
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      // Auditoria não pode derrubar a operação clínica; apenas registra a falha.
      console.error('Falha ao registrar auditoria:', e);
    }
  };

  return { registrar };
};
