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

// British English orders a date day, month, year rather than the US month, day, year.
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

// A calendar date in the viewer's time zone, e.g. "26 Oct 2026".
export function formatDate(date: Date): string {
  return dateFormat.format(date);
}
