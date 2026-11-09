# Media-agnostic domain model from day one

Only films ship in the MVP, yet the domain model is built around a generic Media Item with a Media Type, not around "Film". Books follow films (ADR-0011), then series, albums and games, each with its own External Source, and retrofitting a film-shaped schema and vocabulary later would mean a data migration and a rename across the whole codebase. (Revised 2026-11-09, when books were specified.)

## Consequences

- Domain terms avoid film-only words: Log Entry not "watch", Revisit not "rewatch", Backlog not "watchlist". The UI uses the media-specific wording for each Media Type.
- A Media Item does not have to come from an External Source: Manual Media Items have no External Reference and belong to the User who created it.
- Each List and each Backlog has one Media Type. Mixed-type Lists may come later, so nothing should assume a List's type is fixed forever at the data level.
- A catalog-backed Media Item is a work, not an edition: a translation or another edition of a work is the same Media Item.
- In Progress is a state of its own, shared by every Media Type that needs one, separate from Log Entries and the Backlog. How far along a User is comes later, decided per Media Type.
- Each External Source sits behind one catalog source module. Shared code reaches metadata only through the shared cache and the registry that maps each Media Type to its source, never by calling a source directly.
- Some MVP code is more general than films alone require; that is deliberate.
