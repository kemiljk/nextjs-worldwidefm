# Schedule placeholders and the rolling week

The public schedule shows **seven days starting today** (Europe/London), not Monday to Sunday.
Weekly entries in the Cosmic `schedule` object are templates keyed by weekday: the "Thursday"
block applies to whichever Thursday falls inside the window.

## Plain-text placeholders

To hold a slot before the host has submitted their show, add an entry to the day's `Show`
repeater and fill in only:

- **Placeholder Title**: the text to display, e.g. `Gilles Peterson`
- **Broadcast Time Override**: start time, e.g. `12:00`
- **Override Duration** (optional): hours (`2`) or `HH:MM`. Defaults to one hour.

Leave **Episode** empty. The placeholder shows on the schedule until a *published* episode on
that date starts inside the placeholder's slot (from its start time, up to but not including its
end). The episode then replaces it automatically, with no edit to the schedule.

If an Episode is linked, the entry behaves as before and the placeholder title is ignored.

## One-off setup

The fields must exist on the `schedule` object type:

```sh
bun run scripts/add-schedule-placeholder-field.ts          # dry run
bun run scripts/add-schedule-placeholder-field.ts --apply  # update Cosmic
```
