import { access, readFile, writeFile } from "node:fs/promises";
import { type APIRequestContext, expect, test } from "@playwright/test";
import { generateIdentity, identityToRecipient } from "age-encryption";
import { eq } from "drizzle-orm";
import { wranglerDatabase } from "../../scripts/wrangler-d1";
import { users } from "../../src/db/schema";
import { runBackup, runOperator } from "../support/operator";
import { uniqueUsername } from "../support/scenarios/users";

// `pnpm backup` against the local D1 that the `local` Worker serves. Each test makes its own key
// pair; the backups and restored databases go in the test's output directory. Other tests' rows
// are in the backup too, so a test looks only for its own.

// An age key pair, the private key in a file as age-keygen writes it.
async function keyPair(path: string) {
  const identity = await generateIdentity();
  await writeFile(path, `# created: for a test\n${identity}\n`);
  return { identityFile: path, recipient: await identityToRecipient(identity) };
}

// A User with a session, so the backup holds rows that refer to the users table.
async function loggedInUser(request: APIRequestContext): Promise<string> {
  const username = uniqueUsername();
  const password = "a long enough password";
  await runOperator(["create-user", "--env", "local"], [username, password, password]);
  const login = await request.post("/api/auth/login", { data: { username, password } });
  expect(login.status()).toBe(200);
  return username;
}

test("a backup of the local D1 is encrypted and restores with its Users", async ({ request }) => {
  test.slow();
  const username = await loggedInUser(request);
  const { identityFile, recipient } = await keyPair(test.info().outputPath("key.txt"));
  const backup = test.info().outputPath("backup.sql.age");
  const restored = test.info().outputPath("restored");

  const take = await runBackup(["take", "--env", "local", "--output", backup], {
    D1_BACKUP_RECIPIENT: recipient,
  });

  expect(take.stderr).toBe("");
  expect(take.code).toBe(0);
  expect(take.stdout).toContain(`Backed up local to ${backup}`);
  const encrypted = await readFile(backup, "latin1");
  expect(encrypted.startsWith("age-encryption.org/v1\n")).toBe(true);
  expect(encrypted).not.toContain(username);

  const restore = await runBackup(["restore", backup, "--to", restored], {
    D1_BACKUP_IDENTITY: identityFile,
  });

  expect(restore.stderr).toBe("");
  expect(restore.code).toBe(0);
  expect(restore.stdout).toContain(`Restored ${backup} into ${restored}`);
  expect(restore.stdout).toMatch(/^ {2}users +\d+$/m);
  const db = wranglerDatabase(["--local", "--persist-to", restored]);
  const found = await db.select().from(users).where(eq(users.username, username));
  expect(found).toHaveLength(1);
});

test("a backup isn't taken without the public key to encrypt it to", async () => {
  const backup = test.info().outputPath("backup.sql.age");

  const take = await runBackup(["take", "--env", "local", "--output", backup], {
    D1_BACKUP_RECIPIENT: "",
  });

  expect(take.code).toBe(1);
  expect(take.stderr).toContain("Set D1_BACKUP_RECIPIENT");
  await expect(access(backup)).rejects.toThrow();
});

test("a backup doesn't restore with another private key", async () => {
  test.slow();
  const owner = await keyPair(test.info().outputPath("owner.txt"));
  const stranger = await keyPair(test.info().outputPath("stranger.txt"));
  const backup = test.info().outputPath("backup.sql.age");
  const restored = test.info().outputPath("restored");
  await runBackup(["take", "--env", "local", "--output", backup], {
    D1_BACKUP_RECIPIENT: owner.recipient,
  });

  const restore = await runBackup(["restore", backup, "--to", restored], {
    D1_BACKUP_IDENTITY: stranger.identityFile,
  });

  expect(restore.code).toBe(1);
  expect(restore.stderr).toContain(`${backup} doesn't open with this private key.`);
  await expect(access(restored)).rejects.toThrow();
});
