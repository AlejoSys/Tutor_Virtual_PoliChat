import "dotenv/config";
import path from "node:path";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { CargarYFragmentar } from "./cargar-pdf.js";

// Modelo que convierte texto en vectores (listas de números que representan el significado)
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: process.env.GOOGLE_API_KEY,
});

// Conexión con el servidor de Chroma Tiene que estar arrancado en otra terminal con:

// Una "colección" es como una tabla: aquí guardamos todos los fragmentos de los PDFs
// Los datos de conexión se leen del archivo .env
const baseVectorial = new Chroma(embeddings, {
  collectionName: process.env.COLLECTION_NAME,
  clientParams: {
    host: process.env.CHROMA_HOST,
    port: Number(process.env.CHROMA_PORT),
    ssl: false,
  },
});

try {
  // 1. Leer los PDFs y partirlos en fragmentos.
  console.log("Leyendo PDFs...");
  const fragmentos = await CargarYFragmentar();

  // 2. Dejar solo los metadatos que nos interesan. Chroma no acepta datos anidados,
  //    y PDFLoader mete mucha información del PDF que no necesitamos.
  const fragmentosLimpios = fragmentos.map((fragmento) => ({
    pageContent: fragmento.pageContent,
    metadata: {
      fuente: path.basename(fragmento.metadata.source),
      pagina: fragmento.metadata.loc.pageNumber,
    },
  }));

  // 3. Un id fijo por fragmento (archivo + página + posición). Así, si ejecutas este archivo
  //    otra vez, se sobrescriben los fragmentos en lugar de guardarse repetidos.
  const ids = fragmentosLimpios.map(
    (fragmento, i) => `${fragmento.metadata.fuente}-p${fragmento.metadata.pagina}-${i}`
  );

  // 4. Convertir cada fragmento en vector con Gemini y guardarlo en Chroma
  console.log(`Guardando ${fragmentosLimpios.length} fragmentos en Chroma...`);
  await baseVectorial.addDocuments(fragmentosLimpios, { ids });
  console.log("¡Listo! Fragmentos guardados.");

  // 5. Prueba rápida: buscar los 2 fragmentos que más se parecen a una pregunta
  const pregunta = "¿Qué secciones debe tener el trabajo de grado?";
  console.log(`\nPrueba de búsqueda: "${pregunta}"`);
  const resultados = await baseVectorial.similaritySearch(pregunta, 2);
  for (const doc of resultados) {
    console.log(`\n--- ${doc.metadata.fuente}, página ${doc.metadata.pagina} ---`);
    console.log(doc.pageContent.slice(0, 300) + "...");
  }
} catch (error) {
  console.log("Hubo un error:");
  console.log(error.message);
}
