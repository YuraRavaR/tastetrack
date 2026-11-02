import type { Page } from "@playwright/test";

// A part of the app shown on several pages, such as the header. Its locators are fields built from
// `page`.
export abstract class BaseComponent {
  constructor(protected readonly page: Page) {}
}
