import type { Page } from "@playwright/test";
import { HomePage } from "./pages/HomePage";
import { InvitesPage } from "./pages/InvitesPage";
import { ListsPage } from "./pages/ListsPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

// The app as one browser tab shows it: one field per page. The frame every page shares, such as
// the header, is reached through the page the test is on: ui.listsPage.header.
export class Ui {
  readonly homePage: HomePage;
  readonly invitesPage: InvitesPage;
  readonly listsPage: ListsPage;
  readonly loginPage: LoginPage;
  readonly registerPage: RegisterPage;

  constructor(private readonly page: Page) {
    this.homePage = new HomePage(page);
    this.invitesPage = new InvitesPage(page);
    this.listsPage = new ListsPage(page);
    this.loginPage = new LoginPage(page);
    this.registerPage = new RegisterPage(page);
  }

  // Opens an address no page object covers, such as one the app doesn't know.
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }
}
