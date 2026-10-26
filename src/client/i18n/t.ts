import { IntlMessageFormat, type PrimitiveType } from "intl-messageformat";
import { en, type MessageId } from "./en";

export type { MessageId };

const locale = "en";
const formats = new Map<MessageId, IntlMessageFormat>();

export function t(id: MessageId, values?: Record<string, PrimitiveType>): string {
  let format = formats.get(id);
  if (!format) {
    format = new IntlMessageFormat(en[id], locale);
    formats.set(id, format);
  }
  return String(format.format(values));
}

// US English: the three-letter month, then the day and year, "Oct 26, 2026".
const dateOptions: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const dateFormat = new Intl.DateTimeFormat(locale, dateOptions);
const utcDateFormat = new Intl.DateTimeFormat(locale, { ...dateOptions, timeZone: "UTC" });

// A calendar date in the viewer's time zone, e.g. "Oct 26, 2026".
export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

// A calendar day written YYYY-MM-DD, such as a Log Entry's date, the same way. It names the same
// day wherever it is read, so it is formatted in UTC rather than the viewer's time zone.
export function formatCalendarDate(date: string): string {
  return utcDateFormat.format(new Date(`${date}T00:00:00Z`));
}
