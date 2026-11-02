import type { Page } from "@playwright/test";
import { Header } from "../components/Header";

export abstract class BasePage {
  abstract readonly path: string;
  readonly header: Header;

  constructor(readonly page: Page) {
    this.header = new Header(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }
}
