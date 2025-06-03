const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env.local") }); // Load .env.local

// const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai"); // OLD
const OpenAI = require("openai"); // NEW
const { z } = require("zod"); // NEW
const { zodResponseFormat } = require("openai/helpers/zod"); // NEW

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CANDIDATES_FILE = path.join(__dirname, "llm_review_candidates.txt");
const OUTPUT_FILE = path.join(__dirname, "llm_genre_classifications.json");

const BATCH_SIZE = 15; // Number of titles to process per batch

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set in your .env.local file. Please add it and try again.");
  process.exit(1);
}

// NEW: Initialize OpenAI client for Gemini
const openai = new OpenAI({
  apiKey: GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", // IMPORTANT: OpenAI-compatible Gemini endpoint
});

// NEW: Define Zod schema for the expected response array
const LLMClassificationResponseSchema = z.object({
  original_term: z.string(),
  classification: z.enum(["Music Genre", "Person Name", "Location", "Organization/Label", "Content Type/Format", "Other"]),
  standardized_genre_name: z.string().nullable(),
  reasoning: z.string(),
});

const LLMClassificationBatchResponseSchema = z.array(LLMClassificationResponseSchema);

// const genAI = new GoogleGenerativeAI(GEMINI_API_KEY); // OLD
// const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // OLD

// generationConfig and safetySettings are handled differently or have defaults with OpenAI SDK,
// or would be part of the `create` call if needed.
// For now, we'll rely on defaults and the specific model's capabilities.

// Renamed and adapted to classify a batch of genre titles
async function classifyBatchWithLLM(genreTitles) {
  // Prompt adapted for batch processing
  const promptMessages = [
    {
      role: "system",
      content: `
        You are a music and media content classification expert.
        You will be given a list of terms, one per line.
        For each term, determine if it is primarily:
        1. A music genre.
        2. A person's name (e.g., DJ, artist, host).
        3. A location (e.g., city, country, region).
        4. An organization or label (e.g., record label, festival name, radio station).
        5. A content type or format (e.g., "live", "mix", "podcast").
        6. Other (if none of the above fit well).

        Please respond ONLY with a JSON array. Each element in the array must be a JSON object with the following structure:
        {
          "original_term": "The original input term",
          "classification": "Music Genre" | "Person Name" | "Location" | "Organization/Label" | "Content Type/Format" | "Other",
          "standardized_genre_name": "If classification is 'Music Genre', provide the most common and standardized English name for this genre. Otherwise, null.",
          "reasoning": "Briefly explain your classification."
        }

        Ensure the array contains one object for each input term, in the same order as the input.
        Ensure all string values within the JSON objects are properly escaped for JSON validity (e.g., double quotes inside strings should be \\", newlines inside strings should be \\n).
      `,
    },
    {
      role: "user",
      content: `Input terms:\n${genreTitles.join("\n")}`,
    },
  ];

  let retries = 0;
  const maxRetries = 5;
  let delay = 1000; // Initial delay 1 second

  while (retries < maxRetries) {
    try {
      console.log(`Querying LLM for batch of ${genreTitles.length} terms...${retries > 0 ? ` (Attempt ${retries + 1})` : ""}`);

      // Using OpenAI SDK with Zod for parsing the array response
      const completion = await openai.beta.chat.completions.parse({
        model: "gemini-2.0-flash", // Still using a Gemini model
        messages: promptMessages,
        response_format: zodResponseFormat(LLMClassificationBatchResponseSchema, "LLMClassificationBatchResponse"),
        // Temperature and other params can be added here if needed, e.g., temperature: 0.3
      });

      const parsedResponse = completion.choices[0].message.parsed;
      console.log(`LLM Response received for batch. Parsed ${parsedResponse.length} classifications.`);
      // Basic check to ensure the number of responses matches the number of inputs
      if (!Array.isArray(parsedResponse) || parsedResponse.length !== genreTitles.length) {
        throw new Error(`Received unexpected number of classifications in batch response. Expected ${genreTitles.length}, got ${parsedResponse.length}.`);
      }
      return parsedResponse; // Success, exit retry loop
    } catch (error) {
      if (error.status === 429 && retries < maxRetries - 1) {
        console.warn(`Rate limit hit for batch. Retrying in ${delay / 1000}s... (Retry ${retries + 1}/${maxRetries - 1})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        retries++;
      } else {
        console.error(`Error classifying batch with LLM via OpenAI SDK (Attempt ${retries + 1}):`, error);
        // Return error objects for all items in the batch if the batch call fails
        return genreTitles.map((title) => ({
          original_term: title,
          classification: "Error",
          standardized_genre_name: null,
          reasoning: `LLM API call failed for batch after ${retries + 1} attempts: ${error.message}`,
        }));
      }
    }
  }
  // Should not be reached if maxRetries is sensible, but as a fallback:
  return genreTitles.map((title) => ({
    original_term: title,
    classification: "Error",
    standardized_genre_name: null,
    reasoning: `LLM API call failed for batch after ${maxRetries} retries due to persistent rate limiting.`,
  }));
}

async function main() {
  let existingClassifications = [];
  const processedTitles = new Set();

  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const existingData = fs.readFileSync(OUTPUT_FILE, "utf-8");
      if (existingData.trim() !== "") {
        existingClassifications = JSON.parse(existingData);
        if (Array.isArray(existingClassifications)) {
          existingClassifications.forEach((item) => {
            if (item && item.original_term) {
              processedTitles.add(item.original_term);
            }
          });
          console.log(`Loaded ${processedTitles.size} previously classified terms from ${OUTPUT_FILE}`);
        } else {
          console.warn(`Warning: ${OUTPUT_FILE} does not contain a valid JSON array. Starting fresh.`);
          existingClassifications = []; // Reset if not an array
        }
      }
    } catch (e) {
      console.warn(`Warning: Could not parse ${OUTPUT_FILE}. If it contains data, it might be corrupted. Starting fresh or with partial data if any was loaded. Error: ${e.message}`);
      existingClassifications = []; // Reset on parse error
    }
  }

  if (!fs.existsSync(CANDIDATES_FILE)) {
    console.log(`Candidates file not found: ${CANDIDATES_FILE}`);
    console.log("Please run the refine-genres.js script first to generate candidates.");
    return;
  }

  const candidateTitles = fs
    .readFileSync(CANDIDATES_FILE, "utf-8")
    .split("\n")
    .map((title) => title.trim())
    .filter((title) => title.length > 0);

  const titlesToProcess = candidateTitles.filter((title) => !processedTitles.has(title));

  if (titlesToProcess.length === 0) {
    console.log("No new candidates to classify.");
    if (processedTitles.size > 0) {
      console.log(`All ${processedTitles.size} candidates were already classified.`);
    }
    return;
  }

  console.log(`Found ${candidateTitles.length} total candidates. ${titlesToProcess.length} new candidates to classify.`);

  const newClassifications = []; // Store only newly fetched classifications in this run
  let processedCountInRun = 0;

  // Process candidates in batches
  for (let i = 0; i < titlesToProcess.length; i += BATCH_SIZE) {
    const batch = titlesToProcess.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch starting with "${batch[0]}" (${batch.length} items)...`);

    const batchClassifications = await classifyBatchWithLLM(batch);
    newClassifications.push(...batchClassifications);
    processedCountInRun += batch.length;
    console.log(`Finished batch. Processed ${processedCountInRun} of ${titlesToProcess.length} new candidates.`);

    // Delay between batches
    if (i + BATCH_SIZE < titlesToProcess.length) {
      console.log(`Waiting 500ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Combine existing classifications with new ones
  const allClassifications = [...existingClassifications, ...newClassifications];

  if (processedTitles.size > 0) {
    console.log(`\nLoaded ${processedTitles.size} classifications from previous run.`);
  }
  console.log(`Processed ${newClassifications.length} new candidates in this run.`);
  console.log(`Total classified terms: ${allClassifications.length}`);

  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allClassifications, null, 2));
    console.log(`\nClassifications saved to: ${OUTPUT_FILE}`);
  } catch (ioError) {
    console.error("\nError writing classifications file:", ioError);
  }
}

main().catch(console.error);
