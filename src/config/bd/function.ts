import { doc, getDoc, getFirestore } from "firebase/firestore";
import { app } from "../firebase";

export const buscarUsuarioPorId = async () => {
  const db = getFirestore(app);

  try {
    const docRef = doc(db, "usuario", "UIIq0FCc4Y44uWKMY5zB"); // "usuarios" é o nome da coleção
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const dados = docSnap.data();
      console.log("Dados do usuário:", dados);
      return dados;
    } else {
      console.log("Usuário não encontrado.");
      return null;
    }
  } catch (erro) {
    console.error("Erro ao buscar usuário:", erro);
    return null;
  }
};
  
export const buscarInformacaoMedicas = async () => {
  const db = getFirestore(app);

  try {
    const docRef = doc(db, "Informacoes-medicas", "OhKdzmQi2tdndifth20Q"); // "usuarios" é o nome da coleção
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const dados = docSnap.data();
      console.log("Dados do Informacao Medicas:", dados);
      return dados;
    } else {
      console.log("Informacao Medicas não encontrado.");
      return null;
    }
  } catch (erro) {
    console.error("Erro ao buscar Informacao Medicas:", erro);
    return null;
  }
};