import type { Locator } from "@playwright/test";

// A part of the app inside one element, such as a section of a page, a row or a dialog. Its
// locators search inside `root`, so two alike parts on one page don't mix.
export abstract class ScopedComponent {
  constructor(readonly root: Locator) {}
}
