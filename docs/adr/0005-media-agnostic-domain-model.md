# Media-agnostic domain model from day one

Only films ship in the MVP, yet the domain model is built around a generic Media Item with a Media Type, not around "Film". Series, books and albums are planned as later milestones, each with its own External Source, and retrofitting a film-shaped schema and vocabulary later would mean a data migration and a rename across the whole codebase.

## Consequences

- Domain terms avoid film-only words: Log Entry not "watch", Revisit not "rewatch", Backlog not "watchlist". The UI uses the media-specific wording for each Media Type.
- A Media Item does not have to come from an External Source: Manual Media Items have no External Reference and belong to the User who created it.
- Each List and each Backlog has one Media Type. Mixed-type Lists may come later, so nothing should assume a List's type is fixed forever at the data level.
- Some MVP code is more general than films alone require; that is deliberate.
