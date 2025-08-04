export const UI_DATE_TIME_FORMAT = 'dd/MM/yyyy HH:mm';
export const UI_DATE_FORMAT = 'dd/MM/yyyy';

const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(date: string): boolean {
  return dateRegex.test(date) && !isNaN(new Date(date).getTime());
}

/**
 * Format date to string (YYYY-MM-DD)
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateToString(date: Date): string {
  return dateTimeStringToDate(date.toISOString());
}

/**
 * Format date to Jerusalem DB date (YYYY-MM-DD)
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatJerusalemDBDate(date: Date): string {
  return dateTimeStringToDate(
    date.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Jerusalem',
    })
  );
}

function dateTimeStringToDate(datetime: string): string {
  return datetime.split('T')[0];
}
