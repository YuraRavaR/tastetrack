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

// Day, month, year with the US English three-letter month: British English would order it the
// same way but writes September as "Sept".
const dateFormat = new Intl.DateTimeFormat(locale, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// A calendar date in the viewer's time zone, e.g. "26 Oct 2026".
export function formatDate(date: Date): string {
  const parts = Object.fromEntries(dateFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.day} ${parts.month} ${parts.year}`;
}
