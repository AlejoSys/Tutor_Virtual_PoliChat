import "dotenv/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// Comprobamos que la clave
const clave = process.env.GOOGLE_API_KEY;
console.log("¿Se leyó la clave?", clave ? "Sí, de " + clave.length + " caracteres" : "NO");

const modelo = new ChatGoogleGenerativeAI({
  model: "gemini-flash-lite-latest",
  apiKey: clave,
  maxRetries: 0, // que no reintente en silencio
});

try {
  console.log("Preguntando a Gemini...");
  const respuesta = await modelo.invoke("Explica en una frase qué es un chatbot.");
  console.log("Respuesta:", respuesta.text);
} catch (error) {
  console.log("Hubo un error:");
  console.log(error.message);
}