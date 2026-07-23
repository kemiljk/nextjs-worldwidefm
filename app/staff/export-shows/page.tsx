import { Metadata } from 'next';
import { getCosmicHosts } from '@/lib/cosmic-host-service';
import { generateBaseMetadata } from '@/lib/metadata-utils';
import { ExportShowsForm, HostOrSeriesOption } from './export-shows-form';

export const generateMetadata = async (): Promise<Metadata> => {
  return generateBaseMetadata({
    title: 'Export Shows',
    description: 'Internal show export tool',
    noIndex: true,
  });
};

export default async function ExportShowsPage() {
  const hosts = await getCosmicHosts();
  const options: HostOrSeriesOption[] = hosts
    .map(host => ({
      id: host.id,
      slug: host.slug,
      title: host.title,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className='container mx-auto py-8'>
      <h1 className='text-h4 font-display uppercase font-normal text-almostblack dark:text-white mb-2'>
        Export Shows
      </h1>
      <p className='text-muted-foreground mb-6'>
        Select a host or series, then download a CSV of its shows.
      </p>
      <div className='bg-background border rounded-none p-6'>
        <ExportShowsForm options={options} />
      </div>
    </div>
  );
}
