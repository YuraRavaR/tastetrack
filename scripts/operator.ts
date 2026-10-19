// The Operator CLI (GLOSSARY: Operator): account tasks run from a clone against the D1 of any
// environment, never through the app.
//
//   pnpm operator create-user --env local|staging|production
//
// Prompts for the Username and the password (twice, not echoed), so no credentials end up in
// the repo or the shell history. Answers can also be piped in, one per line. Staging and
// production need Wrangler logged in to the Cloudflare account.
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { Password, Username } from "../src/shared/api";
import { createUser } from "../src/worker/accounts/accounts";
import { WranglerError, wranglerDatabase } from "./wrangler-d1";

// The wrangler arguments that reach each environment's database.
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

// Creates the User with the Worker's own account code, so the CLI and the app write the users
// table the same way.
async function createUserCommand(environment: Environment): Promise<void> {
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

  const db = wranglerDatabase(environments[environment]);
  const created = await createUser(db, { username, password }, new Date());
  if (!created) throw new OperatorError("That Username is taken.");
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
  await createUserCommand(parseEnvironment(args));
} catch (error) {
  if (!(error instanceof OperatorError || error instanceof WranglerError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  readline.close();
}
