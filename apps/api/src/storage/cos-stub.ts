import { AppError } from '../lib/errors.js';
import type { StoragePort } from './port.js';

/** COS 预留：一期不接通真实 COS */
export class CosAdapter implements StoragePort {
  async put(): Promise<void> {
    throw new AppError('internal_error', 'COS 存储一期未启用', 501);
  }
  async get(): Promise<Buffer> {
    throw new AppError('internal_error', 'COS 存储一期未启用', 501);
  }
  async delete(): Promise<void> {
    throw new AppError('internal_error', 'COS 存储一期未启用', 501);
  }
}
