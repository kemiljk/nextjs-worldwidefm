import { NextRequest, NextResponse } from 'next/server';
import { cosmic } from '@/lib/cosmic-config';
import { broadcastToISOString } from '@/lib/date-utils';

/**
 * Cron job to sync published Cosmic episodes to RadioCult
 * Runs every 5 minutes via Vercel Cron
 * Finds episodes that are published but not yet scheduled in RadioCult
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stationId = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
    const secretKey = process.env.RADIOCULT_SECRET_KEY;

    if (!stationId || !secretKey) {
      return NextResponse.json({ error: 'RadioCult credentials not configured' }, { status: 500 });
    }

    console.log('🔄 [CRON] Starting sync of published episodes to RadioCult...');

    // Find episodes that:
    // 1. Are published
    // 2. Have a radiocult_media_id (media was uploaded)
    // 3. Don't have a radiocult_event_id yet (not synced)
    const episodesToSync = await cosmic.objects
      .find({
        type: 'episodes',
        'metadata.status': 'published',
      })
      .props('id,title,slug,metadata')
      .limit(100);

    if (!episodesToSync.objects || episodesToSync.objects.length === 0) {
      console.log('✅ [CRON] No episodes found');
      return NextResponse.json({
        success: true,
        synced: 0,
        message: 'No episodes to check',
      });
    }

    // Filter for episodes that need syncing
    const needsSync = episodesToSync.objects.filter((ep: any) => {
      const hasMediaId = !!ep.metadata?.radiocult_media_id;
      const notSynced = !ep.metadata?.radiocult_event_id;
      return hasMediaId && notSynced;
    });

    if (needsSync.length === 0) {
      console.log('✅ [CRON] No episodes need syncing');
      return NextResponse.json({
        success: true,
        synced: 0,
        message: 'All episodes already synced',
      });
    }

    console.log(`📋 [CRON] Found ${needsSync.length} episodes to sync`);

    const results = {
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const episode of needsSync) {
      try {
        console.log(`\n🎵 [CRON] Syncing episode: "${episode.title}" (${episode.id})`);

        const metadata = episode.metadata;
        const mediaId = metadata.radiocult_media_id;
        const radiocultArtistId = metadata.radiocult_artist_id;

        if (!mediaId) {
          console.log(`⚠️ [CRON] Skipping ${episode.title}: No media ID`);
          continue;
        }

        if (!radiocultArtistId) {
          console.log(`⚠️ [CRON] Skipping ${episode.title}: No RadioCult artist ID`);
          results.errors.push(`${episode.title}: Missing RadioCult artist ID`);
          results.failed++;
          continue;
        }

        // Parse broadcast date and time using helper function
        const startTimeISO = broadcastToISOString(
          metadata.broadcast_date,
          metadata.broadcast_time,
          metadata.broadcast_date_old
        );

        if (!startTimeISO) {
          console.log(`⚠️ [CRON] Skipping ${episode.title}: Invalid broadcast date`);
          results.errors.push(`${episode.title}: Invalid broadcast date`);
          results.failed++;
          continue;
        }

        const startTime = new Date(startTimeISO);

        // Parse duration (format: "60:00" or "60")
        const durationStr = metadata.duration || '60';
        const durationMinutes = parseInt(durationStr.split(':')[0]) || 60;

        // Calculate end time
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

        // Create or get RadioCult show
        let showId = metadata.radiocult_show_id;

        if (!showId) {
          console.log(`📺 [CRON] Creating RadioCult show for "${episode.title}"`);

          const showPayload = {
            name: episode.title,
            description: metadata.description || episode.title,
            artistId: radiocultArtistId,
          };

          const showResponse = await fetch(
            `https://api.radiocult.fm/api/station/${stationId}/show`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': secretKey,
              },
              body: JSON.stringify(showPayload),
            }
          );

          if (!showResponse.ok) {
            const errorText = await showResponse.text();
            throw new Error(`Failed to create RadioCult show: ${errorText}`);
          }

          const showData = await showResponse.json();
          showId = showData.show?.id;

          if (!showId) {
            throw new Error('No show ID returned from RadioCult');
          }

          // Update Cosmic episode with show ID
          await cosmic.objects.updateOne(episode.id, {
            metadata: {
              radiocult_show_id: showId,
            },
          });

          console.log(`✅ [CRON] Created RadioCult show: ${showId}`);
        }

        // Create RadioCult event (scheduled instance)
        console.log(`📅 [CRON] Scheduling RadioCult event for "${episode.title}"`);

        const eventPayload = {
          showId: showId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          mediaId: mediaId, // Link to the uploaded media
          description: metadata.description || episode.title,
        };

        console.log(`📤 [CRON] Event payload:`, JSON.stringify(eventPayload, null, 2));

        const eventResponse = await fetch(
          `https://api.radiocult.fm/api/station/${stationId}/event`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': secretKey,
            },
            body: JSON.stringify(eventPayload),
          }
        );

        if (!eventResponse.ok) {
          const errorText = await eventResponse.text();
          throw new Error(`Failed to create RadioCult event: ${errorText}`);
        }

        const eventData = await eventResponse.json();
        const eventId = eventData.event?.id;

        if (!eventId) {
          throw new Error('No event ID returned from RadioCult');
        }

        // Update Cosmic episode with event ID (marks as synced)
        await cosmic.objects.updateOne(episode.id, {
          metadata: {
            radiocult_event_id: eventId,
            radiocult_synced: true,
            radiocult_synced_at: new Date().toISOString(),
          },
        });

        console.log(
          `✅ [CRON] Successfully synced "${episode.title}" to RadioCult (Event: ${eventId})`
        );
        results.synced++;
      } catch (error) {
        console.error(`❌ [CRON] Failed to sync "${episode.title}":`, error);
        results.failed++;
        results.errors.push(
          `${episode.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    console.log('\n📊 [CRON] Sync complete:');
    console.log(`  ✅ Synced: ${results.synced}`);
    console.log(`  ❌ Failed: ${results.failed}`);

    return NextResponse.json({
      success: true,
      synced: results.synced,
      failed: results.failed,
      errors: results.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Error in sync-episodes:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
