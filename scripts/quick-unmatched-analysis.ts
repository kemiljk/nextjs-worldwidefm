import { createBucketClient } from "@cosmicjs/sdk";
import * as fs from "fs/promises";
import * as path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
  writeKey: process.env.COSMIC_WRITE_KEY as string,
});

interface CosmicHost {
  id: string;
  title: string;
  slug: string;
  type: string;
  created_at: string;
  status: string;
}

interface CraftCategory {
  id: number;
  title: string;
  slug: string;
  uri: string;
  thumbnail: string[];
}

async function quickUnmatchedAnalysis() {
  try {
    console.log("🔍 Quick analysis of unmatched items...");

    // Load the previous analysis results
    const analysisPath = path.join(__dirname, "regular-hosts-analysis.json");
    const analysisData = await fs.readFile(analysisPath, "utf8");
    const analysis = JSON.parse(analysisData);

    const noMatches = analysis.noMatches;
    console.log(`📊 Analyzing ${noMatches.length} unmatched items...`);

    // Get all Cosmic hosts
    const allHosts: CosmicHost[] = [];
    let page = 1;
    const limit = 100;

    while (true) {
      const response = await cosmic.objects.find({
        type: "regular-hosts",
        props: "id,title,slug,type,created_at,status",
        limit: limit,
        skip: (page - 1) * limit,
        status: "published",
      });

      if (!response.objects || response.objects.length === 0) break;

      const hosts = response.objects as CosmicHost[];
      allHosts.push(...hosts);

      if (hosts.length < limit) break;
      page++;
    }

    console.log(`📊 Loaded ${allHosts.length} Cosmic hosts`);

    // Create efficient lookup structures
    const hostTitles = new Set(allHosts.map((h) => h.title.toLowerCase()));
    const hostSlugs = new Set(allHosts.map((h) => h.slug));
    const hostWords = new Set<string>();

    // Extract all words from host titles
    allHosts.forEach((host) => {
      const words = host.title
        .toLowerCase()
        .split(/[\s:]+/)
        .filter((w) => w.length > 2);
      words.forEach((word) => hostWords.add(word));
    });

    console.log(`📊 Created lookup sets: ${hostTitles.size} titles, ${hostSlugs.size} slugs, ${hostWords.size} words`);

    // Analyze unmatched items efficiently
    const results = {
      personNameExtracted: [] as any[],
      nameAtEnd: [] as any[],
      wordMatches: [] as any[],
      containedMatches: [] as any[],
      noMatches: [] as any[],
    };

    for (const category of noMatches) {
      let foundMatch = false;

      // Pattern 1: "Show Name: Person Name" format
      if (category.title.includes(":")) {
        const parts = category.title.split(":");
        const personName = parts[1].trim();

        if (hostTitles.has(personName.toLowerCase())) {
          const host = allHosts.find((h) => h.title.toLowerCase() === personName.toLowerCase())!;
          results.personNameExtracted.push({
            category: category.title,
            host: host.title,
            reason: `Extracted "${personName}" from "${category.title}"`,
          });
          foundMatch = true;
        }
      }

      // Pattern 2: Look for host names at the end of titles
      if (!foundMatch) {
        const words = category.title.split(" ");
        if (words.length > 2) {
          // Try last 1-3 words as potential names
          for (let i = 1; i <= 3; i++) {
            const possibleName = words.slice(-i).join(" ");
            if (hostTitles.has(possibleName.toLowerCase())) {
              const host = allHosts.find((h) => h.title.toLowerCase() === possibleName.toLowerCase())!;
              results.nameAtEnd.push({
                category: category.title,
                host: host.title,
                reason: `Found "${possibleName}" at end of "${category.title}"`,
              });
              foundMatch = true;
              break;
            }
          }
        }
      }

      // Pattern 3: Check for word matches
      if (!foundMatch) {
        const titleWords = category.title
          .toLowerCase()
          .split(/[\s:]+/)
          .filter((w) => w.length > 2);
        for (const word of titleWords) {
          if (hostWords.has(word)) {
            const matchingHosts = allHosts.filter((h) =>
              h.title
                .toLowerCase()
                .split(/[\s:]+/)
                .includes(word)
            );
            if (matchingHosts.length > 0) {
              const host = matchingHosts[0]; // Take first match
              results.wordMatches.push({
                category: category.title,
                host: host.title,
                reason: `Word "${word}" matches "${host.title}"`,
              });
              foundMatch = true;
              break;
            }
          }
        }
      }

      // Pattern 4: Check if any host is contained in the title
      if (!foundMatch) {
        for (const host of allHosts) {
          if (category.title.toLowerCase().includes(host.title.toLowerCase())) {
            results.containedMatches.push({
              category: category.title,
              host: host.title,
              reason: `Host "${host.title}" contained in "${category.title}"`,
            });
            foundMatch = true;
            break;
          }
        }
      }

      if (!foundMatch) {
        results.noMatches.push(category.title);
      }
    }

    // Print results
    console.log("\n" + "=".repeat(80));
    console.log("🔍 QUICK UNMATCHED ITEMS ANALYSIS");
    console.log("=".repeat(80));

    let totalNewMatches = 0;

    if (results.personNameExtracted.length > 0) {
      console.log(`\n✅ PERSON NAME EXTRACTED (${results.personNameExtracted.length}):`);
      results.personNameExtracted.forEach((match) => {
        console.log(`   • "${match.category}" ↔ "${match.host}"`);
        console.log(`     ${match.reason}`);
        totalNewMatches++;
      });
    }

    if (results.nameAtEnd.length > 0) {
      console.log(`\n✅ NAME AT END (${results.nameAtEnd.length}):`);
      results.nameAtEnd.forEach((match) => {
        console.log(`   • "${match.category}" ↔ "${match.host}"`);
        console.log(`     ${match.reason}`);
        totalNewMatches++;
      });
    }

    if (results.wordMatches.length > 0) {
      console.log(`\n✅ WORD MATCHES (${results.wordMatches.length}):`);
      results.wordMatches.forEach((match) => {
        console.log(`   • "${match.category}" ↔ "${match.host}"`);
        console.log(`     ${match.reason}`);
        totalNewMatches++;
      });
    }

    if (results.containedMatches.length > 0) {
      console.log(`\n✅ CONTAINED MATCHES (${results.containedMatches.length}):`);
      results.containedMatches.forEach((match) => {
        console.log(`   • "${match.category}" ↔ "${match.host}"`);
        console.log(`     ${match.reason}`);
        totalNewMatches++;
      });
    }

    console.log(`\n❌ STILL NO MATCHES (${results.noMatches.length}):`);
    results.noMatches.forEach((title) => {
      console.log(`   • "${title}"`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("📈 IMPROVED MATCHING SUMMARY");
    console.log("=".repeat(80));

    const originalUnmatched = noMatches.length;
    const newMatches = totalNewMatches;
    const stillUnmatched = results.noMatches.length;
    const originalCoverage = 74.1; // From previous analysis
    const newCoverage = ((278 - stillUnmatched) / 278) * 100;

    console.log(`\n📊 Original unmatched: ${originalUnmatched}`);
    console.log(`✅ New potential matches found: ${newMatches}`);
    console.log(`❌ Still unmatched: ${stillUnmatched}`);
    console.log(`📈 Coverage improvement: ${originalCoverage.toFixed(1)}% → ${newCoverage.toFixed(1)}% (+${(newCoverage - originalCoverage).toFixed(1)}%)`);

    // Save results
    const output = {
      summary: {
        originalUnmatched,
        newMatches,
        stillUnmatched,
        originalCoverage,
        newCoverage,
        improvement: newCoverage - originalCoverage,
      },
      results,
      timestamp: new Date().toISOString(),
    };

    const resultsPath = path.join(__dirname, "quick-unmatched-analysis.json");
    await fs.writeFile(resultsPath, JSON.stringify(output, null, 2));
    console.log(`\n💾 Results saved to: ${resultsPath}`);
  } catch (error) {
    console.error("💥 Error in quick analysis:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
  }
}

// Run the analysis
quickUnmatchedAnalysis()
  .then(() => {
    console.log("\n✅ Quick analysis complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Quick analysis failed:", error);
    process.exit(1);
  });
