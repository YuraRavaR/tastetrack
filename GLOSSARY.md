# TasteTrack

A personal tracker for taste in media: users record what they have watched (later read and listened to), keep lists of what they want to get to, and share selected lists with others.

Terms marked _(planned)_ are not in the MVP but are part of the model's language already.

## Language

### Catalog

**Media Item**:
A single work (a film, and later a series, book or album) that users can log or put on Lists: either catalog-backed (it has an External Reference, is shared by all Users and has no owner) or a Manual Media Item.
_Avoid_: Movie, title, film (as a generic term), content, item

**Media Type**:
The kind of work a Media Item is: film first; series, book and album are planned.
_Avoid_: Category, kind, format

**External Source**:
The third-party catalog that owns a catalog-backed Media Item's metadata (title, poster, year); TMDB for films.
_Avoid_: Provider, database, API

**External Reference**:
The combination of External Source, Media Type and the source's own identifier; it is unique system-wide and identifies exactly one catalog-backed Media Item.
_Avoid_: TMDB ID (as a generic term), foreign ID

**Manual Media Item**:
A Media Item without an External Source or External Reference, created by and owned by one User, and visible only to them and to viewers of their shared Lists.
_Avoid_: Custom item, user item, local item

**Unavailable Media Item** _(planned)_:
A catalog-backed Media Item that its External Source no longer returns.
_Avoid_: Deleted item, broken item, orphan

**Localized Title**:
A Media Item's title in the app's metadata language (Ukrainian, falling back to English), shown as the primary title.
_Avoid_: Translated title, display title

**Original Title**:
A Media Item's title in its original language, always kept and shown as secondary to the Localized Title.
_Avoid_: Native title, English title

**Custom Title** _(planned)_:
A User's own title for a Media Item, visible only to that User.
_Avoid_: Nickname, alias

### Log

**Log**:
A User's complete set of Log Entries in time order.
_Avoid_: Diary, history, journal

**Log Entry**:
One record of a User having experienced a Media Item, with a required Rating and an optional date and Review.
_Avoid_: Watch, view, diary entry, log (for a single record)

**Experienced**:
The User action that creates a Log Entry ("Watched" for films in the UI).
_Avoid_: Watched (as a domain term), seen, consumed

**Revisit**:
A Log Entry the User has marked as a repeat experience of a Media Item.
_Avoid_: Rewatch, reread, relisten (UI words only)

**Rating**:
A User's score for a Media Item in one Log Entry, from 0.5 to 5 in half-star steps, the same for every Media Type.
_Avoid_: Score, stars, grade

**Log Order**:
The one ordering of Log Entries: undated entries first by creation time, then dated entries by date, with creation time breaking ties.
_Avoid_: Chronological order, sort order

**Current Rating**:
The Rating of the last of a User's Log Entries for a Media Item in Log Order.
_Avoid_: Latest rating, overall rating, my rating

**Review**:
Optional free text a User writes in one Log Entry.
_Avoid_: Note (that is for List Items), comment, notes

**Item History**:
All of one User's Log Entries for one Media Item, in time order.
_Avoid_: Timeline, item log

**Tag** _(planned)_:
A free-text label a User attaches to their own Log Entries.
_Avoid_: Label, category

**Like** _(planned)_:
A User's mark that they love a Media Item, separate from its Rating.
_Avoid_: Favourite, heart

### Lists

**List**:
A named, ordered collection of Media Items of one Media Type, owned by a User; its name is unique for that User.
_Avoid_: Collection, playlist, custom list

**List Item**:
The appearance of one Media Item in one List, at a position and with an optional Note.
_Avoid_: Entry (that is for Log Entries), list entry

**Note**:
Optional free text attached to a List Item.
_Avoid_: Review (that is for Log Entries), comment, annotation

**Backlog**:
A system List of the Media Items a User plans to experience; one per User per Media Type, which cannot be deleted or renamed ("Watchlist" for films in the UI).
_Avoid_: Watchlist (as a domain term), queue, to-do list

**Planned**:
The User action that adds a Media Item to their Backlog without creating a Log Entry ("Want to watch" for films in the UI).
_Avoid_: Want to watch (as a domain term), bookmarked, saved

### Sharing and social

**Visibility**:
Who may see a List or a User's Log, on an ordered scale where each level includes the ones before it: private, friends _(planned)_, link, public _(planned)_; a Log cannot be at link level.
_Avoid_: Privacy, access level, permissions

**Share Link**:
An unguessable public URL that shows one List, its Notes and the owner's Display Name to anyone holding it, without login; a List has at most one active Share Link.
_Avoid_: Public link, invite link, permalink

**Friendship** _(planned)_:
A two-way relationship between two Users, created when one accepts the other's Friend Request.
_Avoid_: Follow, connection, contact

**Friend Request** _(planned)_:
One User's pending request for a Friendship with another User.
_Avoid_: Invitation (that is an Invite Code), follow request

**Watch Together** _(planned)_:
The Media Items present in both of two friends' Backlogs of the same Media Type.
_Avoid_: Match, overlap, shared watchlist

### People and access

**User**:
A person with an account who owns their own records in TasteTrack.
_Avoid_: Account, member, profile

**Username**:
A User's unique login name.
_Avoid_: Login, handle, user ID

**Display Name**:
The name a User chooses to show others, for example on Share Links; it defaults to the Username.
_Avoid_: Nickname, full name, profile name

**Invite Code**:
A single-use code, valid for 7 days, that an existing User generates so someone new can register.
_Avoid_: Invitation link, referral, Friend Request

**Recovery Code** _(planned)_:
A one-time code that can reset a User's password once; a User holds a set of eight, issued at registration and replaceable on demand.
_Avoid_: Backup code, reset token

**Notice** _(planned)_:
A message the system leaves in a User's in-app notice list about something that happened to their data or account without their action, such as a Media Item conversion.
_Avoid_: Notification, alert, message

**Operator**:
The person who runs a TasteTrack deployment and acts on it only through command-line tooling, never as an in-app role.
_Avoid_: Admin, superuser, moderator
