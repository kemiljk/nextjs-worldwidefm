import fs from "fs";
import path from "path";
import { getAllShowsFromMixcloud } from "../lib/mixcloud-service";

async function main() {
  console.log("Fetching all shows from Mixcloud...");
  const shows = await getAllShowsFromMixcloud();

  // Create the data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  // Save the shows to a JSON file
  const filePath = path.join(dataDir, "archive.json");
  fs.writeFileSync(filePath, JSON.stringify(shows, null, 2));

  console.log(`Successfully saved ${shows.length} shows to ${filePath}`);
}

main().catch(console.error);
