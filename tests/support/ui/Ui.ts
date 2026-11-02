import type { Page } from "@playwright/test";
import { HomePage } from "./pages/HomePage";
import { InvitesPage } from "./pages/InvitesPage";
import { ListsPage } from "./pages/ListsPage";
import { LoginPage } from "./pages/LoginPage";
import { LogPage } from "./pages/LogPage";
import { NewPasswordPage } from "./pages/NewPasswordPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SettingsPage } from "./pages/SettingsPage";

// The app as one browser tab shows it: one field per page. The frame every page shares, such as
// the header, is reached through the page the test is on: ui.listsPage.header.
export class Ui {
  readonly homePage: HomePage;
  readonly invitesPage: InvitesPage;
  readonly listsPage: ListsPage;
  readonly loginPage: LoginPage;
  readonly logPage: LogPage;
  readonly newPasswordPage: NewPasswordPage;
  readonly registerPage: RegisterPage;
  readonly settingsPage: SettingsPage;

  constructor(private readonly page: Page) {
    this.homePage = new HomePage(page);
    this.invitesPage = new InvitesPage(page);
    this.listsPage = new ListsPage(page);
    this.loginPage = new LoginPage(page);
    this.logPage = new LogPage(page);
    this.newPasswordPage = new NewPasswordPage(page);
    this.registerPage = new RegisterPage(page);
    this.settingsPage = new SettingsPage(page);
  }

  // Opens an address no page object covers, such as one the app doesn't know.
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }
}
