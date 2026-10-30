import { LocalFsAdapter } from './local-fs.js';
import type { StoragePort } from './port.js';

let cached: StoragePort | null = null;

export function getStorage(): StoragePort {
  if (!cached) {
    const root = process.env.STORAGE_ROOT ?? '/tmp/dtv-saas-storage';
    cached = new LocalFsAdapter(root);
  }
  return cached;
}

export function setStorageForTests(storage: StoragePort | null) {
  cached = storage;
}
