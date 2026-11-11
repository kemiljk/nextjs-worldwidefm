'use client';

import { useState, useTransition } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { setEpisodeReminder } from '@/cosmic/blocks/user-management/actions';
import { useAuth } from '@/cosmic/blocks/user-management/AuthContext';
import {
  SCHEDULE_NOTIFICATIONS_CHANGED_EVENT,
  SCHEDULE_NOTIFICATIONS_STORAGE_KEY,
} from '@/lib/schedule-reminders';

export function EpisodeReminderButton({
  episodeId,
  initiallySaved,
}: {
  episodeId: string;
  initiallySaved: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  const toggle = async () => {
    if (!user) {
      router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    setMessage('');
    if (!saved) {
      if (typeof Notification === 'undefined') {
        setMessage('This browser does not support notifications.');
        return;
      }
      let permission: NotificationPermission;
      try {
        permission =
          Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission();
      } catch {
        setMessage('Unable to enable notifications in this browser.');
        return;
      }
      if (permission !== 'granted') {
        setMessage('Allow notifications in your browser settings to receive a reminder.');
        return;
      }
      localStorage.setItem(SCHEDULE_NOTIFICATIONS_STORAGE_KEY, 'enabled');
    }
    startTransition(async () => {
      const result = await setEpisodeReminder(episodeId, !saved);
      if (!result.success) {
        setMessage(result.error || 'Unable to save the reminder.');
        return;
      }
      setSaved(!saved);
      setMessage(
        !saved
          ? 'Reminder set for 10 minutes before the show. Keep Worldwide FM open in a tab.'
          : 'Reminder removed.'
      );
      window.dispatchEvent(new Event(SCHEDULE_NOTIFICATIONS_CHANGED_EVENT));
    });
  };

  return (
    <div>
      <button
        type='button'
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        className='inline-flex h-10 items-center gap-2 border border-almostblack px-4 font-mono text-m6 uppercase hover:bg-almostblack hover:text-white disabled:opacity-50 dark:border-white dark:hover:bg-white dark:hover:text-almostblack'
      >
        {saved ? <BellRing className='size-4' /> : <Bell className='size-4' />}
        {saved ? 'Reminder set' : 'Remind me'}
      </button>
      <p aria-live='polite' className='mt-1 max-w-sm text-sm'>
        {message ||
          (saved ? 'Allow browser notifications and keep Worldwide FM open in a tab.' : '')}
      </p>
    </div>
  );
}
