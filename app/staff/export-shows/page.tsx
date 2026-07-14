import { Metadata } from 'next';
import { getAllFilters } from '@/lib/actions/filters';
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
  const filters = await getAllFilters();
  const options: HostOrSeriesOption[] = [...filters.hosts, ...filters.series]
    .map(item => ({
      id: item.slug,
      slug: item.slug,
      title: item.title,
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
