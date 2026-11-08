import type { Page, Response } from "@playwright/test";
import { step } from "../step";
import { FilmPage } from "./pages/FilmPage";
import { InvitesPage } from "./pages/InvitesPage";
import { LibraryPage } from "./pages/LibraryPage";
import { ListPage } from "./pages/ListPage";
import { ListsPage } from "./pages/ListsPage";
import { LoginPage } from "./pages/LoginPage";
import { NewPasswordPage } from "./pages/NewPasswordPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SavedPage } from "./pages/SavedPage";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SharedPage } from "./pages/SharedPage";

// The app as one browser tab shows it: one field per page. The frame every page shares, such as
// the header, is reached through the page the test is on: ui.listsPage.header.
export class Ui {
  readonly filmPage: FilmPage;
  readonly invitesPage: InvitesPage;
  readonly libraryPage: LibraryPage;
  readonly listPage: ListPage;
  readonly listsPage: ListsPage;
  readonly loginPage: LoginPage;
  readonly newPasswordPage: NewPasswordPage;
  readonly registerPage: RegisterPage;
  readonly savedPage: SavedPage;
  readonly searchPage: SearchPage;
  readonly settingsPage: SettingsPage;
  readonly sharedPage: SharedPage;

  constructor(private readonly page: Page) {
    this.filmPage = new FilmPage(page);
    this.invitesPage = new InvitesPage(page);
    this.libraryPage = new LibraryPage(page);
    this.listPage = new ListPage(page);
    this.listsPage = new ListsPage(page);
    this.loginPage = new LoginPage(page);
    this.newPasswordPage = new NewPasswordPage(page);
    this.registerPage = new RegisterPage(page);
    this.savedPage = new SavedPage(page);
    this.searchPage = new SearchPage(page);
    this.settingsPage = new SettingsPage(page);
    this.sharedPage = new SharedPage(page);
  }

  // Opens an address no page object covers, such as one the app doesn't know.
  @step
  async goto(path: string): Promise<Response | null> {
    return this.page.goto(path);
  }
}
