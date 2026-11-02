import type { Page } from "@playwright/test";
import { step } from "../step";
import { HomePage } from "./pages/HomePage";
import { InvitesPage } from "./pages/InvitesPage";
import { ListPage } from "./pages/ListPage";
import { ListsPage } from "./pages/ListsPage";
import { LoginPage } from "./pages/LoginPage";
import { LogPage } from "./pages/LogPage";
import { NewPasswordPage } from "./pages/NewPasswordPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SharedPage } from "./pages/SharedPage";
import { WatchlistPage } from "./pages/WatchlistPage";

// The app as one browser tab shows it: one field per page. The frame every page shares, such as
// the header, is reached through the page the test is on: ui.listsPage.header.
export class Ui {
  readonly homePage: HomePage;
  readonly invitesPage: InvitesPage;
  readonly listPage: ListPage;
  readonly listsPage: ListsPage;
  readonly loginPage: LoginPage;
  readonly logPage: LogPage;
  readonly newPasswordPage: NewPasswordPage;
  readonly registerPage: RegisterPage;
  readonly settingsPage: SettingsPage;
  readonly sharedPage: SharedPage;
  readonly watchlistPage: WatchlistPage;

  constructor(private readonly page: Page) {
    this.homePage = new HomePage(page);
    this.invitesPage = new InvitesPage(page);
    this.listPage = new ListPage(page);
    this.listsPage = new ListsPage(page);
    this.loginPage = new LoginPage(page);
    this.logPage = new LogPage(page);
    this.newPasswordPage = new NewPasswordPage(page);
    this.registerPage = new RegisterPage(page);
    this.settingsPage = new SettingsPage(page);
    this.sharedPage = new SharedPage(page);
    this.watchlistPage = new WatchlistPage(page);
  }

  // Opens an address no page object covers, such as one the app doesn't know.
  @step
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }
}
