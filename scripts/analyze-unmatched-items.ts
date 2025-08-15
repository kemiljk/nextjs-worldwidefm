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

interface UnmatchedAnalysis {
  category: CraftCategory;
  potentialMatches: {
    host: CosmicHost;
    matchType: string;
    confidence: number;
    reason: string;
  }[];
  bestMatch: {
    host: CosmicHost;
    matchType: string;
    confidence: number;
    reason: string;
  } | null;
}

async function analyzeUnmatchedItems() {
  try {
    console.log("🔍 Analyzing unmatched items for hidden patterns...");
    
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
    
    console.log(`📊 Loaded ${allHosts.length} Cosmic hosts for analysis`);
    
    const analysisResults: UnmatchedAnalysis[] = [];
    
    for (const category of noMatches) {
      const potentialMatches: UnmatchedAnalysis['potentialMatches'] = [];
      
      // Pattern 1: "Show Name: Person Name" format
      if (category.title.includes(":")) {
        const parts = category.title.split(":");
        const showName = parts[0].trim();
        const personName = parts[1].trim();
        
        // Look for exact person name matches
        for (const host of allHosts) {
          if (host.title.toLowerCase() === personName.toLowerCase()) {
            potentialMatches.push({
              host,
              matchType: "person_name_extracted",
              confidence: 0.9,
              reason: `Extracted person name "${personName}" from show title "${category.title}"`
            });
          }
        }
        
        // Look for partial person name matches
        for (const host of allHosts) {
          if (personName.toLowerCase().includes(host.title.toLowerCase()) ||
              host.title.toLowerCase().includes(personName.toLowerCase())) {
            const confidence = Math.min(
              host.title.length / Math.max(personName.length, host.title.length),
              personName.length / Math.max(personName.length, host.title.length)
            );
            if (confidence > 0.6) {
              potentialMatches.push({
                host,
                matchType: "person_name_partial",
                confidence,
                reason: `Partial match: "${personName}" ↔ "${host.title}"`
              });
            }
          }
        }
      }
      
      // Pattern 2: "Prefix Person Name" format (like "Head Sounds: Tostoni")
      const words = category.title.split(" ");
      if (words.length > 2) {
        // Try to find a person's name at the end
        const possibleNames = [];
        for (let i = 1; i < words.length; i++) {
          possibleNames.push(words.slice(i).join(" "));
        }
        
        for (const possibleName of possibleNames) {
          for (const host of allHosts) {
            if (host.title.toLowerCase() === possibleName.toLowerCase()) {
              potentialMatches.push({
                host,
                matchType: "name_at_end",
                confidence: 0.85,
                reason: `Found name "${possibleName}" at end of title "${category.title}"`
              });
            }
          }
        }
      }
      
      // Pattern 3: Look for any word that matches a host name
      const titleWords = category.title.toLowerCase().split(/[\s:]+/);
      for (const word of titleWords) {
        if (word.length > 2) { // Skip very short words
          for (const host of allHosts) {
            if (host.title.toLowerCase() === word.toLowerCase()) {
              potentialMatches.push({
                host,
                matchType: "word_match",
                confidence: 0.7,
                reason: `Word "${word}" matches host "${host.title}"`
              });
            }
          }
        }
      }
      
      // Pattern 4: Check if any host name is contained within the category title
      for (const host of allHosts) {
        if (category.title.toLowerCase().includes(host.title.toLowerCase())) {
          const confidence = host.title.length / category.title.length;
          if (confidence > 0.3) { // Host name should be at least 30% of category title
            potentialMatches.push({
              host,
              matchType: "host_contained_in_title",
              confidence,
              reason: `Host "${host.title}" is contained in "${category.title}"`
            });
          }
        }
      }
      
      // Pattern 5: Check if category title is contained within any host name
      for (const host of allHosts) {
        if (host.title.toLowerCase().includes(category.title.toLowerCase())) {
          const confidence = category.title.length / host.title.length;
          if (confidence > 0.5) { // Category should be at least 50% of host title
            potentialMatches.push({
              host,
              matchType: "title_contained_in_host",
              confidence,
              reason: `Category "${category.title}" is contained in host "${host.title}"`
            });
          }
        }
      }
      
      // Remove duplicates and sort by confidence
      const uniqueMatches = potentialMatches.filter((match, index, self) => 
        index === self.findIndex(m => m.host.id === match.host.id)
      );
      
      uniqueMatches.sort((a, b) => b.confidence - a.confidence);
      
      const bestMatch = uniqueMatches.length > 0 ? uniqueMatches[0] : null;
      
      analysisResults.push({
        category,
        potentialMatches: uniqueMatches,
        bestMatch
      });
    }
    
    // Group results by match type
    const resultsByType: Record<string, UnmatchedAnalysis[]> = {};
    analysisResults.forEach(result => {
      if (result.bestMatch) {
        const matchType = result.bestMatch.matchType;
        if (!resultsByType[matchType]) {
          resultsByType[matchType] = [];
        }
        resultsByType[matchType].push(result);
      }
    });
    
    // Print results
    console.log("\n" + "=".repeat(80));
    console.log("🔍 UNMATCHED ITEMS ANALYSIS");
    console.log("=".repeat(80));
    
    let totalNewMatches = 0;
    
    for (const [matchType, results] of Object.entries(resultsByType)) {
      console.log(`\n✅ ${matchType.toUpperCase()} (${results.length} potential matches):`);
      results.forEach(result => {
        const match = result.bestMatch!;
        console.log(`   • "${result.category.title}" ↔ "${match.host.title}" (${(match.confidence * 100).toFixed(0)}%)`);
        console.log(`     Reason: ${match.reason}`);
        totalNewMatches++;
      });
    }
    
    // Show items with no potential matches
    const noPotentialMatches = analysisResults.filter(result => !result.bestMatch);
    console.log(`\n❌ NO POTENTIAL MATCHES FOUND (${noPotentialMatches.length}):`);
    noPotentialMatches.forEach(result => {
      console.log(`   • "${result.category.title}" (${result.category.slug})`);
    });
    
    console.log("\n" + "=".repeat(80));
    console.log("📈 IMPROVED MATCHING SUMMARY");
    console.log("=".repeat(80));
    
    const originalUnmatched = noMatches.length;
    const newMatches = totalNewMatches;
    const stillUnmatched = noPotentialMatches.length;
    const originalCoverage = 74.1; // From previous analysis
    const newCoverage = ((278 - stillUnmatched) / 278 * 100);
    
    console.log(`\n📊 Original unmatched: ${originalUnmatched}`);
    console.log(`✅ New potential matches found: ${newMatches}`);
    console.log(`❌ Still unmatched: ${stillUnmatched}`);
    console.log(`📈 Coverage improvement: ${originalCoverage.toFixed(1)}% → ${newCoverage.toFixed(1)}% (+${(newCoverage - originalCoverage).toFixed(1)}%)`);
    
    // Save detailed results
    const results = {
      summary: {
        originalUnmatched,
        newMatches,
        stillUnmatched,
        originalCoverage,
        newCoverage,
        improvement: newCoverage - originalCoverage
      },
      resultsByType,
      noPotentialMatches: noPotentialMatches.map(r => ({ title: r.category.title, slug: r.category.slug }))
    };
    
    const resultsPath = path.join(__dirname, "unmatched-items-analysis.json");
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Detailed results saved to: ${resultsPath}`);
    
  } catch (error) {
    console.error("💥 Error analyzing unmatched items:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Stack trace:", error.stack);
    }
  }
}

// Run the analysis
analyzeUnmatchedItems()
  .then(() => {
    console.log("\n✅ Analysis complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Analysis failed:", error);
    process.exit(1);
  });
