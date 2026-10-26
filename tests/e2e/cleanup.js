import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
export default async function cleanup() {
  const directory = process.env.TRAMA_E2E_DATA_DIR;
  if (directory && path.dirname(directory) === tmpdir() && path.basename(directory).startsWith('trama-e2e-')) await rm(directory, { recursive: true, force: true });
}
