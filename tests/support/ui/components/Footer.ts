import { ScopedComponent } from "./ScopedComponent";

export class Footer extends ScopedComponent {
  readonly tmdbLogo = this.root.getByRole("img", { name: "TMDB" });

  appVersion(version: string) {
    return this.root.getByText(`v${version}`, { exact: true });
  }
}
