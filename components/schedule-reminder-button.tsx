'use client';

import { Bell, BellRing } from 'lucide-react';
import { useState, useTransition } from 'react';
import { setScheduleReminder } from '@/cosmic/blocks/user-management/actions';
import { useAuth } from '@/cosmic/blocks/user-management/AuthContext';
import type { ScheduleShow } from '@/lib/types/schedule';
import {
  createScheduleReminderPreference,
  SCHEDULE_NOTIFICATIONS_CHANGED_EVENT,
} from '@/lib/schedule-reminders';

interface ScheduleReminderButtonProps {
  show: ScheduleShow;
  initiallySaved: boolean;
}

export function ScheduleReminderButton({ show, initiallySaved }: ScheduleReminderButtonProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(initiallySaved);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    if (!user) {
      window.location.href = `/login?redirect=${encodeURIComponent('/schedule')}`;
      return;
    }

    const previous = saved;
    setSaved(!saved);
    startTransition(async () => {
      const { key: _key, ...preference } = createScheduleReminderPreference(show);
      const result = await setScheduleReminder(preference, !previous);
      if (!result.success) setSaved(previous);
      else window.dispatchEvent(new Event(SCHEDULE_NOTIFICATIONS_CHANGED_EVENT));
    });
  };

  return (
    <button
      type='button'
      onClick={toggle}
      disabled={isPending}
      aria-pressed={saved}
      aria-label={saved ? `Remove reminder for ${show.name}` : `Remind me about ${show.name}`}
      className='ml-3 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border border-almostblack text-almostblack transition-colors hover:bg-almostblack hover:text-white disabled:opacity-50 dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black'
    >
      {saved ? <BellRing className='size-4' /> : <Bell className='size-4' />}
    </button>
  );
}
