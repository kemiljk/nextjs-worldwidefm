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

async function analyzeRegularHosts() {
  try {
    console.log("🔍 Fetching all regular-hosts from Cosmic...");

    // First, let's get the total count
    const countResponse = await cosmic.objects.find({
      type: "regular-hosts",
      props: "id",
      limit: 1,
      status: "published",
    });

    const totalCount = countResponse.total || 0;
    console.log(`📊 Total regular-hosts reported by Cosmic: ${totalCount}`);

    const allHosts: CosmicHost[] = [];
    let page = 1;
    const limit = 100;

    while (true) {
      console.log(`📄 Fetching page ${page} (skip: ${(page - 1) * limit})...`);

      const response = await cosmic.objects.find({
        type: "regular-hosts",
        props: "id,title,slug,type,created_at,status",
        limit: limit,
        skip: (page - 1) * limit,
        status: "published",
      });

      console.log(`📄 Response: ${response.objects?.length || 0} objects, total: ${response.total}, hasMore: ${response.objects && response.objects.length === limit}`);

      if (!response.objects || response.objects.length === 0) {
        console.log(`📄 No more hosts found on page ${page}`);
        break;
      }

      const hosts = response.objects as CosmicHost[];
      allHosts.push(...hosts);
      console.log(`📄 Page ${page}: Found ${hosts.length} hosts (Total so far: ${allHosts.length}/${totalCount})`);

      // If we got fewer than the limit, we've reached the end
      if (hosts.length < limit) {
        console.log(`📄 Reached end: got ${hosts.length} hosts (less than limit ${limit})`);
        break;
      }

      // Safety check: if we've fetched more than the reported total, something's wrong
      if (allHosts.length >= totalCount) {
        console.log(`📄 Reached reported total: ${allHosts.length}/${totalCount}`);
        break;
      }

      // Safety check: don't go beyond 10 pages to prevent infinite loops
      if (page >= 10) {
        console.log(`⚠️  Safety limit reached: stopped at page ${page} to prevent infinite loop`);
        break;
      }

      page++;

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(`\n📊 Total regular-hosts fetched from Cosmic: ${allHosts.length}`);

    // Read the categories.json file
    console.log("\n📖 Reading categories.json...");
    const categoriesPath = path.join(__dirname, "categories.json");
    const categoriesData = await fs.readFile(categoriesPath, "utf8");
    const craftCategories: CraftCategory[] = JSON.parse(categoriesData);

    console.log(`📊 Total categories in Craft JSON: ${craftCategories.length}`);

    // Analyze potential matches
    console.log("\n🔍 Analyzing potential matches...");

    const matches: { craft: CraftCategory; cosmic: CosmicHost; matchType: string; confidence: number }[] = [];
    const potentialMatches: { craft: CraftCategory; cosmic: CosmicHost; matchType: string; confidence: number }[] = [];
    const noMatches: CraftCategory[] = [];

    for (const craftCategory of craftCategories) {
      let bestMatch: CosmicHost | null = null;
      let bestMatchType = "";
      let bestConfidence = 0;

      for (const cosmicHost of allHosts) {
        // Exact title match
        if (craftCategory.title.toLowerCase() === cosmicHost.title.toLowerCase()) {
          if (bestConfidence < 1.0) {
            bestMatch = cosmicHost;
            bestMatchType = "exact_title";
            bestConfidence = 1.0;
          }
        }
        // Exact slug match
        else if (craftCategory.slug === cosmicHost.slug) {
          if (bestConfidence < 0.95) {
            bestMatch = cosmicHost;
            bestMatchType = "exact_slug";
            bestConfidence = 0.95;
          }
        }
        // Contains match (craft title contains cosmic title or vice versa)
        else if (craftCategory.title.toLowerCase().includes(cosmicHost.title.toLowerCase()) || cosmicHost.title.toLowerCase().includes(craftCategory.title.toLowerCase())) {
          const confidence = Math.min(cosmicHost.title.length / Math.max(craftCategory.title.length, cosmicHost.title.length), craftCategory.title.length / Math.max(craftCategory.title.length, cosmicHost.title.length));
          if (confidence > bestConfidence && confidence > 0.6) {
            bestMatch = cosmicHost;
            bestMatchType = "contains";
            bestConfidence = confidence;
          }
        }
        // Fuzzy slug match (similar slugs)
        else {
          const craftWords = craftCategory.slug.split("-");
          const cosmicWords = cosmicHost.slug.split("-");

          let commonWords = 0;
          let totalWords = Math.max(craftWords.length, cosmicWords.length);

          for (const craftWord of craftWords) {
            if (cosmicWords.includes(craftWord)) {
              commonWords++;
            }
          }

          const confidence = commonWords / totalWords;
          if (confidence > bestConfidence && confidence > 0.5) {
            bestMatch = cosmicHost;
            bestMatchType = "fuzzy_slug";
            bestConfidence = confidence;
          }
        }
      }

      if (bestMatch && bestConfidence >= 0.8) {
        matches.push({
          craft: craftCategory,
          cosmic: bestMatch,
          matchType: bestMatchType,
          confidence: bestConfidence,
        });
      } else if (bestMatch && bestConfidence >= 0.6) {
        potentialMatches.push({
          craft: craftCategory,
          cosmic: bestMatch,
          matchType: bestMatchType,
          confidence: bestConfidence,
        });
      } else {
        noMatches.push(craftCategory);
      }
    }

    // Print results
    console.log("\n" + "=".repeat(80));
    console.log("📊 MATCHING ANALYSIS RESULTS");
    console.log("=".repeat(80));

    console.log(`\n✅ HIGH CONFIDENCE MATCHES (${matches.length}):`);
    console.log(`   Confidence: 0.8+ (${matches.length} matches)`);
    matches.forEach((match) => {
      console.log(`   • "${match.craft.title}" ↔ "${match.cosmic.title}" (${match.matchType}, ${(match.confidence * 100).toFixed(0)}%)`);
    });

    console.log(`\n⚠️  POTENTIAL MATCHES (${potentialMatches.length}):`);
    console.log(`   Confidence: 0.6-0.79 (${potentialMatches.length} matches)`);
    potentialMatches.forEach((match) => {
      console.log(`   • "${match.craft.title}" ↔ "${match.cosmic.title}" (${match.matchType}, ${(match.confidence * 100).toFixed(0)}%)`);
    });

    console.log(`\n❌ NO MATCHES FOUND (${noMatches.length}):`);
    noMatches.forEach((category) => {
      console.log(`   • "${category.title}" (${category.slug})`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("📈 SUMMARY STATISTICS");
    console.log("=".repeat(80));

    const totalCraft = craftCategories.length;
    const totalCosmic = allHosts.length;
    const highConfidenceMatches = matches.length;
    const potentialMatchesCount = potentialMatches.length;
    const noMatchesCount = noMatches.length;

    console.log(`\n📊 Total Craft Categories: ${totalCraft}`);
    console.log(`📊 Total Cosmic Regular-Hosts: ${totalCosmic}`);
    console.log(`✅ High Confidence Matches: ${highConfidenceMatches} (${((highConfidenceMatches / totalCraft) * 100).toFixed(1)}%)`);
    console.log(`⚠️  Potential Matches: ${potentialMatchesCount} (${((potentialMatchesCount / totalCraft) * 100).toFixed(1)}%)`);
    console.log(`❌ No Matches: ${noMatchesCount} (${((noMatchesCount / totalCraft) * 100).toFixed(1)}%)`);
    console.log(`🎯 Total Coverage: ${(((highConfidenceMatches + potentialMatchesCount) / totalCraft) * 100).toFixed(1)}%`);

    // Save detailed results to file
    const results = {
      summary: {
        totalCraft,
        totalCosmic,
        highConfidenceMatches,
        potentialMatches: potentialMatchesCount,
        noMatches: noMatchesCount,
        coveragePercentage: (((highConfidenceMatches + potentialMatchesCount) / totalCraft) * 100).toFixed(1),
      },
      highConfidenceMatches: matches,
      potentialMatches,
      noMatches: noMatches.map((cat) => ({ title: cat.title, slug: cat.slug })),
    };

    const resultsPath = path.join(__dirname, "regular-hosts-analysis.json");
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Detailed results saved to: ${resultsPath}`);
  } catch (error) {
    console.error("💥 Error analyzing regular hosts:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Stack trace:", error.stack);
    }
  }
}

// Run the analysis
analyzeRegularHosts()
  .then(() => {
    console.log("\n✅ Analysis complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Analysis failed:", error);
    process.exit(1);
  });
