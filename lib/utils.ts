import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string to a more readable format
 * @param dateString ISO date string or "YYYY-MM-DD" format
 * @returns Formatted date string (e.g. "Feb 24, 2025")
 */
export function formatDate(dateString: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);

  // Check if date is valid
  if (isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a date string to a short format like 'Wed 01.11'
 * @param dateString ISO date string or 'YYYY-MM-DD' format
 * @returns Formatted date string (e.g. 'Wed 01.11')
 */
export function formatDateShort(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    })
    .replace(",", "");
}

/**
 * Remove all URLs from a string
 * @param text The input string
 * @returns The string with all URLs removed
 */
export function stripUrlsFromText(text: string): string {
  if (!text) return text;
  // Regex to match URLs (http, https, www, etc.)
  return text
    .replace(/https?:\/\/\S+|www\.[a-zA-Z0-9./?=_-]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
