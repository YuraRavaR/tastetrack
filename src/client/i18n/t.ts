import { IntlMessageFormat, type PrimitiveType } from "intl-messageformat";
import { uk, type MessageId } from "./uk";

const locale = "uk";
const formats = new Map<MessageId, IntlMessageFormat>();

export function t(id: MessageId, values?: Record<string, PrimitiveType>): string {
  let format = formats.get(id);
  if (!format) {
    format = new IntlMessageFormat(uk[id], locale);
    formats.set(id, format);
  }
  return String(format.format(values));
}
