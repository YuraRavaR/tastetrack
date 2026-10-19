# Zero infrastructure cost, long-lived without maintenance

TasteTrack is a personal project used long-term by a small group of friends, so it must cost nothing to run and must keep working for months with nobody touching it. Every hosting, storage and third-party choice has to fit a free tier that does not expire, pause on inactivity, or require periodic manual renewal.

## Consequences

- Free tiers that sleep or pause idle projects are ruled out even when they are otherwise attractive (see ADR-0002).
- Dependencies on paid services, or on free tiers with a trial expiry, need an explicit exception recorded as a new ADR.
