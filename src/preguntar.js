import "dotenv/config";
import { pathToFileURL } from "node:url";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Chroma } from "@langchain/community/vectorstores/chroma";

// El mismo modelo de embeddings que usamos al guardar. Tiene que ser el mismo,
// si no, los vectores de la pregunta y los de los fragmentos no serían comparables.
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: process.env.GOOGLE_API_KEY,
});

// Conexión a la base-vectorial.js
// Los datos de conexión se leen del archivo .env
const baseVectorial = new Chroma(embeddings, {
  collectionName: process.env.COLLECTION_NAME,
  clientParams: {
    host: process.env.CHROMA_HOST,
    port: Number(process.env.CHROMA_PORT),
    ssl: false,
  },
});

// El modelo que redacta la respuesta
const modelo = new ChatGoogleGenerativeAI({
  model: "gemini-flash-lite-latest",
  apiKey: process.env.GOOGLE_API_KEY,
  maxRetries: 2, // si Gemini está saturado (error 503), reintenta 2 veces
});

// Cuántos fragmentos le pasamos a Gemini en cada pregunta
const FRAGMENTOS_A_USAR = 4;

export async function responder(pregunta) {
  //  Buscar en Chroma los fragmentos más parecidos a la pregunta
  const fragmentos = await baseVectorial.similaritySearch(pregunta, FRAGMENTOS_A_USAR);

  //  Juntar los fragmentos en un solo texto, indicando de dónde viene cada uno
  const contexto = fragmentos
    .map((t) => `[${t.metadata.fuente}, página ${t.metadata.pagina}]\n${t.pageContent}`)
    .join("\n\n---\n\n");

  //  Las instrucciones para Gemini: responder SOLO con la información de los documentos
  const instrucciones = `Eres un asistente que responde preguntas sobre documentos técnicos.
Responde en español, de forma clara y breve, usando ÚNICAMENTE la información de los documentos de abajo.
Si la respuesta no está en los documentos, di que no tienes esa información. No inventes nada.
Al final, indica de qué documento y página sacaste la información.

DOCUMENTOS:
${contexto}

PREGUNTA: ${pregunta}`;

  // 4. Pedirle la respuesta a Gemini
  const respuesta = await modelo.invoke(instrucciones);

  return {
    respuesta: respuesta.text,
    fuentes: fragmentos.map((t) => ({ fuente: t.metadata.fuente, pagina: t.metadata.pagina })),
  };
}

// Solo al ejecutar este archivo directamente. La pregunta se escribe después del nombre:
//   node src/preguntar.js "¿Cuántas cámaras tiene la tienda?"
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pregunta = process.argv[2] || "¿Cuántas cámaras tiene la tienda?";
  try {
    console.log("Pregunta:", pregunta);
    const { respuesta } = await responder(pregunta);
    console.log("\nRespuesta:", respuesta);
  } catch (error) {
    console.log("Hubo un error:");
    console.log(error.message);
  }
}
