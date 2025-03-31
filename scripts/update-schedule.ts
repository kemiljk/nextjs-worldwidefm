import { createBucketClient } from "@cosmicjs/sdk";
import { getAllShowsFromMixcloud } from "../lib/mixcloud-service";

// Initialize Cosmic client with write access
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
  writeKey: process.env.COSMIC_WRITE_KEY as string,
});

async function updateSchedule() {
  try {
    console.log("Updating schedule...");

    // First, get the existing schedule
    const scheduleResponse = await cosmic.objects
      .findOne({
        type: "schedule",
        slug: "schedule",
      })
      .props("id,title,slug,metadata");

    if (!scheduleResponse?.object) {
      throw new Error("No schedule found");
    }

    const schedule = scheduleResponse.object;

    // Get all shows from Mixcloud
    console.log("Fetching shows from Mixcloud...");
    const mixcloudShows = await getAllShowsFromMixcloud();
    console.log(`Found ${mixcloudShows.length} shows`);

    // Group shows by day of the week based on their creation time
    const showsByDay = mixcloudShows.reduce((acc, show) => {
      const date = new Date(show.created_time);
      const day = date.toLocaleDateString("en-US", { weekday: "long" });

      // Only include shows that are from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      if (date > sevenDaysAgo) {
        if (!acc[day]) {
          acc[day] = [];
        }
        acc[day].push(show);
      }
      return acc;
    }, {} as Record<string, typeof mixcloudShows>);

    // Create schedule entries for each day
    const scheduleShows = Object.entries(showsByDay).map(([day, shows]) => {
      // Sort shows by creation time for each day
      const sortedShows = shows.sort((a, b) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime());

      // Take the first show of each day
      const show = sortedShows[0];

      // Get the time from the show's creation time
      const time = new Date(show.created_time).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      return {
        show_key: show.key,
        show_time: time,
        show_day: day,
        name: show.name,
        url: show.url,
        picture: show.pictures.extra_large,
        created_time: show.created_time,
        tags: show.tags.map((tag) => tag.name),
        hosts: show.hosts.map((host) => host.name),
        duration: show.audio_length,
        play_count: show.play_count,
        favorite_count: show.favorite_count,
        comment_count: show.comment_count,
        listener_count: show.listener_count,
        repost_count: show.repost_count,
      };
    });

    console.log("Creating schedule with shows:", scheduleShows);

    if (scheduleShows.length === 0) {
      throw new Error("No shows found to add to schedule");
    }

    // Update the schedule with the new shows
    const result = await cosmic.objects.updateOne(schedule.id, {
      metadata: {
        shows: scheduleShows,
        is_active: "true",
      },
    });

    if (!result?.object) {
      throw new Error("Failed to update schedule - no response from Cosmic");
    }

    console.log("Successfully updated schedule with shows");
    return result.object;
  } catch (error) {
    console.error("Failed to update schedule:", error);
    throw error;
  }
}

// Execute the script
updateSchedule()
  .then(() => {
    console.log("Schedule update completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Schedule update failed:", error);
    process.exit(1);
  });
