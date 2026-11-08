// The shell of the redesign's dialogs, as the Watched dialog drew it: a bottom sheet below `md`, with no
// swipe to close, and a centred dialog from `md`. Its form's body scrolls between a header and a
// footer that stay put. For DialogContent, with its own close button off.
export const sheetClasses =
  "top-auto bottom-0 left-0 flex max-h-[calc(100dvh-3rem)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-sheet rounded-b-none border-x-0 border-b-0 p-0 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:slide-in-from-bottom-8 sm:max-w-none md:top-[72px] md:bottom-auto md:left-[50%] md:max-h-[calc(100dvh-9rem)] md:w-[calc(100%-2rem)] md:max-w-[480px] md:translate-x-[-50%] md:rounded-lg md:border md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=open]:slide-in-from-bottom-0";
