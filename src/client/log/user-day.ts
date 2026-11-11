import { latestLogDate } from "../../shared/log";

// The User's IANA time zone, which the Worker takes to know their today.
export const userTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// Today where the User is: the latest date the Worker accepts from them.
export const userToday = () => latestLogDate(new Date(), userTimeZone());
