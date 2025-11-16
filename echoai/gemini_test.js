// Import the correct class name (GoogleGenAI with a capital I)
import { GoogleGenAI } from "@google/genai";

// Import and configure dotenv to load environment variables
import "dotenv/config";

// --- Configuration ---

// 1. Get your API key from the .env file
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 2. Check if the key exists
if (!GEMINI_API_KEY) {
  throw new Error(
    "GEMINI_API_KEY environment variable is not set. Please create a .env file and add it."
  );
}

// 3. Initialize the client with the API key
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// --- Main Function ---

async function main() {
  console.log("Connecting to Gemini...");

  try {
    
    // Send the prompt
    const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",// Correct way to reference the model
        contents: "Explain how AI works in a few words",
    });

    console.log(result.text);


  } catch (error) {
    // Log a more helpful error message
    console.error(
      "An error occurred while communicating with the Gemini API:",
      error
    );
  }
}

// Run the main function
await main();