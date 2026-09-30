# Envio do relatório de plantão para o S3

A tela **Encerrar Plantão** (menu visível só para técnicos) tira uma foto pela câmera
e a envia para um bucket S3. Por segurança, o app **não** guarda credenciais AWS:
ele pede uma **URL pré-assinada** ao seu API Gateway e faz o upload direto ao S3.

## Contrato esperado pelo app
`POST` em `VITE_S3_UPLOAD_URL` com JSON:
```json
{ "fileName": "relatorios-plantao/2026-...-tecnico.jpg", "contentType": "image/jpeg", "tecnico": "Maria" }
```
Resposta esperada:
```json
{ "uploadUrl": "https://<bucket>.s3.amazonaws.com/...&X-Amz-Signature=..." }
```
Em seguida o app faz `PUT uploadUrl` com o arquivo (mesmo `Content-Type`).

## 1. Bucket S3 + CORS
No bucket, em **Permissions → CORS**:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": [
      "https://prontuario.elohomecare.com.br",
      "http://localhost:5173",
      "https://localhost",
      "capacitor://localhost"
    ],
    "ExposeHeaders": []
  }
]
```

> ⚠️ **Atenção ao APK.** O PUT sai do navegador direto para o S3, então a origem
> que conta é a do WebView do aplicativo — **não** o domínio do site. Conforme o
> empacotador, ela costuma ser `https://localhost`, `capacitor://localhost` ou
> até `null` (quando a página é carregada de `file://`).
>
> Se o envio falha **só no APK** e funciona no navegador, é isso. A tela
> "Encerrar Plantão" mostra a origem real na caixa de erro quando o envio falha
> — use exatamente aquele valor aqui.
>
> Origem `null` não dá para liberar pelo nome: nesse caso use
> `"AllowedOrigins": ["*"]`. Isso não abre o bucket, porque quem autoriza a
> escrita é a URL pré-assinada (válida por 5 minutos) — mas veja a observação
> de segurança no fim deste documento.

### Como confirmar que o problema é CORS
Os logs da Lambda mostram a invocação terminando **sem erro**, e mesmo assim o
upload falha. Isso é a assinatura do problema: o passo 1 (pedir a URL) passou
pela Lambda, e o passo 2 (PUT no S3) nem chega a ser registrado ali, porque vai
direto para o bucket.

## 2. Lambda (Node.js 18+, AWS SDK v3) — gera a URL pré-assinada
```js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: "us-east-1" });
const BUCKET = "SEU_BUCKET";

export const handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
  if (event.requestContext?.http?.method === "OPTIONS")
    return { statusCode: 204, headers: cors, body: "" };

  const { fileName, contentType } = JSON.parse(event.body || "{}");
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: fileName, ContentType: contentType || "image/jpeg" }),
    { expiresIn: 300 }
  );
  return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ uploadUrl }) };
};
```
Dê à role da Lambda a permissão `s3:PutObject` no bucket. Habilite **CORS** também no API Gateway.

## 3. Configurar o app
Defina a variável de ambiente com a URL do endpoint do API Gateway:
- **Local:** no `.env` → `VITE_S3_UPLOAD_URL=https://xxxx.execute-api.us-east-1.amazonaws.com/prd/upload`
- **Vercel:** Settings → Environment Variables → `VITE_S3_UPLOAD_URL` (e Redeploy).

Sem essa variável, a tela avisa que o envio não está configurado.

## 4. Diagnóstico quando o envio falha

A tela mostra em qual das duas etapas quebrou, e o detalhe fica **fixo na tela**
(não some como o aviso), para a técnica tirar print e mandar.

| Mensagem | O que investigar |
| --- | --- |
| "Não foi possível falar com o servidor de envio" | Internet, ou CORS/rota do API Gateway. **Não aparece invocação na Lambda.** |
| "O servidor de envio respondeu 4xx/5xx" | Erro dentro da Lambda ou permissão `s3:PutObject` faltando na role. Veja os logs. |
| "não mandou o endereço de upload (uploadUrl)" | A Lambda respondeu 200 com o corpo fora do contrato. Confira se o JSON tem a chave `uploadUrl`. |
| "A foto não chegou ao armazenamento" | **CORS do bucket** — veja a seção 1. É o caso do APK. |
| "O armazenamento recusou a foto (403)" | URL expirada (>5 min) ou `Content-Type` do PUT diferente do que foi assinado. |

## ⚠️ Pendência de segurança

O endpoint do API Gateway é **público e sem autenticação**, e a URL está no
bundle do app. Quem a descobrir consegue pedir uma URL pré-assinada e gravar
arquivos no bucket. Para fechar, o caminho é validar o token do Firebase dentro
da Lambda (o app já manda o usuário logado) antes de assinar a URL.
