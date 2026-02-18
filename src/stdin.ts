/**
 * Reads all of stdin if it is piped (non-TTY).
 * Returns undefined if stdin is a terminal (interactive).
 */
export function readStdin(): Promise<string | undefined> {
  if (process.stdin.isTTY) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", reject);
  });
}
