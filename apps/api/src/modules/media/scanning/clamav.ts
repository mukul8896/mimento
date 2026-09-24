import { Socket } from 'node:net';

export type ScanVerdict = { clean: true } | { clean: false; signature: string };

const CHUNK = 64 * 1024;
const TIMEOUT_MS = 30_000;

/**
 * Minimal clamd client using the INSTREAM command over TCP: `zINSTREAM\0`, then chunks each
 * prefixed with a 4-byte big-endian length, then a zero-length chunk. clamd answers
 * `stream: OK` or `stream: <Signature> FOUND`. Anything else (including a size-limit error)
 * throws, so the file stays unscanned and is retried rather than wrongly marked clean.
 */
export class ClamAvScanner {
  constructor(
    private readonly host: string,
    private readonly port: number,
  ) {}

  scan(bytes: Buffer): Promise<ScanVerdict> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const replies: Buffer[] = [];
      const fail = (err: Error) => {
        socket.destroy();
        reject(err);
      };
      socket.setTimeout(TIMEOUT_MS, () => fail(new Error('clamd timed out')));
      socket.once('error', (err) => fail(new Error(`clamd unreachable: ${err.message}`)));
      socket.on('data', (d: Buffer) => replies.push(d));
      socket.once('end', () => {
        const reply = Buffer.concat(replies).toString('utf8').replace(/\0/g, '').trim();
        socket.destroy();
        const verdict = parseReply(reply);
        if (verdict) resolve(verdict);
        else reject(new Error(`Unexpected clamd reply: ${reply.slice(0, 120)}`));
      });
      socket.connect(this.port, this.host, () => {
        socket.write('zINSTREAM\0');
        for (let offset = 0; offset < bytes.length; offset += CHUNK) {
          const chunk = bytes.subarray(offset, offset + CHUNK);
          const size = Buffer.alloc(4);
          size.writeUInt32BE(chunk.length);
          socket.write(size);
          socket.write(chunk);
        }
        socket.end(Buffer.alloc(4));
      });
    });
  }
}

export function parseReply(reply: string): ScanVerdict | null {
  const match = /^stream: (.+?)(?: (FOUND|OK))?$/.exec(reply);
  if (reply === 'stream: OK') return { clean: true };
  if (match && match[2] === 'FOUND') return { clean: false, signature: match[1]!.slice(0, 200) };
  return null;
}
