/**
 * Push audio that never reached RadioCult from temporary Blob storage, then
 * record the resulting media id on the episode.
 *
 * Usage:
 *   bun run scripts/retry-radiocult-upload.ts --episode <slug-or-id> [options]
 *   bun run scripts/retry-radiocult-upload.ts --url <blobUrl> --title "Show Title"
 *
 * Options:
 *   --episode <slug|id>  Episode to read `raw_media_url` from and write the media id back to.
 *   --url <blobUrl>      Audio source. Defaults to the episode's `raw_media_url`.
 *   --filename <name>    Filename sent to RadioCult. Defaults to the blob's basename.
 *   --title <title>      ID3 title. Defaults to the filename without its extension.
 *   --artist <artist>    ID3 artist. Defaults to the episode's first host.
 *   --delete-blob        Remove the temporary blob once RadioCult has accepted it.
 *   --dry-run            Report what would happen without uploading or writing.
 */
import dotenv from 'dotenv';
import { createBucketClient } from '@cosmicjs/sdk';
import { del } from '@vercel/blob';
import { uploadMediaToRadioCult } from '@/lib/radiocult-upload';
import { buildMediaMetadataTitle } from '@/lib/upload-filename-utils';

dotenv.config({ path: '.env.local' });

type Args = {
  episode?: string;
  url?: string;
  filename?: string;
  title?: string;
  artist?: string;
  deleteBlob: boolean;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { deleteBlob: false, dryRun: false };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = () => argv[++i];

    if (flag === '--episode') args.episode = next();
    else if (flag === '--url') args.url = next();
    else if (flag === '--filename') args.filename = next();
    else if (flag === '--title') args.title = next();
    else if (flag === '--artist') args.artist = next();
    else if (flag === '--delete-blob') args.deleteBlob = true;
    else if (flag === '--dry-run') args.dryRun = true;
    else {
      console.error(`Unknown argument: ${flag}`);
      process.exit(1);
    }
  }

  return args;
}

type EpisodeObject = {
  id: string;
  slug: string;
  title: string;
  metadata?: {
    raw_media_url?: string | null;
    radiocult_media_id?: string | null;
    regular_hosts?: { title?: string }[] | null;
  } | null;
};

const cosmic = createBucketClient({
  bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG || '',
  readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY || '',
  writeKey: process.env.COSMIC_WRITE_KEY || '',
});

async function findEpisode(slugOrId: string): Promise<EpisodeObject> {
  const query = /^[0-9a-f]{24}$/i.test(slugOrId)
    ? { type: 'episode', id: slugOrId }
    : { type: 'episode', slug: slugOrId };

  // Submissions land as drafts, which is exactly where failed uploads sit.
  const { object } = await cosmic.objects
    .findOne(query)
    .props('id,slug,title,metadata')
    .depth(1)
    .status('any');

  if (!object) {
    throw new Error(`Episode "${slugOrId}" not found`);
  }

  return object as EpisodeObject;
}

function basenameFromUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'audio.mp3');
  } catch {
    return 'audio.mp3';
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const stationId = process.env.NEXT_PUBLIC_RADIOCULT_STATION_ID;
  const secretKey = process.env.RADIOCULT_SECRET_KEY;

  if (!stationId || !secretKey) {
    throw new Error('RADIOCULT_SECRET_KEY / NEXT_PUBLIC_RADIOCULT_STATION_ID are not configured');
  }

  const episode = args.episode ? await findEpisode(args.episode) : undefined;
  const mediaUrl = args.url || episode?.metadata?.raw_media_url || undefined;

  if (!mediaUrl) {
    throw new Error('No audio source. Pass --url, or use --episode with a stored raw_media_url.');
  }

  if (episode?.metadata?.radiocult_media_id) {
    console.log(
      `⚠️  "${episode.title}" already has RadioCult media id ${episode.metadata.radiocult_media_id}; it will be overwritten.`
    );
  }

  const fileName = args.filename || basenameFromUrl(mediaUrl);
  const title = args.title || episode?.title || buildMediaMetadataTitle(fileName);
  const artist = args.artist || episode?.metadata?.regular_hosts?.[0]?.title || undefined;

  console.log('\n🎵 Retrying RadioCult upload');
  console.log(`  ├─ Episode:  ${episode ? `${episode.title} (${episode.slug})` : '— none —'}`);
  console.log(`  ├─ Source:   ${mediaUrl}`);
  console.log(`  ├─ Filename: ${fileName}`);
  console.log(`  ├─ Title:    ${title}`);
  console.log(`  ├─ Artist:   ${artist || '— none —'}`);

  if (args.dryRun) {
    console.log('  └─ 🧪 Dry run, nothing uploaded');
    return;
  }

  const result = await uploadMediaToRadioCult({
    mediaUrl,
    fileName,
    metadata: artist ? { title, artist } : { title },
    stationId,
    secretKey,
  });

  if (!result.success) {
    console.error(`  └─ ❌ RadioCult upload failed: ${result.error}`);
    process.exit(1);
  }

  console.log(`  ├─ ✅ RadioCult media id: ${result.radiocultMediaId}`);

  if (episode) {
    await cosmic.objects.updateOne(episode.id, {
      metadata: { radiocult_media_id: result.radiocultMediaId, raw_media_url: '' },
    });
    console.log(`  ├─ ✅ Saved to episode "${episode.slug}"`);
  } else {
    console.log('  ├─ ℹ️  No --episode given, media id not saved anywhere');
  }

  if (args.deleteBlob) {
    await del(mediaUrl);
    console.log('  ├─ 🧹 Deleted temporary blob');
  }

  console.log('  └─ Done');
}

main().catch((error: unknown) => {
  console.error('❌', error instanceof Error ? error.message : error);
  process.exit(1);
});
