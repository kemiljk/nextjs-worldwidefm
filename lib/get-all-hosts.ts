export async function getAllHosts() { const res = await import('../lib/cosmic-config'); return (await res.cosmic.objects.find({ type: 'regular-hosts' })).objects || []; }
