import { spawn } from "node:child_process";

export interface OperatorResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

// Runs the Operator CLI, as `pnpm operator` does but without pnpm's banner, with `answers` piped
// to its prompts, one per line.
export function runOperator(args: string[], answers: string[]): Promise<OperatorResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["--import", "tsx", "scripts/operator.ts", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
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
