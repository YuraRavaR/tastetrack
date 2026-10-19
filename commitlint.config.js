// Commit messages follow Conventional Commits. CI checks every commit in a PR and the PR title,
// which becomes the commit message on `main` when the PR is squash-merged.
export default {
  extends: ["@commitlint/config-conventional"],
};
