/**
 * Time formatting utilities
 * Provides functions for formatting timestamps into human-readable relative times
 */

/**
 * Format a timestamp into relative time (e.g., "2h ago", "1d ago")
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  // Convert to seconds
  const seconds = Math.floor(diff / 1000);

  // Less than a minute
  if (seconds < 60) {
    return "just now";
  }

  // Less than an hour
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  // Less than a day (24 hours)
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  // Less than a week
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  // Less than a month (30 days)
  const weeks = Math.floor(days / 7);
  if (days < 30) {
    return `${weeks}w ago`;
  }

  // Less than a year
  const months = Math.floor(days / 30);
  if (days < 365) {
    return `${months}mo ago`;
  }

  // Years
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/**
 * Format a timestamp into a full date string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string (e.g., "Jan 15, 2024 at 3:45 PM")
 */
export function formatFullDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format a timestamp into a short date string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string (e.g., "Jan 15, 2024")
 */
export function formatShortDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Get a user-friendly time description that combines relative and absolute time
 * Shows relative time for recent items, absolute date for older items
 * @param timestamp - Unix timestamp in milliseconds
 * @returns User-friendly time string
 */
export function formatSmartTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  // For items less than 7 days old, show relative time
  if (days < 7) {
    return formatRelativeTime(timestamp);
  }

  // For older items, show short date
  return formatShortDate(timestamp);
}
