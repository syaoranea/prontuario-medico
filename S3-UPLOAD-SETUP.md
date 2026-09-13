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
    "AllowedOrigins": ["https://prontuario.elohomecare.com.br", "http://localhost:5173"],
    "ExposeHeaders": []
  }
]
```

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
