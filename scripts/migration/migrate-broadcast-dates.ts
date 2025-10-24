import { cosmic } from '@/lib/cosmic-config';
import { extractDatePart, extractTimePart } from '@/lib/date-utils';

async function migrateBroadcastDates(dryRun = true) {
  console.log(`\n🔄 Starting broadcast date migration (dry run: ${dryRun})\n`);

  const stats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Fetch all episodes
    const response = await cosmic.objects
      .find({ type: 'episodes' })
      .props('id,title,metadata')
      .limit(1000);

    if (!response.objects) {
      console.log('❌ No episodes found');
      return stats;
    }

    stats.total = response.objects.length;
    console.log(`📊 Found ${stats.total} episodes to process\n`);

    for (const episode of response.objects) {
      const oldDate = episode.metadata?.broadcast_date_old;

      // Skip if no old date or already has new date
      if (!oldDate) {
        console.log(`⏭️  Skipping "${episode.title}": No broadcast_date_old`);
        stats.skipped++;
        continue;
      }

      try {
        // Extract date and time parts
        const datePart = extractDatePart(oldDate);
        const timePart = extractTimePart(oldDate) || episode.metadata?.broadcast_time || '00:00';

        console.log(`📅 ${episode.title}:`);
        console.log(`   Old: ${oldDate}`);
        console.log(`   New Date: ${datePart}`);
        console.log(`   Time: ${timePart}`);

        if (!dryRun && datePart) {
          await cosmic.objects.updateOne(episode.id, {
            metadata: {
              ...episode.metadata,
              broadcast_date: datePart, // Cosmic date field
              broadcast_time: timePart, // Text field
            },
          });
          console.log(`   ✅ Migrated\n`);
          stats.migrated++;
        } else if (dryRun) {
          console.log(`   🔍 Would migrate (dry run)\n`);
          stats.migrated++;
        }
      } catch (error) {
        console.error(`   ❌ Error:`, error);
        stats.errors++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📈 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Total episodes: ${stats.total}`);
    console.log(`Migrated: ${stats.migrated}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(50) + '\n');

    return stats;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run with: bun run scripts/migration/migrate-broadcast-dates.ts
// Change dryRun to false when ready to execute
migrateBroadcastDates(true)
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
