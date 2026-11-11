import { spawn } from "node:child_process";

export interface OperatorResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

// Runs an Operator script as `pnpm <script>` does but without pnpm's banner, with `answers` piped
// to its prompts, one per line, and `env` added to the environment.
function runScript(
  script: string,
  args: string[],
  { answers = [], env = {} }: { answers?: string[]; env?: Record<string, string> },
): Promise<OperatorResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["--import", "tsx", script, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
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
    child.stdin.end(answers.map((answer) => `${answer}\n`).join(""));
  });
}

// The Operator CLI, `pnpm operator`.
export function runOperator(args: string[], answers: string[]): Promise<OperatorResult> {
  return runScript("scripts/operator.ts", args, { answers });
}

// The D1 backup script, `pnpm backup`.
export function runBackup(args: string[], env: Record<string, string>): Promise<OperatorResult> {
  return runScript("scripts/d1-backup.ts", args, { env });
}
