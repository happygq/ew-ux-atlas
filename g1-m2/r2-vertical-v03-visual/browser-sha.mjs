import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

// The Stage C engine hashes canonical UTF-8 JSON synchronously.
export function createHash(algorithm) {
  if (algorithm !== 'sha256') throw new Error('Unsupported hash');
  const hash = sha256.create();
  return {
    update(value, encoding) {
      if (encoding !== 'utf8') throw new Error('Unsupported input encoding');
      hash.update(utf8ToBytes(value));
      return this;
    },
    digest(encoding) {
      if (encoding !== 'hex') throw new Error('Unsupported output encoding');
      return bytesToHex(hash.digest());
    },
  };
}
