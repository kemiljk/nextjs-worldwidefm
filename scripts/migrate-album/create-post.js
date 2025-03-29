// Simple script to create a post
require("dotenv").config({ path: ".env.local" });
const { createBucketClient } = require("@cosmicjs/sdk");

// Initialize Cosmic client
const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
  writeKey: process.env.COSMIC_WRITE_KEY,
});

async function createSimplePost() {
  try {
    // Create a very simple post
    const postData = {
      title: "Album Of The Week: Test Post",
      type: "posts",
      slug: "album-of-the-week-test",
      status: "published",
      metadata: {
        section_name: "67e7d278780d951be77cd53f",
        section_priority: 20,
      },
    };

    console.log("Creating post with data:", JSON.stringify(postData, null, 2));

    const result = await cosmic.objects.insertOne(postData);

    console.log("Successfully created post:", result.object.title);
    console.log("Post ID:", result.object.id);
  } catch (error) {
    console.error("Failed to create post:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

createSimplePost();
