import { BlobPreconditionFailedError, get, put } from '@vercel/blob';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BoardData } from './board';

const localDirectory = join(process.cwd(), '.data');
const localPath = join(localDirectory, 'board.json');
const blobPath = 'attendance/board.json';

function emptyBoard(): BoardData {
  return { schedules: {}, attendance: {} };
}

function usesBlob() {
  return Boolean(process.env.VERCEL || process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

async function readLocal(): Promise<BoardData> {
  try {
    return JSON.parse(await readFile(localPath, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyBoard();
    throw error;
  }
}

async function readBlob() {
  const result = await get(blobPath, { access: 'private', useCache: false });
  if (!result) return { data: emptyBoard(), etag: undefined };
  if (result.statusCode !== 200) throw new Error('Unable to read attendance data');
  const data: BoardData = await new Response(result.stream).json();
  return { data, etag: result.blob.etag };
}

export async function readBoard() {
  return usesBlob() ? (await readBlob()).data : readLocal();
}

let localWrites: Promise<unknown> = Promise.resolve();

export async function updateBoard(change: (data: BoardData) => void): Promise<BoardData> {
  if (!usesBlob()) {
    const write = localWrites.then(async () => {
      const data = await readLocal();
      change(data);
      await mkdir(localDirectory, { recursive: true });
      const temporaryPath = `${localPath}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(data), { mode: 0o600 });
      await rename(temporaryPath, localPath);
      return data;
    });
    localWrites = write.catch(() => undefined);
    return write;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, etag } = await readBlob();
    change(data);
    try {
      await put(blobPath, JSON.stringify(data), {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        ifMatch: etag,
      });
      return data;
    } catch (error) {
      // Two first writes may both see an empty store. Only one can create the blob.
      if (error instanceof BlobPreconditionFailedError) continue;
      if (!etag && (await readBlob()).etag) continue;
      throw error;
    }
  }
  throw new Error('Attendance changed while saving');
}
