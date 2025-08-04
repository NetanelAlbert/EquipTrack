export const UI_DATE_TIME_FORMAT = 'dd/MM/yyyy HH:mm';
export const UI_DATE_FORMAT = 'dd/MM/yyyy';

const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(date: string): boolean {
  return dateRegex.test(date) && !isNaN(new Date(date).getTime());
}

/**
 * Format date to UI format (DD/MM/YYYY)
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateToUi(date: Date): string {
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format date to string (YYYY-MM-DD)
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateToString(date: Date, locale = 'he-IL'): string {
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}