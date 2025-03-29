#!/usr/bin/env node

const { migrateAlbumOfTheWeek } = require("./migrate-album-of-the-week");

migrateAlbumOfTheWeek()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
