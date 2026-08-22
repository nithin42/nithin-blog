import getReadingTime from "reading-time";

/**
 * Estimate reading time for a blog entry's raw body text.
 * Returns a short label such as "4 min read".
 */
export const readingTimeLabel = (body: string | undefined): string => {
  if (!body) return "";
  const minutes = Math.max(1, Math.round(getReadingTime(body).minutes));
  return `${minutes} min read`;
};
