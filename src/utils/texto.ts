// Normaliza nome para comparação: sem acentos, sem caixa e sem espaço extra.
// O nome gravado no plantão vem da aba Técnicos e nem sempre está grafado igual
// ao do perfil de acesso (membrosEquipe) — sem isso o técnico não encontraria
// os próprios plantões nem os próprios alertas.
export const normalizarNome = (nome?: string) =>
  (nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
