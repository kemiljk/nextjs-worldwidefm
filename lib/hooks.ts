import { useState, useEffect } from "react";
import { getRadioShows, getSchedule, transformShowToViewData, getRadioShowBySlug } from "./cosmic-service";
import { RadioShowObject, ScheduleObject } from "./cosmic-config";

export function useRadioShows(limit = 5) {
  const [shows, setShows] = useState<ReturnType<typeof transformShowToViewData>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchShows() {
      try {
        setLoading(true);
        const response = await getRadioShows({ limit });

        if (response.objects && response.objects.length > 0) {
          const transformedShows = response.objects.map(transformShowToViewData);
          setShows(transformedShows);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error fetching radio shows"));
      } finally {
        setLoading(false);
      }
    }

    fetchShows();
  }, [limit]);

  return { shows, loading, error };
}

export function useRadioShowBySlug(slug: string) {
  const [show, setShow] = useState<ReturnType<typeof transformShowToViewData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchShow() {
      if (!slug) return;

      try {
        setLoading(true);
        const response = await getRadioShowBySlug(slug);

        if (response.objects && response.objects.length > 0) {
          setShow(transformShowToViewData(response.objects[0]));
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(`Unknown error fetching radio show: ${slug}`));
      } finally {
        setLoading(false);
      }
    }

    fetchShow();
  }, [slug]);

  return { show, loading, error };
}

export function useSchedule(slug = "main-schedule") {
  const [schedule, setSchedule] = useState<ScheduleObject | null>(null);
  const [currentShow, setCurrentShow] = useState<ReturnType<typeof transformShowToViewData> | null>(null);
  const [upcomingShow, setUpcomingShow] = useState<ReturnType<typeof transformShowToViewData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        setLoading(true);
        const response = await getSchedule(slug);

        if (response.object) {
          setSchedule(response.object);

          // This is just a placeholder - in a real app, you would implement logic to
          // determine the current and upcoming shows based on the schedule data
          // For now, let's fetch the first two shows to use as examples
          const showsResponse = await getRadioShows({ limit: 2 });

          if (showsResponse.objects && showsResponse.objects.length > 0) {
            setCurrentShow(transformShowToViewData(showsResponse.objects[0]));

            if (showsResponse.objects.length > 1) {
              setUpcomingShow(transformShowToViewData(showsResponse.objects[1]));
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(`Unknown error fetching schedule: ${slug}`));
      } finally {
        setLoading(false);
      }
    }

    fetchSchedule();
  }, [slug]);

  return { schedule, currentShow, upcomingShow, loading, error };
}
