#!/usr/bin/env node

// Simple script to check environment variables
// Run with: node scripts/check-env.js

require("dotenv").config({ path: ".env.local" });

console.log("\n🔍 Checking Environment Variables for Cosmic v3 API\n");

const variables = [
  { name: "NEXT_PUBLIC_COSMIC_BUCKET_SLUG", value: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG },
  { name: "NEXT_PUBLIC_COSMIC_READ_KEY", value: process.env.NEXT_PUBLIC_COSMIC_READ_KEY },
  { name: "COSMIC_READ_KEY", value: process.env.COSMIC_READ_KEY, note: "Not used directly - we use NEXT_PUBLIC_COSMIC_READ_KEY" },
];

let hasIssues = false;

// Check each variable
variables.forEach((variable) => {
  if (!variable.value) {
    console.log(`❌ ${variable.name}: Not set`);
    hasIssues = true;
  } else {
    // Show first and last 3 characters of the value
    const firstChars = variable.value.substring(0, 3);
    const lastChars = variable.value.substring(variable.value.length - 3);
    console.log(`✅ ${variable.name}: ${firstChars}...${lastChars} (${variable.value.length} characters)`);
    if (variable.note) {
      console.log(`   Note: ${variable.note}`);
    }
  }
});

// Provide guidance if there are issues
if (hasIssues) {
  console.log("\n⚠️ Some environment variables are missing. Here's what to do:");
  console.log("1. Create a .env.local file in your project root if it doesn't exist");
  console.log("2. Add the missing variables to the file");
  console.log("3. Make sure to restart your development server after making changes");
  console.log("\nExample .env.local file:");
  console.log("NEXT_PUBLIC_COSMIC_BUCKET_SLUG=your-bucket-slug");
  console.log("NEXT_PUBLIC_COSMIC_READ_KEY=your-read-key");
} else {
  console.log("\n✅ All required environment variables are set!");
  console.log("Using Cosmic API v3 with token-based authentication");
}

console.log("\n");
