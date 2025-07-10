export async function getAllShows() { const res = await import('../lib/cosmic-config'); return (await res.cosmic.objects.find({ type: 'radio-shows' })).objects || []; }
