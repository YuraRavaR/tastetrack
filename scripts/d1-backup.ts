// Encrypted backups of an environment's D1 (ADR-0009). Every deploy takes one before it migrates,
// and keeps it as a workflow artifact; see docs/production.md.
//
//   pnpm backup take --env local|staging|production --output <file.sql.age>
//   pnpm backup restore <file.sql.age> --to <directory>
//   pnpm backup open <run-id>
//
// take exports the database, schema then rows, and encrypts the export with age to D1_BACKUP_RECIPIENT, the
// Operator's public key, so whoever holds the file can't read it: this repo's artifacts are
// public. restore decrypts a backup with the Operator's private key, the file D1_BACKUP_IDENTITY
// or ~/tastetrack-backup.key, and imports it into a new local D1 in that directory. open downloads
// a workflow run's backup and restores it into ~/tastetrack-backups/<run-id>. The export in the
// clear lives only in a temporary directory, deleted at the end.
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { Decrypter, Encrypter } from "age-encryption";
import { environments, parseEnvironment, WranglerError, wrangler } from "./wrangler-d1";

class BackupError extends Error {}

// A temporary directory for files in the clear, deleted whatever happens.
async function withTemporaryDirectory<T>(use: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), "tastetrack-backup-"));
  try {
    return await use(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function run(args: string[]): Promise<string> {
  const result = await wrangler(args);
  if (result.code !== 0) {
    throw new WranglerError(
      `wrangler ${args.slice(0, 2).join(" ")} failed:\n${result.stderr}${result.stdout}`,
    );
  }
  return result.stdout;
}

function option(args: string[], name: string): string {
  const value = args[args.indexOf(name) + 1];
  if (!args.includes(name) || !value) throw new BackupError(usage);
  return value;
}

async function take(args: string[]): Promise<void> {
  const environment = parseEnvironment(args);
  const output = option(args, "--output");
  const recipient = process.env.D1_BACKUP_RECIPIENT?.trim();
  if (!recipient?.startsWith("age1")) {
    throw new BackupError("Set D1_BACKUP_RECIPIENT to the age public key backups are for.");
  }
  const encrypter = new Encrypter();
  encrypter.addRecipient(recipient);
  // The schema, then the rows. One export writes each table's rows after its own CREATE, in the
  // order the tables were made, and a table a migration remade, such as users, comes after
  // tables whose rows refer to it: importing that fails with "no such table" once those rows
  // exist. Nothing migrates while a deploy backs up, so the two exports see one schema; each
  // table's rows come from one moment, if not the same moment as the schema.
  const encrypted = await withTemporaryDirectory(async (directory) => {
    const parts = [];
    for (const part of ["--no-data", "--no-schema"]) {
      const file = join(directory, `export${part}.sql`);
      await run(["d1", "export", "DB", ...environments[environment], part, "--output", file]);
      parts.push(await readFile(file));
    }
    return encrypter.encrypt(Buffer.concat(parts));
  });
  await writeFile(output, encrypted);
  console.log(`Backed up ${environment} to ${output} (${encrypted.length} bytes).`);
}

async function identity(): Promise<string> {
  const path = process.env.D1_BACKUP_IDENTITY || join(homedir(), "tastetrack-backup.key");
  const file = await readFile(path, "utf8").catch((error: Error) => {
    throw new BackupError(
      `Can't read the private key at ${path} (${error.message}). Set D1_BACKUP_IDENTITY to its file.`,
    );
  });
  const key = file.split("\n").find((line) => line.startsWith("AGE-SECRET-KEY-"));
  if (!key) throw new BackupError(`${path} holds no age private key.`);
  return key;
}

// The number of rows in each table of the restored database. One statement a table, sent as one
// command: D1 caps how many SELECTs a UNION may join.
async function rowCounts(target: string[]): Promise<Record<string, number>> {
  // The rows of each statement, in order.
  const query = async (sql: string) =>
    (
      JSON.parse(await run(["d1", "execute", "DB", ...target, "--json", "--command", sql])) as {
        results: Record<string, unknown>[];
      }[]
    ).map((statement) => statement.results);
  const [tables = []] = await query(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' " +
      "and name not like '_cf_%' order by name",
  );
  if (tables.length === 0) return {};
  const counts = await query(
    tables.map(({ name }) => `select '${name}' as name, count(*) as n from "${name}"`).join(";\n"),
  );
  return Object.fromEntries(counts.flat().map(({ name, n }) => [String(name), Number(n)] as const));
}

async function restoreBackup(backup: string, directory: string): Promise<void> {
  const existing = await readdir(directory).catch(() => []);
  if (existing.length > 0) {
    throw new BackupError(`${directory} isn't empty. Restore into a new directory.`);
  }
  const decrypter = new Decrypter();
  decrypter.addIdentity(await identity());
  const sql = await decrypter.decrypt(await readFile(backup)).catch(() => {
    throw new BackupError(`${backup} doesn't open with this private key, or isn't a backup.`);
  });
  // The top-level config's DB binding, kept in the directory instead of .wrangler.
  const target = ["--local", "--persist-to", directory];
  await withTemporaryDirectory(async (temporary) => {
    const file = join(temporary, "restore.sql");
    await writeFile(file, sql);
    await run(["d1", "execute", "DB", ...target, "--file", file]);
  });
  const counts = await rowCounts(target);
  const width = Math.max(...Object.keys(counts).map((name) => name.length));
  console.log(`Restored ${backup} into ${directory}. Rows per table:`);
  for (const [name, n] of Object.entries(counts)) console.log(`  ${name.padEnd(width)}  ${n}`);
  console.log(
    `Query it with: pnpm exec wrangler d1 execute DB --local --persist-to ${directory} --command "..."`,
  );
}

async function restore(args: string[]): Promise<void> {
  const backup = args[0];
  if (!backup || backup.startsWith("--")) throw new BackupError(usage);
  await restoreBackup(backup, option(args, "--to"));
}

async function open(args: string[]): Promise<void> {
  const runId = args[0];
  if (!runId || !/^\d+$/.test(runId)) throw new BackupError(usage);
  const directory = join(homedir(), "tastetrack-backups", runId);
  await withTemporaryDirectory(async (download) => {
    const gh = spawnSync(
      "gh",
      ["run", "download", runId, "--pattern", "d1-backup-*", "--dir", download],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    if (gh.status !== 0) throw new BackupError(`No backup could be downloaded from run ${runId}.`);
    const files = await readdir(download, { recursive: true });
    const backup = files.find((file) => file.endsWith(".sql.age"));
    if (!backup) throw new BackupError(`Run ${runId} has no backup.`);
    await restoreBackup(join(download, backup), directory);
  });
}

const commands = { take, restore, open } as const;

const usage = `Usage:
  pnpm backup take --env local|staging|production --output <file.sql.age>
  pnpm backup restore <file.sql.age> --to <directory>
  pnpm backup open <run-id>`;

try {
  const [command, ...args] = process.argv.slice(2);
  if (!command || !(command in commands)) throw new BackupError(usage);
  await commands[command as keyof typeof commands](args);
} catch (error) {
  if (!(error instanceof BackupError || error instanceof WranglerError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
