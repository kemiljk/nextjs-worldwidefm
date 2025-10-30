/**
 * Date utility functions for handling broadcast dates
 * Supports both old format (ISO strings) and new format (YYYY-MM-DD + HH:MM)
 */

/**
 * Parse broadcast date and time into a Date object
 * Handles both old format (ISO string) and new format (date + time)
 * Also checks broadcast_date_old as fallback during migration
 * @param broadcast_date - Either "2025-09-04T07:00:00+00:00" (old) or "2025-09-04" (new)
 * @param broadcast_time - "HH:MM" format (e.g., "13:30")
 * @param broadcast_date_old - Fallback field during migration
 * @returns Date object in UTC or null
 */
export function parseBroadcastDateTime(
  broadcast_date: string | null | undefined,
  broadcast_time: string | null | undefined = null,
  broadcast_date_old: string | null | undefined = null
): Date | null {
  // Try broadcast_date first, fallback to broadcast_date_old during migration
  const dateToUse = broadcast_date || broadcast_date_old;

  if (!dateToUse) return null;

  // Handle old format (full ISO string)
  if (dateToUse.includes('T')) {
    return new Date(dateToUse);
  }

  // Handle new format (YYYY-MM-DD + HH:MM)
  const time = broadcast_time || '00:00';
  return new Date(`${dateToUse}T${time}:00Z`);
}

/**
 * Convert broadcast date and time to ISO string for RadioCult API
 * Works with both old and new formats
 * Also checks broadcast_date_old as fallback during migration
 */
export function broadcastToISOString(
  broadcast_date: string | null | undefined,
  broadcast_time: string | null | undefined = null,
  broadcast_date_old: string | null | undefined = null
): string | null {
  const date = parseBroadcastDateTime(broadcast_date, broadcast_time, broadcast_date_old);
  return date ? date.toISOString() : null;
}

/**
 * Extract date part only (YYYY-MM-DD) from any date format
 */
export function extractDatePart(dateString: string | null | undefined): string | null {
  if (!dateString) return null;

  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // If ISO string, extract date part
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return null;
  }
}

/**
 * Extract time part (HH:MM) from any date format
 */
export function extractTimePart(dateString: string | null | undefined): string | null {
  if (!dateString) return null;

  // If it's an ISO string, extract time
  if (dateString.includes('T')) {
    try {
      return new Date(dateString).toISOString().substring(11, 16);
    } catch (error) {
      console.error('Error extracting time:', dateString, error);
      return null;
    }
  }

  return null;
}

/**
 * Get the UK timezone abbreviation (BST or GMT) for a given date
 * BST is British Summer Time (UTC+1), GMT is Greenwich Mean Time (UTC+0)
 * @param date - The date to check (defaults to current date)
 * @returns The timezone abbreviation with brackets, e.g., "[BST]" or "[GMT]"
 */
export function getUKTimezoneAbbreviation(date: Date = new Date()): string {
  // Validate date - check if it's a valid, finite date
  if (!(date instanceof Date) || isNaN(date.getTime()) || !isFinite(date.getTime())) {
    return '[GMT]';
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      timeZoneName: 'short',
    });

    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(part => part.type === 'timeZoneName');

    return tzPart ? `[${tzPart.value}]` : '[GMT]';
  } catch (error) {
    console.error('Error formatting timezone abbreviation:', error);
    return '[GMT]';
  }
}
