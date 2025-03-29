// Test script for search and filtering functionality
import("dotenv")
  .then((dotenv) => {
    dotenv.config();

    import("../lib/actions.js")
      .then(async ({ getAllSearchableContent }) => {
        console.log("Testing search and filtering functionality...");

        try {
          // Fetch all searchable content
          console.log("Fetching searchable content...");
          const content = await getAllSearchableContent();

          console.log(`Found ${content.length} total content items`);

          // Sample the first few items to verify structure
          console.log("\nSample content structure:");
          const sample = content.slice(0, 2);
          sample.forEach((item, i) => {
            console.log(`\nItem ${i + 1}:`);
            console.log(`Title: ${item.title}`);
            console.log(`Type: ${item.type}`);
            console.log(`Slug: ${item.slug}`);

            // Verify filter items
            if (item.genres?.length) {
              console.log(`Genres (${item.genres.length}): ${item.genres.map((g) => g.title).join(", ")}`);
              console.log(`  First genre: { title: "${item.genres[0].title}", slug: "${item.genres[0].slug}", type: "${item.genres[0].type}" }`);
            }

            if (item.hosts?.length) {
              console.log(`Hosts (${item.hosts.length}): ${item.hosts.map((h) => h.title).join(", ")}`);
              console.log(`  First host: { title: "${item.hosts[0].title}", slug: "${item.hosts[0].slug}", type: "${item.hosts[0].type}" }`);
            }

            if (item.locations?.length) {
              console.log(`Locations (${item.locations.length}): ${item.locations.map((l) => l.title).join(", ")}`);
            }

            if (item.takeovers?.length) {
              console.log(`Takeovers (${item.takeovers.length}): ${item.takeovers.map((t) => t.title).join(", ")}`);
            }
          });

          // Test filtering
          console.log("\nTesting filters...");

          // Find all unique filter categories
          const filterCounts = {
            genres: new Map(),
            hosts: new Map(),
            locations: new Map(),
            takeovers: new Map(),
          };

          content.forEach((item) => {
            // Count genres
            item.genres?.forEach((genre) => {
              if (genre.slug) {
                const count = filterCounts.genres.get(genre.slug) || 0;
                filterCounts.genres.set(genre.slug, count + 1);
              }
            });

            // Count hosts
            item.hosts?.forEach((host) => {
              if (host.slug) {
                const count = filterCounts.hosts.get(host.slug) || 0;
                filterCounts.hosts.set(host.slug, count + 1);
              }
            });

            // Count locations
            item.locations?.forEach((location) => {
              if (location.slug) {
                const count = filterCounts.locations.get(location.slug) || 0;
                filterCounts.locations.set(location.slug, count + 1);
              }
            });

            // Count takeovers
            item.takeovers?.forEach((takeover) => {
              if (takeover.slug) {
                const count = filterCounts.takeovers.get(takeover.slug) || 0;
                filterCounts.takeovers.set(takeover.slug, count + 1);
              }
            });
          });

          // Show most common filters
          console.log("\nTop genres:");
          const topGenres = [...filterCounts.genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
          topGenres.forEach(([slug, count]) => {
            const genre = content.find((item) => item.genres?.some((g) => g.slug === slug))?.genres?.find((g) => g.slug === slug);
            console.log(`${genre?.title || "Unknown"} (${slug}): ${count} items`);
          });

          console.log("\nTop hosts:");
          const topHosts = [...filterCounts.hosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
          topHosts.forEach(([slug, count]) => {
            const host = content.find((item) => item.hosts?.some((h) => h.slug === slug))?.hosts?.find((h) => h.slug === slug);
            console.log(`${host?.title || "Unknown"} (${slug}): ${count} items`);
          });

          // Test a search filter using slug
          if (topGenres.length > 0) {
            const testGenreSlug = topGenres[0][0];
            console.log(`\nTesting filter with genre slug: ${testGenreSlug}`);

            const filtered = content.filter((item) => item.genres?.some((genre) => genre.slug === testGenreSlug));

            console.log(`Found ${filtered.length} items with genre slug ${testGenreSlug}`);
            console.log(`First item: ${filtered[0]?.title || "None"}`);
          }

          console.log("\nSearch and filter test completed successfully!");
        } catch (error) {
          console.error("Error testing search:", error);
        }
      })
      .catch((error) => {
        console.error("Error importing actions module:", error);
      });
  })
  .catch((error) => {
    console.error("Error importing dotenv:", error);
  });
