// The Ukrainian message catalogue, in ICU MessageFormat.
// Film words belong here, not in domain code (ADR-0005).
export const uk = {
  "app.name": "TasteTrack",
  "app.tagline": "Ваш особистий трекер фільмів",
  "health.checking": "Перевіряємо з'єднання із сервером…",
  "health.ok": "Сервер працює",
  "health.unavailable": "Сервер недоступний",
  "films.count":
    "{count, plural, one {# фільм} few {# фільми} many {# фільмів} other {# фільму}}",
} as const;

export type MessageId = keyof typeof uk;
