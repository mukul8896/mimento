import { createServer, type Server, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';

/**
 * A clamd stand-in that speaks the real INSTREAM protocol, so the production scanner client is
 * what the tests exercise. `infect(true)` makes it report every stream as infected; `setDown`
 * closes connections without answering, like clamd still loading its signatures.
 */
export type FakeClamd = Awaited<ReturnType<typeof startFakeClamd>>;

export async function startFakeClamd() {
  let infected = false;
  let down = false;
  let scanned = 0;
  const sockets = new Set<Socket>();

  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    if (down) return socket.destroy();
    let buffer = Buffer.alloc(0);
    let headerSeen = false;
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!headerSeen) {
        const nul = buffer.indexOf(0);
        if (nul < 0) return;
        if (buffer.subarray(0, nul).toString() !== 'zINSTREAM') return socket.destroy();
        buffer = buffer.subarray(nul + 1);
        headerSeen = true;
      }
      // Consume length-prefixed chunks until the zero-length terminator.
      for (;;) {
        if (buffer.length < 4) return;
        const len = buffer.readUInt32BE(0);
        if (len === 0) {
          scanned += 1;
          socket.end(infected ? 'stream: Eicar-Test-Signature FOUND\0' : 'stream: OK\0');
          return;
        }
        if (buffer.length < 4 + len) return;
        buffer = buffer.subarray(4 + len);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as AddressInfo).port,
    get scanned() {
      return scanned;
    },
    infect: (value: boolean) => (infected = value),
    setDown: (value: boolean) => (down = value),
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}
