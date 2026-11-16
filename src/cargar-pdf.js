import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// Carpeta donde van los PDFs del chatbot
const CARPETA_DOCS = "docs";

// Lee todos los PDFs de la carpeta y los parte en fragmentos
// La exportamos para reutilizarla en el paso 3
export async function CargarYFragmentar(carpeta = CARPETA_DOCS) {
  // 1. Buscar los PDFs de la carpeta
  const archivos = (await readdir(carpeta)).filter((a) => a.toLowerCase().endsWith(".pdf"));
  if (archivos.length === 0) {
    throw new Error(`No hay ningún PDF en la carpeta "${carpeta}"`);
  }

  // 2. Extraer el texto. PDFLoader devuelve un "documento" por cada página.
  const paginas = [];
  for (const archivo of archivos) {
    const loader = new PDFLoader(path.join(carpeta, archivo));
    const docs = await loader.load();
    console.log(`- ${archivo}: ${docs.length} páginas`);
    paginas.push(...docs);
  }

  // 3. Dividirnp en fragmentos. Cada fragmento tiene como máximo 1000 caracteres,
  //    y se solapa 200 con el anterior para no cortar una idea por la mitad.
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  return splitter.splitDocuments(paginas);
}

// Esto solo se ejecuta al lanzar el archivo directamente (node src/cargar-pdf.js),
// no cuando otro archivo importa CargarYFragmentar
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(`Leyendo PDFs de la carpeta "${CARPETA_DOCS}"...`);
    const fragmentos = await CargarYFragmentar();
    console.log(`\nTotal: ${fragmentos.length} fragmentos`);
    console.log("\nEjemplo, el primer fragmento:");
    console.log("Texto:", fragmentos[0].pageContent);
    console.log("Página:", fragmentos[0].metadata.loc?.pageNumber);
  } catch (error) {
    console.log("Hubo un error:");
    console.log(error.message);
  }
}
