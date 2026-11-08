# Writing tests

How the Playwright suites are built. Running them, test hooks and deployed runs are in the root `README.md`; what a `@smoke` test may write is in `AGENTS.md`, under Deployed environments.

```text
tests/
  api/ e2e/ cli/ smoke/  # one Playwright project each
  support/
    fixtures.ts          # Users and API clients for every project
    api/                 # ApiClient: one controller per resource, one method per request
    scenarios/           # setup several specs share: createUser, film, alien…
    ui/                  # what browser tests use: fixtures.ts, Ui.ts, pages/, components/
```

## Users and sessions

- Each test gets a User of its own, so tests share no mutable data: `registeredUser` has no session, `loggedInUser` is logged in on `api`, and `loggedInApi` or `loggedInUi` serve a test that needs the session but not the User.
- A second client is a role. A role one spec needs is a fixture in that spec, such as `invitee` or `visitorUi`; one many specs need goes in `fixtures.ts`, such as `otherUserClient`; `createApiClient()` makes a device of its own.
- The test hooks secret travels per request, through `TestHooksController` or `at()` (ADR-0010).
- Names say what a thing is: `registeredUser`, `getCurrentUser()`. A short name fits inside a chain that supplies the context: `api.auth.login(...)`.

## API tests

- Controllers are `ApiClient` fields, reached through `api`. A new resource is a field plus its keys in `endpoints.ts`, with only the methods something calls. A method returns the raw `APIResponse`, and the test decides the status.
- `expectBody(response, status = 200, schema?)` checks the status, and the schema where one is passed: one happy path per route, and any test that checks only part of a body. It returns the raw body, so `toEqual` still sees a field that leaked.
- Request types and schemas come from `@shared/api`. An invalid body in a negative test is `data as never`.
- Data is plain values. A factory function earns its place only by real repetition.

## Browser tests

Specs import `test` and `expect` from `support/ui/fixtures`. There `api` shares the page's session, so `loggedInUser` logs the browser in too, and setup goes through `api` rather than through the UI.

The `@smoke` tests also run in the `mobile` project, on an iPhone in WebKit, so what they use works in the phone layout too, where the main nav sits at the bottom.

### Pages

- `ui` has one field per page, named for the page: `ui.loginPage`, `ui.filmPage`.
- A page extends `BasePage<Params>`, where `Params` is what its address needs: `BasePage<[mediaItemId: number]>`, `BasePage<[query?: string]>`, nothing for most pages. `path(...params)` is the address and `goto(...params)` opens it, so a spec checks the tab with `expect(page).toHaveURL(ui.listPage.path(list.id))`. An address no page covers opens with `ui.goto(path)`.
- `BasePage` holds the frame `AppLayout` renders, and only that: `header`, `mainNav`, `navigations`, `main`, `footer`. A spec reaches the frame through the page the tab is on: `ui.listsPage.header.accountMenu.logOut()`. A part only some pages show, such as a toast or a dialog, belongs to those pages.

### Components

- A part inside one element, such as a section, a row or a dialog, extends `ScopedComponent` and searches inside `root`. A part that reaches outside its element, as the account menu does, extends `BaseComponent`.
- A component takes the client's name for it: `LogEntryDialog`, `ItemHistoryRow`, `ShareLinkDialog`. One a single page uses lives in that page's file; `components/` holds what several pages share.
- A dialog named after its film or List comes from a factory on the page that opens it: `filmPage.logEntryDialog("Alien")`. Two pages may each keep a one-line factory for the same component; extract it once it carries logic.

### Members

- Locators are field initializers built from `this.page` or `this.root`, by role and label as the User sees them, and a page or component has no constructor of its own. A base class assigns its fields in its constructor instead, since there a field initializer runs before `page` is set (TS2729).
- A toggle's state is part of its field: `onWatchlistButton` is the bookmark with `pressed: true`.
- A Rating radio matches with `exact`, since "5 stars" would also match "2.5 stars".
- `text(content)` checks that text without a role is shown or gone, such as a description, a Note or a message. Whatever a User clicks or types into gets a field of its own.
- A closed set of choices is a union type, such as `AccountMenuItem` or `EntryAction`, so a typo fails `pnpm typecheck`.
- Each async action carries `@step` from `support/step.ts`, which shows it as `Class.method` in the report and the trace, without its arguments, which may be passwords. The step isn't boxed: a boxed step's failure shows no code.

### Specs

- Assertions live in the spec, and a page object holds locators and actions.
- In a spec, `page` controls the tab: `toHaveURL`, `reload`, `goBack`, `setViewportSize`, `clock`, `route`, `waitForResponse`, `keyboard`, `evaluate`.
- Code is named after `GLOSSARY.md` (Revisit, User), while locators keep the UI's words ("Rewatch", "Delete account").

## Proving a test

Run a new or changed spec with `--repeat-each=3 --retries=0`. Then break one locator or expected value it relies on, watch exactly the tests that use it go red, and restore it.
