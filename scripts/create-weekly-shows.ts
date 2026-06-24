import dotenv from 'dotenv';
import { createWeeklyRecurringShows } from '@/lib/create-weekly-shows';

dotenv.config({ path: '.env.local' });

async function main() {
  const result = await createWeeklyRecurringShows();
  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Failed to create weekly shows:', error);
  process.exit(1);
});
