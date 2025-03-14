import { MoodObject } from "@/lib/cosmic-config";
import MoodCard from "@/components/mood-card";

interface MoodsSectionProps {
  moods: MoodObject[];
}

export default function MoodsSection({ moods }: MoodsSectionProps) {
  if (moods.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-lg font-medium text-gray-300 mb-4">MOODS</h3>
      <div className="flex flex-wrap gap-3 pb-2 no-scrollbar">
        {moods.map((mood) => (
          <MoodCard key={mood.id} mood={mood} className="min-w-[120px]" />
        ))}
      </div>
    </div>
  );
}
