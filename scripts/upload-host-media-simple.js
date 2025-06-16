const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });
const { createBucketClient } = require("@cosmicjs/sdk");
const https = require("https");
const http = require("http");

// Configuration
const config = {
  cosmic: {
    bucketSlug: process.env.NEXT_PUBLIC_COSMIC_BUCKET_SLUG,
    readKey: process.env.NEXT_PUBLIC_COSMIC_READ_KEY,
    writeKey: process.env.COSMIC_WRITE_KEY,
  },
};

// Function to download image from URL
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

// Function to upload image to Cosmic
async function uploadImageToCosmic(imageUrl, fileName, cosmic) {
  try {
    console.log(`   📥 Downloading: ${fileName}`);

    // Download the image
    const imageBuffer = await downloadImage(imageUrl);

    console.log(`   📤 Uploading to Cosmic: ${fileName}`);

    // Upload to Cosmic
    const result = await cosmic.media.insertOne({
      media: {
        originalname: fileName,
        buffer: imageBuffer,
      },
      folder: "host-profiles",
    });

    console.log(`   ✅ Uploaded: ${result.media.name}`);
    return result.media.name;
  } catch (error) {
    console.error(`   ❌ Error uploading ${fileName}:`, error.message);
    return null;
  }
}

// Function to get existing media from Cosmic
async function getExistingMedia(cosmic) {
  try {
    const response = await cosmic.media.find().limit(1000);
    return response.media || [];
  } catch (error) {
    console.error("❌ Error fetching existing media:", error);
    return [];
  }
}

// Function to get all hosts from Cosmic
async function getCosmicHosts(cosmic) {
  try {
    const response = await cosmic.objects
      .find({
        type: "regular-hosts",
      })
      .props("id,slug,title,metadata")
      .limit(1000);

    return response.objects || [];
  } catch (error) {
    console.error("❌ Error fetching hosts:", error);
    return [];
  }
}

// Function to update host with media
async function updateHostWithMedia(cosmic, hostId, mediaName) {
  try {
    await cosmic.objects.updateOne(hostId, {
      metadata: {
        image: mediaName,
      },
    });
    return true;
  } catch (error) {
    console.error(`❌ Error updating host ${hostId}:`, error.message);
    return false;
  }
}

// Function to extract filename from URL
function getFilenameFromUrl(url) {
  try {
    const urlParts = url.split("/");
    return urlParts[urlParts.length - 1];
  } catch (error) {
    return null;
  }
}

// Function to find image URLs for hosts that have empty images
async function findHostsNeedingImages(cosmic) {
  const hosts = await getCosmicHosts(cosmic);
  const hostsNeedingImages = [];

  for (const host of hosts) {
    const hasImage = host.metadata?.image && host.metadata.image !== "";
    if (!hasImage) {
      hostsNeedingImages.push({
        id: host.id,
        slug: host.slug,
        title: host.title,
        needsImage: true,
      });
    }
  }

  return hostsNeedingImages;
}

// Predefined image mappings (based on the output from the previous script)
const imageMap = {
  "luke-una": "https://vague-roadrunner.files.svdcdn.com/luke-una.jpeg",
  "lætitia-sadier": "https://vague-roadrunner.files.svdcdn.com/20220102_133957.jpeg",
  manami: "https://vague-roadrunner.files.svdcdn.com/DSC09258.JPG",
  marina: "https://vague-roadrunner.files.svdcdn.com/IMG_0574.jpg",
  "masisi-radio-takeover": "https://vague-roadrunner.files.svdcdn.com/Screenshot-2025-02-13-at-1.30.38-PM.png",
  "melanin-niknak": "https://vague-roadrunner.files.svdcdn.com/moovin-festival-dominic-simpson-niknak-NikNak.jpeg",
  "meridian-brothers-takeover": "https://vague-roadrunner.files.svdcdn.com/PSX_20241201_073124.jpg",
  midnightroba: "https://vague-roadrunner.files.svdcdn.com/MidnightRoba-20221002-Midnight-Roba.jpg",
  "millos-kaiser": "https://vague-roadrunner.files.svdcdn.com/1_2021-09-16-102508.jpeg",
  mle: "https://vague-roadrunner.files.svdcdn.com/Privet-Press-Shot-1-Emily-Hill.jpg",
  "mono-jazz": "https://vague-roadrunner.files.svdcdn.com/MONOJAZZJ22_03.jpg",
  "morning-mari1": "https://vague-roadrunner.files.svdcdn.com/Mari_WWFM092123.jpg",
  "mother-a-i-radio": "https://vague-roadrunner.files.svdcdn.com/IXZ8WvZw.png",
  "movement-through-music": "https://vague-roadrunner.files.svdcdn.com/V1-J.AITMAN-DE.LA.BASTIDE-FEB25-24.jpg",
  "moving-through-music-josh-aitman": "https://vague-roadrunner.files.svdcdn.com/V1-J.AITMAN-DE.LA.BASTIDE-FEB25-24_2025-03-10-093954_lytv.jpg",
  "mr-bongo": "https://vague-roadrunner.files.svdcdn.com/IMG_5377.jpg",
  "mr-scruff": "https://vague-roadrunner.files.svdcdn.com/Mr-Scruff-WWFM-Oct-22-Andy-Carthy.JPG",
  murmurs: "https://vague-roadrunner.files.svdcdn.com/ophélie-pic-Mur-Mur.jpeg",
  "music-power-ron-trent": "https://vague-roadrunner.files.svdcdn.com/ron-trent-alessia.jpg",
  "muva-of-earth": "https://vague-roadrunner.files.svdcdn.com/muvaofearth.JPG",
  "my-analog-journal": "https://vague-roadrunner.files.svdcdn.com/ZAG-WWFM-3-Zag-Erlat.jpg",
  "namboku-records": "https://vague-roadrunner.files.svdcdn.com/P1018070-Aaron-Choulai.JPG",
  "new-soil-takeover": "https://vague-roadrunner.files.svdcdn.com/New-Soil.JPG",
  "new-voices": "https://vague-roadrunner.files.svdcdn.com/2025-Dimitra-Zina_FOTOGRAFISKA-Berlin-©-Maria-Camila-Ruiz-Lora-Dimitra-Zina.jpeg",
  "new-years-eve": "https://vague-roadrunner.files.svdcdn.com/5b9b-2f50-4759-8b39-d7dbce3bc2a9.jpg",
  "niche-market-andy-votel": "https://vague-roadrunner.files.svdcdn.com/niche-market-jazz-OCCITAN-art.jpg",
  "nicola-cruz": "https://vague-roadrunner.files.svdcdn.com/Screenshot-2021-12-22-at-14.25.07.png",
  noudle: "https://vague-roadrunner.files.svdcdn.com/Noudle.jpg",
  okzharp: "https://vague-roadrunner.files.svdcdn.com/okzharp.jpg",
  "orii-jam-takeover": "https://vague-roadrunner.files.svdcdn.com/Invocations-to-the-cosmos-1-Charlie-Fenemer.png",
  "oscillations-danalogue": "https://vague-roadrunner.files.svdcdn.com/IMG_9566.jpg",
  osunlade: "https://vague-roadrunner.files.svdcdn.com/20240502-Louie-Vega-with-Osunlade.jpg",
  "oto-nova-japan": "https://vague-roadrunner.files.svdcdn.com/collage-1.jpg",
  "pacific-spirit-dj-d-dee": "https://vague-roadrunner.files.svdcdn.com/IMG_7511-Derek-Duncan.jpeg",
  papaoul: "https://vague-roadrunner.files.svdcdn.com/papaoulll.jpg",
  "paula-tape": "https://vague-roadrunner.files.svdcdn.com/Paula-Tape-Astral-Jam-rug.jpg",
  "charlie-dark": "https://vague-roadrunner.files.svdcdn.com/IMG_1589.jpg",
  "pedro-montenegro": "https://vague-roadrunner.files.svdcdn.com/No-Problemo-Paolo.jpg",
  pesona: "https://vague-roadrunner.files.svdcdn.com/KEVIN.jpeg",
  "pete-on-the-corner": "https://vague-roadrunner.files.svdcdn.com/pete-otc-2022.jpg",
  "picó-edna-martinez": "https://vague-roadrunner.files.svdcdn.com/Pico-remixed_Edna-Martinez-DEC-2022-Edna-Martinez.jpg",
  "planet-orbit-nedda-sou": "https://vague-roadrunner.files.svdcdn.com/WhatsApp-Image-2022-08-08-at-23.12.05-nedda-sou.jpeg",
  "poly-ritmo": "https://vague-roadrunner.files.svdcdn.com/IMG_9014-2.jpg",
  "puma-blue": "https://vague-roadrunner.files.svdcdn.com/B6D65FCD-B888-4BC1-A858-72D6B6C34FFA-Jacob-Allen.JPG",
  "qc-radio": "https://vague-roadrunner.files.svdcdn.com/FANITA-BANANA.JPG",
  "quincy-jones-tribute": "https://vague-roadrunner.files.svdcdn.com/djpaulette.jpg",
  "radiomatique-mixtapes": "https://vague-roadrunner.files.svdcdn.com/Radiomatique-Mixtape-Series-2-Hinako-WWFM-banner.jpg",
  "ralph-moore": "https://vague-roadrunner.files.svdcdn.com/Screenshot-2022-10-21-at-19.23.15.png",
  "raúl-monsalve-y-los-forajidos-takeover": "https://vague-roadrunner.files.svdcdn.com/13_2025-03-17-130658_chsw.jpg",
  "realistic-behaviour-alabaster-deplume": "https://vague-roadrunner.files.svdcdn.com/Gus-2-@-Chris-Almeida.jpg",
  "rebel-spirits": "https://vague-roadrunner.files.svdcdn.com/ptaszyn-cover.jpg",
  "record-room": "https://vague-roadrunner.files.svdcdn.com/annathris.jpeg",
  "rethinking-the-asian-underground-daytimers": "https://vague-roadrunner.files.svdcdn.com/Screenshot-2022-09-07-at-16.13.30.png",
  "rhodes-triology-sessions": "https://vague-roadrunner.files.svdcdn.com/241218-Triology-Mike-Lindup-BTS-009.jpg",
  "rio-18-takeover": "https://vague-roadrunner.files.svdcdn.com/20241206-Rio-18-takeover-Baldo-Verdu.jpg",
  "rob-da-bank": "https://vague-roadrunner.files.svdcdn.com/rob-da-bank2.jpg",
  "rosie-lowe-takeover": "https://vague-roadrunner.files.svdcdn.com/DMonk-_-Live-Shot-2024-2-Chris-Chadwick.jpg",
  "rustam-ospanoff": "https://vague-roadrunner.files.svdcdn.com/Rustam-Ospanoff.-Precious-Love-Rustam-Ospanoff.jpeg",
  "sally-company": "https://vague-roadrunner.files.svdcdn.com/Screenshot-2022-10-27-at-18.49.06.png",
  "sam-bhok": "https://vague-roadrunner.files.svdcdn.com/sam-bhok-synth-day.jpeg",
  "sam-fawcett": "https://vague-roadrunner.files.svdcdn.com/IMG_2421-2.JPG",
  "sarathy-korwar": "https://vague-roadrunner.files.svdcdn.com/1-credit-Fabrice-Bourgelle-Sarathy-Korwar.jpg",
  "seleccion-mexicana": "https://vague-roadrunner.files.svdcdn.com/ARTWORK_2022-02-04-181851.jpg",
  "sello-in-correcto-takeover": "https://vague-roadrunner.files.svdcdn.com/56440699-b274-5966-3ad6-f209aa33fb70.gif",
  "seloki-records-takeover": "https://vague-roadrunner.files.svdcdn.com/Seloki-Otto.jpg",
  "shigeto-tammy-lakkis": "https://vague-roadrunner.files.svdcdn.com/276f-21a2-4fb5-9258-43a1e7da2911.png",
  "sim-sima-coco-em": "https://vague-roadrunner.files.svdcdn.com/coco-em-photo-by-Paddy-Gedi-02.jpg",
  simbad: "https://vague-roadrunner.files.svdcdn.com/df1b-9480-45b9-804e-aefce5a027bd.jpg",
  "sly-and-the-family-stone": "https://vague-roadrunner.files.svdcdn.com/IMG_1761.webp",
  "soul-revivers": "https://vague-roadrunner.files.svdcdn.com/Nick-Manasseh-Nick-Manasseh-1.jpg",
  soulscape: "https://vague-roadrunner.files.svdcdn.com/WWFM_SEOUL_DJ-SOULSCPE.JPG",
  "sound-obsession": "https://vague-roadrunner.files.svdcdn.com/WOH_-KIRK-DEGIORGIO.jpg",
  "sounds-familiar": "https://vague-roadrunner.files.svdcdn.com/image0-11_2022-09-23-152654_suqi.jpeg",
  "soundway-paula-juana": "https://vague-roadrunner.files.svdcdn.com/Social-Media.gif",
  "spectrums-cosmo-sofi": "https://vague-roadrunner.files.svdcdn.com/DSC09205_2022-10-13-021024_czsj.JPG",
  "spot-lite": "https://vague-roadrunner.files.svdcdn.com/thumbnail_75B683F6-7565-473D-B2EA-D3FD3D8A28A3_1_105_c.jpg",
  "stamp-the-wax": "https://vague-roadrunner.files.svdcdn.com/Photo-Sep-22-2022-10-17-34-AM-miaszs.webp",
  "state-of-rhythm-danilo-plessow": "https://vague-roadrunner.files.svdcdn.com/Ays-photo-WWFM-Jörg-Danilo-plessow.jpg",
  "straight-no-chaser": "https://vague-roadrunner.files.svdcdn.com/Sun-Ra-110th-birthday.jpg",
  "strut-records": "https://vague-roadrunner.files.svdcdn.com/Quinton-Scott-3_2024-09-04-135005_bnrr.png",
  "strut-records-takeover": "https://vague-roadrunner.files.svdcdn.com/Wanlov-The-Kubolor.png",
  "studio-monkey-shoulder-special": "https://vague-roadrunner.files.svdcdn.com/fce85d73-5deb-4aa7-8046-954434f25703.JPG",
  "sunday-sessions-with-paul-smith": "https://vague-roadrunner.files.svdcdn.com/WWFM.x.PaulSmith-PaulGilles.03.jpg",
  "supriya-nagarajan-presents": "https://vague-roadrunner.files.svdcdn.com/IMG_5127.jpeg",
  "sweet-state-marina-trench": "https://vague-roadrunner.files.svdcdn.com/20210526-Sweet-State.jpg",
  "synesthesia-fabrice-bourgelle": "https://vague-roadrunner.files.svdcdn.com/IMG_4667dlo-Fabrice-Bourgelle.jpg",
  "tara-lily": "https://vague-roadrunner.files.svdcdn.com/2E810784-81F2-4EA9-B2B2-B6505196FCC0-tara-lily.JPG",
  "tash-lc": "https://vague-roadrunner.files.svdcdn.com/IMG_8445.jpeg",
  "tealeaves-kamar": "https://vague-roadrunner.files.svdcdn.com/merabhai-1-Alex-Hollingsworth_2025-03-17-132044_kerp.jpg",
  tereza: "https://vague-roadrunner.files.svdcdn.com/a666-5ee1-4c04-a7c4-e966ba0adfcf.jpg",
  "that-8-track-indaba": "https://vague-roadrunner.files.svdcdn.com/8track-2-NoShadowJab.jpg",
  "the-20": "https://vague-roadrunner.files.svdcdn.com/b28f-a7d7-4c2c-815d-d80db4c12e46.jpg",
  "leanne-wright": "https://vague-roadrunner.files.svdcdn.com/DSC09243.JPG",
  "the-fulljoy-experience-laani": "https://vague-roadrunner.files.svdcdn.com/58f917a9-c976-4c57-b0c0-2e3b299c8558-Laani-Henry.jpg",
  "the-lesson": "https://vague-roadrunner.files.svdcdn.com/e280-689a-4546-a48e-81116b70769c.jpg",
  "the-nelly-boum-show": "https://vague-roadrunner.files.svdcdn.com/4d6b-4d9b-477e-be06-e51fc79c858c.jpg",
  "erica-mckoy": "https://vague-roadrunner.files.svdcdn.com/ericaa.jpg",
  "thiago-nassif": "https://vague-roadrunner.files.svdcdn.com/e2d2-eb25-41aa-98bc-0b55779eba47.jpg",
  "tim-garcia": "https://vague-roadrunner.files.svdcdn.com/tim-garcia.jpg",
  "time-capsule": "https://vague-roadrunner.files.svdcdn.com/2db398012b9ce696c8bfd618f4e82a82d9078822.webp",
  "tiombe-lockhart": "https://vague-roadrunner.files.svdcdn.com/TIOMBÉ.jpg",
  "tomorrows-warriors": "https://vague-roadrunner.files.svdcdn.com/Tomorrows-Warriors-show-graphic.jpg",
  "toshio-matsuura": "https://vague-roadrunner.files.svdcdn.com/DAY7.jpg",
  "trekkie-trax": "https://vague-roadrunner.files.svdcdn.com/Screenshot-2022-10-18-at-22.51.01.png",
  "tru-thoughts-records-takeover": "https://vague-roadrunner.files.svdcdn.com/@y__rhys-Rhys-Baker.png",
  "umoja-nicola-conte": "https://vague-roadrunner.files.svdcdn.com/20170804_NicolaConte_phMariagraziaGiove_5-Sorriso-Studios.jpg",
  "universal-sanctuary": "https://vague-roadrunner.files.svdcdn.com/Image_20221021_134952_391_2022-10-21-152630_jlpp.jpeg",
  "university-of-underground": "https://vague-roadrunner.files.svdcdn.com/IWTB-Podcast-square.jpg",
  "venezuela-raul-monsalve": "https://vague-roadrunner.files.svdcdn.com/b7ce62a3-d0c8-5323-7477-1add233d72f6.jpg",
  "very-fantastic-radio-mildlife": "https://vague-roadrunner.files.svdcdn.com/VFR29-Mildlife.jpg",
  "we-out-here": "https://vague-roadrunner.files.svdcdn.com/Coco-Maria_WWFM-x-WOH.png",
  "wewantsounds-takeover": "https://vague-roadrunner.files.svdcdn.com/ERNESTO-PHOTO-Matt-Robin.jpg",
  "woh-radio-2024": "https://vague-roadrunner.files.svdcdn.com/fd35691b-3d13-1118-c841-1480d3ddc31c.jpeg",
  "woh-radio-at-night-24": "https://vague-roadrunner.files.svdcdn.com/mothermarkos-image-1.jpg",
  "world-of-echoes-francois-k": "https://vague-roadrunner.files.svdcdn.com/Francois-K-August-2022-Francois-Kevorkian.png",
  "world-refugee-day": "https://vague-roadrunner.files.svdcdn.com/WWFMRefugeeDay_01_2022-06-17-133045.jpg",
  "refugee-week-2023": "https://vague-roadrunner.files.svdcdn.com/Elaha-credit-Jaime-Weston.png",
  "world-series": "https://vague-roadrunner.files.svdcdn.com/20221017-S02-EP3-LIBANO-artwork-ᑕᒫᗗᒆ-ᑪᒷᗋᒆ.jpg",
  "worldwide-breakfast-valentine-comar": "https://vague-roadrunner.files.svdcdn.com/TrYb-photo-www.NigelRGlasgow.com.jpg",
  "worldwide-festival": "https://vague-roadrunner.files.svdcdn.com/adf8-5455-4275-8784-8f53dc7eac13.jpg",
  "ww-berlin": "https://vague-roadrunner.files.svdcdn.com/20220912-Sonar-Kollektiv-Neujazz-Oliver-Glage.jpg",
  "ww-cape-town": "https://vague-roadrunner.files.svdcdn.com/southern-tips-image-Aaron-Peters.jpeg",
  "ww-éireann-peter-curtin": "https://vague-roadrunner.files.svdcdn.com/This-Way-Lauch-outside-All-City-WW-Eireann-202210042.jpg",
  "ww-glasgow": "https://vague-roadrunner.files.svdcdn.com/95fb-193e-461b-80bb-7e1e3dbf613a.jpg",
  "ww-ibiza-mark-barrott-pete-gooding": "https://vague-roadrunner.files.svdcdn.com/Screenshot-2022-09-26-at-17.17.11-pete-gooding.png",
  ky: "https://vague-roadrunner.files.svdcdn.com/20221019-WWKYOTO-katsuro-sakurai.jpg",
  "ww-la": "https://vague-roadrunner.files.svdcdn.com/1uY4BiOEgBVFphyL-efnMpQ.jpeg",
  "ww-marseille-stéphane-galland": "https://vague-roadrunner.files.svdcdn.com/WW-Marseille-20221015-Ketu-Records-Stéphane-Galland.jpg",
  "ww-mumbai-aneesha-kotwani": "https://vague-roadrunner.files.svdcdn.com/Screenshot-2022-10-05-at-1.50.32-AM-Aneesha-Kotwani-Wavlngth.png",
  "ww-new-delhi-dj-mocity": "https://vague-roadrunner.files.svdcdn.com/DSC02297.JPG",
  "ww-new-orleans": "https://vague-roadrunner.files.svdcdn.com/Wino-Willy-Oct-2022-Urban-Unrest.jpg",
  "ww-palestine": "https://vague-roadrunner.files.svdcdn.com/khabar-keslan-01.jpg",
  "ww-paris": "https://vague-roadrunner.files.svdcdn.com/20160905-Anders-Le-Mellotron-920x613.jpg",
  "ww-rio": "https://vague-roadrunner.files.svdcdn.com/4a80-e9d0-4aea-a295-da87828a891f_2022-10-25-130039_pnwb.jpg",
  "ww-seattle": "https://vague-roadrunner.files.svdcdn.com/wwseattle-oct2022-hrvsthouse-Jason-Justice.jpeg",
};

// Main function
async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("🎯 Host Media Upload Script (Simple)");
  console.log("=====================================");
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log("");

  // Initialize Cosmic client
  const cosmic = createBucketClient(config.cosmic);

  try {
    // Step 1: Get existing media from Cosmic
    console.log("📋 Step 1: Getting existing media from Cosmic...");
    const existingMedia = await getExistingMedia(cosmic);
    console.log(`   Found ${existingMedia.length} existing media files`);

    // Step 2: Get existing hosts from Cosmic
    console.log("\n📋 Step 2: Getting hosts from Cosmic...");
    const cosmicHosts = await getCosmicHosts(cosmic);
    console.log(`   Found ${cosmicHosts.length} hosts in Cosmic`);

    // Step 3: Find hosts that need images
    console.log("\n📋 Step 3: Finding hosts that need images...");
    const hostsNeedingImages = await findHostsNeedingImages(cosmic);
    console.log(`   Found ${hostsNeedingImages.length} hosts without images`);

    // Step 4: Upload missing media and link to hosts
    console.log("\n📋 Step 4: Processing media uploads and links...");

    let uploadedCount = 0;
    let linkedCount = 0;
    let skippedCount = 0;

    for (const host of cosmicHosts) {
      console.log(`\n🔄 Processing: ${host.title} (${host.slug})`);

      // Check if host already has an image
      const hasImage = host.metadata?.image && host.metadata.image !== "";
      if (hasImage) {
        console.log(`   ✅ Host already has image: ${host.metadata.image}`);
        continue;
      }

      // Look for image URL in our mapping
      const imageUrl = imageMap[host.slug];
      if (!imageUrl) {
        console.log(`   ⚠️ No image URL found for ${host.slug}`);
        skippedCount++;
        continue;
      }

      const fileName = getFilenameFromUrl(imageUrl);
      if (!fileName) {
        console.log(`   ⚠️ Could not extract filename from URL: ${imageUrl}`);
        skippedCount++;
        continue;
      }

      // Check if media already exists in Cosmic
      const existingMediaFile = existingMedia.find((m) => m.original_name === fileName || m.name === fileName || m.name.includes(fileName.split(".")[0]));

      let mediaName = null;

      if (existingMediaFile) {
        console.log(`   ✅ Media already exists: ${existingMediaFile.name}`);
        mediaName = existingMediaFile.name;
      } else {
        // Upload new media
        if (!isDryRun) {
          mediaName = await uploadImageToCosmic(imageUrl, fileName, cosmic);
          if (mediaName) {
            uploadedCount++;
          }
        } else {
          console.log(`   🔍 Would upload: ${fileName} from ${imageUrl}`);
          mediaName = fileName; // Simulate for dry run
        }
      }

      // Link media to host if we have a media name
      if (mediaName) {
        if (!isDryRun) {
          const success = await updateHostWithMedia(cosmic, host.id, mediaName);
          if (success) {
            console.log(`   ✅ Linked media to host: ${mediaName}`);
            linkedCount++;
          }
        } else {
          console.log(`   🔍 Would link media to host: ${mediaName}`);
          linkedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    // Summary
    console.log("\n📊 Summary:");
    console.log(`   📤 Media uploaded: ${uploadedCount}`);
    console.log(`   🔗 Hosts linked: ${linkedCount}`);
    console.log(`   ⚠️ Skipped: ${skippedCount}`);
    console.log(`   📦 Total processed: ${cosmicHosts.length}`);

    if (isDryRun) {
      console.log("\n🔍 This was a dry run. Use --live to actually upload and link media.");
    } else {
      console.log("\n🎉 Media upload and linking process completed!");
    }
  } catch (error) {
    console.error("❌ Script error:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
