// The Operator CLI (GLOSSARY: Operator): account tasks run from a clone against the D1 of any
// environment, never through the app.
//
//   pnpm operator create-user --env local|staging|production
//
// Prompts for the Username and the password (twice, not echoed), so no credentials end up in
// the repo or the shell history. Answers can also be piped in, one per line. Staging and
// production need Wrangler logged in to the Cloudflare account.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { Password, Username } from "../src/shared/api.ts";
import { hashPassword } from "../src/worker/accounts/password.ts";

// How `wrangler d1 execute` reaches each environment's database.
const environments = {
  local: ["--env", "local", "--local"],
  staging: ["--env", "staging", "--remote"],
  production: ["--remote"],
} as const;

type Environment = keyof typeof environments;

class OperatorError extends Error {}

// Readline echoes what is typed to its output, so a hidden answer mutes that output.
let muted = false;
const echo = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
const terminal = Boolean(process.stdin.isTTY);
const readline = createInterface({ input: process.stdin, output: echo, terminal });
readline.on("SIGINT", () => process.exit(130));
// Iterating buffers lines that arrive before they are asked for, as piped answers do.
const answers = readline[Symbol.asyncIterator]();

async function ask(question: string, { hidden = false } = {}): Promise<string> {
  process.stdout.write(question);
  muted = hidden;
  const answer = await answers.next();
  muted = false;
  if (hidden && terminal) process.stdout.write("\n");
  if (answer.done) throw new OperatorError("No answer given.");
  return answer.value;
}

// SQLite string literal. The values are a checked Username and base64, but quote them anyway.
function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function wrangler(
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "wrangler", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function execute(environment: Environment, sql: string): Promise<unknown[]> {
  const result = await wrangler([
    "d1",
    "execute",
    "DB",
    ...environments[environment],
    "--json",
    "--command",
    sql,
  ]);
  if (result.code !== 0) {
    throw new OperatorError(`wrangler d1 execute failed:\n${result.stderr}${result.stdout}`);
  }
  const [statement] = JSON.parse(result.stdout) as { results: unknown[] }[];
  return statement?.results ?? [];
}

// Mirrors createUser in src/worker/accounts/accounts.ts, which the Worker uses. Node can't load
// that module as it stands (its imports have no file extensions), so the insert is written here.
async function createUser(environment: Environment): Promise<void> {
  const username = await ask("Username: ");
  if (!Username.safeParse(username).success) {
    throw new OperatorError("A Username is 3–30 letters, digits or underscores (A–Z, 0–9, _).");
  }
  const password = await ask("Password: ", { hidden: true });
  if (!Password.safeParse(password).success) {
    throw new OperatorError("A password is 10–128 characters.");
  }
  if ((await ask("Password again: ", { hidden: true })) !== password) {
    throw new OperatorError("The passwords don't match.");
  }

  const { hash, salt, iterations } = await hashPassword(password);
  const created = await execute(
    environment,
    "INSERT INTO users (username, password_hash, password_salt, password_iterations, created_at) " +
      `VALUES (${quote(username)}, ${quote(hash)}, ${quote(salt)}, ${iterations}, ${Date.now()}) ` +
      "ON CONFLICT DO NOTHING RETURNING username",
  );
  if (created.length === 0) throw new OperatorError("That Username is taken.");
  console.log(`Created User ${username} in ${environment}.`);
}

function parseEnvironment(args: string[]): Environment {
  const value = args[args.indexOf("--env") + 1];
  if (!args.includes("--env") || !value || !(value in environments)) {
    throw new OperatorError("Name the environment: --env local|staging|production");
  }
  return value as Environment;
}

const usage = "Usage: pnpm operator create-user --env local|staging|production";

try {
  const [command, ...args] = process.argv.slice(2);
  if (command !== "create-user") throw new OperatorError(usage);
  await createUser(parseEnvironment(args));
} catch (error) {
  if (!(error instanceof OperatorError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  readline.close();
}
