import { createBucketClient } from "@cosmicjs/sdk";

// Initialize Cosmic client with write access
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG as string,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY as string,
  writeKey: process.env.COSMIC_WRITE_KEY as string,
});

async function updateScheduleType() {
  try {
    console.log("Updating Schedule object type...");

    // Define the updated object type
    const objectType = {
      title: "Schedule",
      slug: "schedule",
      singular: "Schedule",
      metafields: [
        {
          title: "Shows",
          key: "shows",
          type: "repeater",
          repeater_fields: [
            {
              title: "Show Key",
              key: "show_key",
              type: "text",
              required: true,
            },
            {
              title: "Show Time",
              key: "show_time",
              type: "text",
              required: true,
            },
            {
              title: "Show Day",
              key: "show_day",
              type: "text",
              required: true,
            },
            {
              title: "Name",
              key: "name",
              type: "text",
              required: true,
            },
            {
              title: "URL",
              key: "url",
              type: "text",
              required: true,
            },
            {
              title: "Picture",
              key: "picture",
              type: "text",
              required: true,
            },
            {
              title: "Created Time",
              key: "created_time",
              type: "text",
              required: true,
            },
            {
              title: "Tags",
              key: "tags",
              type: "json",
              required: false,
            },
            {
              title: "Hosts",
              key: "hosts",
              type: "json",
              required: false,
            },
            {
              title: "Duration",
              key: "duration",
              type: "number",
              required: false,
            },
            {
              title: "Play Count",
              key: "play_count",
              type: "number",
              required: false,
            },
            {
              title: "Favorite Count",
              key: "favorite_count",
              type: "number",
              required: false,
            },
            {
              title: "Comment Count",
              key: "comment_count",
              type: "number",
              required: false,
            },
            {
              title: "Listener Count",
              key: "listener_count",
              type: "number",
              required: false,
            },
            {
              title: "Repost Count",
              key: "repost_count",
              type: "number",
              required: false,
            },
          ],
        },
        {
          title: "Is Active",
          key: "is_active",
          type: "radio-buttons",
          required: true,
          options: [
            {
              value: "true",
              label: "Yes",
            },
            {
              value: "false",
              label: "No",
            },
          ],
        },
      ],
    };

    // Delete the existing object type first
    try {
      console.log("Deleting existing Schedule object type...");
      await cosmic.objectTypes.deleteOne("schedule");
      console.log("Successfully deleted existing Schedule object type");
    } catch (error) {
      console.log("No existing Schedule object type to delete");
    }

    // Create the new object type
    console.log("Creating new Schedule object type...");
    const result = await cosmic.objectTypes.insertOne(objectType);
    console.log("Successfully created new Schedule object type");

    return result;
  } catch (error) {
    console.error("Failed to update Schedule object type:", error);
    throw error;
  }
}

// Execute the script
updateScheduleType()
  .then(() => {
    console.log("Schedule object type update completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Schedule object type update failed:", error);
    process.exit(1);
  });
