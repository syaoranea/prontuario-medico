# Ativação de Segurança (Auth + Regras)

Este projeto agora exige **login** e tem **regras de Firestore/Storage** versionadas.
Enquanto os passos abaixo não forem feitos, ninguém consegue entrar no app.

## 1. Habilitar o provedor de login

No [Firebase Console](https://console.firebase.google.com/) → **Authentication** → **Sign-in method** →
habilite **E-mail/senha**.

## 2. Criar os usuários da equipe

Em **Authentication → Users → Add user**, crie um e-mail/senha para cada profissional
(técnico, enfermeiro, médico, família, admin). Anote o **UID** gerado de cada um.

## 3. Cadastrar o papel de cada usuário

O papel de acesso vive na coleção **`membrosEquipe`**, com o **ID do documento = UID** do usuário.
Crie um documento por usuário (Firestore Console ou script):

```
membrosEquipe/{uid} = {
  nome:  "Maria Souza",
  papel: "tecnico",     // tecnico | enfermeiro | medico | familia | admin
  ativo: true
}
```

- **tecnico / enfermeiro / medico / admin** → leem e **editam** dados clínicos.
- **familia** → **somente leitura**.
- **admin** → único que pode gerenciar a coleção `membrosEquipe`.

> Crie pelo menos **um `admin`** primeiro — é quem cadastra os demais papéis.
> Depois do primeiro admin, **os outros membros são criados pela tela "Equipe e Acessos"** dentro do app
> (menu lateral, visível só para admin), sem precisar mexer no console.

## 4. Publicar as regras de segurança

As regras estão em `firestore.rules` e `storage.rules` (referenciadas por `firebase.json`).

```bash
npm install -g firebase-tools      # se ainda não tiver
firebase login
firebase use <SEU_PROJECT_ID>      # o mesmo de VITE_FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules,storage
```

## 5. Validar

1. `npm run dev` → deve abrir a **tela de login**.
2. Entrar com um usuário `familia` → o menu **não** mostra Medicamentos/Agendamentos/Profissionais/Configurações,
   e tentar acessar essas URLs redireciona para o Dashboard.
3. Entrar com `admin`/equipe clínica → acesso completo.
4. No console do Firebase, confirmar que leituras anônimas (sem token) são **negadas**.

## Trilha de auditoria

Já implementada (coleção **`auditoria`**, imutável — regras em `firestore.rules`). Registra
`quem / papel / ação / entidade / resumo / timestamp` nas ações clínicas. Visível em
**Auditoria** no menu (papéis enfermeiro/médico/admin). Instrumenta: medicamentos, histórico
médico, checklist de plantão, agendamentos (incl. "concluir atendimento"), métricas,
profissionais, documentos e edição dos dados do paciente.

## Pendências de segurança ainda em aberto (próximas etapas)

- **Custom Claims** para refletir o papel no token e endurecer também as regras de Storage
  (hoje o Storage exige apenas estar autenticado).
- Migrar os IDs de paciente/usuário hardcoded (`config/bd/function.ts`, `Configuracoes.tsx`)
  para um modelo multi-paciente.
- Trocar a chave da API Gateway AWS hardcoded em `Medicamentos.tsx` por variável de ambiente.
