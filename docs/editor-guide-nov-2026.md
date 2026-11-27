# Editor guide: features added in November 2026

Each item says what to do in Cosmic. Items marked **one-off setup** need a developer to run a
script once (every script is a dry run unless `--apply` is added).

## Schedule: rolling seven days and placeholders

See `docs/schedule-placeholders.md`. The schedule now starts on today. To hold a slot before a
host submits, add a schedule entry with only a **Placeholder Title** and a start time.
**One-off setup:** `bun run scripts/add-schedule-placeholder-field.ts --apply`

## Video captions: rich text

Video descriptions can contain bold, italics, lists and named links. Existing plain-text
captions look the same as before until they are edited.
**One-off setup:** `bun run scripts/update-video-description-field.ts --apply`

## Host names link to Instagram

On a show page, any mention of a host's name in the show text links (underlined) to the host's
Instagram. It uses the **Instagram** field on the host profile (a handle such as `@zaereo`, or a
profile link). Hosts with no Instagram value stay as plain text. At the time of writing, 1 of
399 hosts has one filled in.

## Homepage: "Listen by location"

A new block lets visitors pick a city or country and hear shows from there, with a link to all
shows in that place.
**One-off setup:** `bun run scripts/create-homepage-block-types.ts` (creates the
*Location Selector Block*; it is safe to re-run).
Then add *Location Selector Block* to the Homepage's **Page Order** where you want it. It only
appears once placed.

## Membership page: content blocks

Add **Blocks** to the Membership page to put content under the sign-up section: image and text,
plain text, call to action (button) and FAQ. FAQ blocks that sit together form one list (Heading
is the question, Body is the answer).
**One-off setup:** `bun run scripts/add-membership-blocks-field.ts --apply`

## Mixcloud host tags

Mixcloud only tags a host whose Cosmic profile has a **Mixcloud Username**. A handle, `@handle`
or a pasted Mixcloud profile link all work. The Upload Master form warns about any selected host
without one. To list every recent host who is missing one:
`bun run scripts/audit-mixcloud-hosts.ts --days=120 --csv=hosts.csv`
After a show goes live on Mixcloud, the publishing job now checks the tags and logs any host that
was requested but not tagged (look for "Mixcloud did not tag every host" in the logs).
Usernames hosts type into the submission form (written as `@name` or a Mixcloud link) now show up
in Upload Master under "Tag these Mixcloud usernames". Links are ticked for you. A bare `@name` is
left unticked, because it could be an Instagram handle, so check it is their Mixcloud first. The
two-host limit still applies.

## Weekly shows and repeating hosts

You can already edit these yourselves in Cosmic under **Recurring Shows**. Change the placeholder
copy on a show and the next weekly pages use it. To add a new repeating host, create and publish a
Recurring Show with the host, day, start time and duration. Unpublish one to stop its pages being
created. Pages that already exist are not rewritten. Five older pages still say "Audio, genres, and
tracklist to be added after the live show." and can be edited by hand: Shai Space (21 Aug and 3
Jul), Alfie Panaiotis (1 Jul), Worldwide Breakfast (1 Jul) and Worldwide Breakfast: Kamar (5 Aug).

## Hand-picking shows on the homepage

You are not limited to show type. In a **Coloured Sections** block, each section has `Episodes`
(pick individual shows) and `Hosts` (the latest shows from those hosts) as well as `Show Type`.
If Episodes is filled in it is used, otherwise Hosts, otherwise Show Type, so leave the ones you
don't want empty. None of them is required. For a hand-picked archive row, add a **Sections** block,
set its type to **Archive** and choose the shows under Items.
