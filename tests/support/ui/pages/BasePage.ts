import type { Locator, Page } from "@playwright/test";
import { step } from "../../step";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { MainNav } from "../components/MainNav";

// `Params` are what the page's address needs, such as a List's id: none for most pages.
export abstract class BasePage<Params extends unknown[] = []> {
  readonly header: Header;
  // Wherever the sections are: the tab bar on a phone, the header from md.
  readonly mainNav: MainNav;
  // Every navigation on the page, named or not, for a page that must have none.
  readonly navigations: Locator;
  readonly main: Locator;
  readonly footer: Footer;

  constructor(protected readonly page: Page) {
    this.header = new Header(page);
    this.mainNav = new MainNav(page.getByRole("navigation", { name: "Main" }));
    this.navigations = page.getByRole("navigation");
    this.main = page.getByRole("main");
    this.footer = new Footer(page.getByRole("contentinfo"));
  }

  abstract path(...params: Params): string;

  @step
  async goto(...params: Params): Promise<void> {
    await this.page.goto(this.path(...params));
  }
}
