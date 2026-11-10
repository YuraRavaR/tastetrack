import { ScopedComponent } from "./ScopedComponent";

export class Footer extends ScopedComponent {
  readonly tmdbLogo = this.root.getByRole("img", { name: "TMDB" });
  readonly openLibraryLink = this.root.getByRole("link", { name: "Open Library" });

  text(content: string) {
    return this.root.getByText(content);
  }

  appVersion(version: string) {
    return this.root.getByText(`v${version}`, { exact: true });
  }
}
