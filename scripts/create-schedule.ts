import { createBucketClient } from "@cosmicjs/sdk";

// Initialize Cosmic client with write access
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
  writeKey: process.env.COSMIC_WRITE_KEY as string,
});

async function createSchedule() {
  try {
    console.log("Creating schedule...");

    const scheduleData = {
      title: "Main Schedule",
      type: "schedule",
      slug: "schedule",
      status: "published",
      metadata: {
        shows: [
          // Example show format:
          // {
          //   show_key: "mixcloud-key",
          //   show_time: "18:00",
          //   show_day: "Monday"
          // }
        ],
        is_active: true,
      },
    };

    const result = await cosmic.objects.insertOne(scheduleData);
    console.log("Successfully created schedule:", result.object.id);
    return result.object;
  } catch (error) {
    console.error("Failed to create schedule:", error);
    throw error;
  }
}

// Execute the script
createSchedule()
  .then(() => {
    console.log("Schedule creation completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Schedule creation failed:", error);
    process.exit(1);
  });
