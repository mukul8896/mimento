import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';

/**
 * A software passkey for tests: a real P-256 key producing genuine WebAuthn responses (no
 * attestation), so the server's verification runs exactly as it does for a phone.
 */
const b64url = (b: Uint8Array | Buffer) => Buffer.from(b).toString('base64url');
const sha = (b: Uint8Array | Buffer | string) => createHash('sha256').update(b).digest();

export class SoftPasskey {
  readonly credentialId = randomBytes(32);
  private readonly privateKey: KeyObject;
  private readonly jwk: { x: string; y: string };
  private counter = 0;

  constructor(
    private readonly origin = 'http://localhost:3000',
    private readonly rpId = 'localhost',
  ) {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.privateKey = privateKey;
    this.jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  }

  get id(): string {
    return b64url(this.credentialId);
  }

  private clientData(type: string, challenge: string) {
    return Buffer.from(
      JSON.stringify({ type, challenge, origin: this.origin, crossOrigin: false }),
    );
  }

  register(challenge: string) {
    const cose = new Map<number, number | Uint8Array>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(this.jwk.x, 'base64url')],
      [-3, Buffer.from(this.jwk.y, 'base64url')],
    ]);
    const idLen = Buffer.alloc(2);
    idLen.writeUInt16BE(this.credentialId.length);
    const authData = Buffer.concat([
      sha(this.rpId),
      Buffer.from([0x01 | 0x04 | 0x08 | 0x10 | 0x40]), // UP, UV, backup-eligible, backed-up, AT
      Buffer.alloc(4),
      Buffer.alloc(16), // AAGUID
      idLen,
      this.credentialId,
      Buffer.from(isoCBOR.encode(cose)),
    ]);
    const attestationObject = isoCBOR.encode(
      new Map<string, unknown>([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', authData],
      ]) as never,
    );
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: b64url(this.clientData('webauthn.create', challenge)),
        attestationObject: b64url(attestationObject),
        transports: ['internal'],
      },
      clientExtensionResults: {},
    };
  }

  authenticate(challenge: string) {
    this.counter += 1;
    const count = Buffer.alloc(4);
    count.writeUInt32BE(this.counter);
    const authData = Buffer.concat([
      sha(this.rpId),
      Buffer.from([0x01 | 0x04 | 0x08 | 0x10]),
      count,
    ]);
    const clientDataJSON = this.clientData('webauthn.get', challenge);
    const signature = sign(
      'sha256',
      Buffer.concat([authData, sha(clientDataJSON)]),
      this.privateKey,
    );
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: b64url(clientDataJSON),
        authenticatorData: b64url(authData),
        signature: b64url(signature),
      },
      clientExtensionResults: {},
    };
  }
}
