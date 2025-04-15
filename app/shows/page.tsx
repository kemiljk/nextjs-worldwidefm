import { Suspense } from 'react';
import ShowsClient from './shows-client';

// Force dynamic mode to prevent the issue with ISR and repeated POST requests
export const dynamic = 'force-dynamic';

export default function ShowsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ShowsClient />
    </Suspense>
  );
}
