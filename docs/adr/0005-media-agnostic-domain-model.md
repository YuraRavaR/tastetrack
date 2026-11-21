# Media-agnostic domain model from day one

Only films ship in the MVP, yet the domain model is built around a generic Media Item with a Media Type, not around "Film". Books follow films (ADR-0011), then series (ADR-0004), then games (ADR-0012), then albums (ADR-0013), each with its own External Source, and retrofitting a film-shaped schema and vocabulary later would mean a data migration and a rename across the whole codebase. (Revised 2026-11-09, when books were specified, 2026-11-15, when series were, 2026-11-19, when games were put before albums, #248, and 2026-11-21, when albums were, #266.)

## Consequences

- Domain terms avoid film-only words: Log Entry not "watch", Revisit not "rewatch", Backlog not "watchlist". The UI uses the media-specific wording for each Media Type.
- A Media Item does not have to come from an External Source: Manual Media Items have no External Reference and belong to the User who created it.
- Each List and each Backlog has one Media Type. Mixed-type Lists may come later, so nothing should assume a List's type is fixed forever at the data level.
- A catalog-backed Media Item is a work, not an edition: a translation or another edition of a work is the same Media Item.
- In Progress is a state of its own, shared by every Media Type that needs one, separate from Log Entries and the Backlog.
- How far along a User is, their Progress, is one optional value on In Progress, shaped by Media Type: for a series, the last episode watched; for a book, the page the User is on and, optionally, how many pages their edition has, both the User's own rather than the catalog's, since a work has many editions; a Media Type with no shape has no Progress. Only the latest value is kept, with no history of changes. Finishing or abandoning a Media Item ends its In Progress, and the Progress goes with it; a Log Entry never carries Progress. The server checks a Progress only for its shape and range, never against the cache, which is disposable (ADR-0004) and can lag behind what has been released.
- A Thought, a User's dated free text about a Media Item, is one model for every Media Type. It carries a copy of the Progress of the moment it was written, in its Media Type's shape. That copy is the User's own text, set by the client and changed only by the User, never updated from In Progress, so "only the latest Progress is kept" still holds for In Progress. (Added 2026-11-16, with Thoughts, #240.)
- Each External Source sits behind one catalog source module. Shared code reaches metadata only through the shared cache and the registry that maps each Media Type to its source, never by calling a source directly.
- Some MVP code is more general than films alone require; that is deliberate.
