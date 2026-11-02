import { ScopedComponent } from "./ScopedComponent";

export class Footer extends ScopedComponent {
  readonly tmdbLogo = this.root.getByRole("img", { name: "TMDB" });

  text(content: string) {
    return this.root.getByText(content);
  }

  appVersion(version: string) {
    return this.root.getByText(`v${version}`, { exact: true });
  }
}
