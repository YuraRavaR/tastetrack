import { expect, test } from "@playwright/test";

// What anyone can call. Every other route takes a session.
const publicRoutes = [
  "GET /api/health",
  "POST /api/auth/register",
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "GET /api/catalog/items",
  "GET /api/shared-lists/{token}",
];

interface Operation {
  responses: Record<string, unknown>;
  security?: unknown;
}

test("the OpenAPI spec gives every route a 2xx response and, unless it is public, the session", async ({
  request,
}) => {
  const response = await request.get("/api/openapi.json");

  expect(response.status()).toBe(200);
  const spec = await response.json();
  expect(spec.openapi).toMatch(/^3\.1/);
  const paths: Record<string, Record<string, Operation>> = spec.paths;
  const routes = Object.entries(paths).flatMap(([path, operations]) => {
    return Object.entries(operations).map(([method, operation]) => {
      return { route: `${method.toUpperCase()} ${path}`, ...operation };
    });
  });
  expect(routes.map(({ route }) => route)).toEqual(expect.arrayContaining(publicRoutes));
  for (const { route, responses, security } of routes) {
    expect(
      Object.keys(responses).filter((status) => status.startsWith("2")),
      route,
    ).not.toEqual([]);
    expect(security, route).toEqual(publicRoutes.includes(route) ? undefined : [{ session: [] }]);
  }
});

// `tsc` holds a handler to the statuses its route declares, but none of this.
test("the OpenAPI spec describes the lockout, the restricted session and required fields", async ({
  request,
}) => {
  const spec = await (await request.get("/api/openapi.json")).json();

  const locked = spec.paths["/api/auth/login"].post.responses["429"];
  expect(locked.headers["Retry-After"]).toBeDefined();
  expect(spec.components.securitySchemes.session.description).toContain("password_change_required");
  expect(spec.components.schemas.LoginResponse.required).toContain("passwordChangeRequired");
  expect(spec.components.schemas.User.required).toContain("displayName");
  expect(spec.components.schemas.UserDeletionRequest.required).toEqual(["password"]);
});
