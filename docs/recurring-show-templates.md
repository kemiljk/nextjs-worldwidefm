# Recurring show templates

The weekly episode job reads published objects from **Recurring Shows** in Cosmic. To add a programme, create and publish a Recurring Show, choose a host or series, enter the broadcast weekday, UK local start time (24-hour `HH:MM`), duration in hours (for example `2` or `1.5`), and placeholder copy. The object title becomes the episode title. Unpublish a template to stop creating future episodes for it.

Changes affect episodes created by future runs; existing episodes are not rewritten. Show copy is taken from the template, and the host's latest published episode supplies its genres, locations and show type where available. The job creates drafts and skips an existing episode with the same title and broadcast date.

The initial six templates were seeded from the previously configured schedule and the copy the job would have used at setup time. The setup script defaults to a dry run; `bun run scripts/setup-recurring-shows.ts --apply` only creates missing templates and does not overwrite existing ones. The application change must be deployed for the scheduled job to use these templates.
