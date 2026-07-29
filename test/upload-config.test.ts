import { describe, expect, it } from 'bun:test';
import {
  UPLOAD_BLOB_FETCH_TIMEOUT_MS,
  UPLOAD_CLIENT_TIMEOUT_MS,
  UPLOAD_EXTERNAL_TIMEOUT_MS,
  UPLOAD_ROUTE_MAX_DURATION_SEC,
} from '@/lib/upload-config';

describe('upload-config budget invariants', () => {
  it('keeps client timeout above route max duration', () => {
    expect(UPLOAD_CLIENT_TIMEOUT_MS).toBeGreaterThan(UPLOAD_ROUTE_MAX_DURATION_SEC * 1000);
  });

  it('keeps blob fetch and external upload within route max duration', () => {
    const totalInternalBudgetMs = UPLOAD_BLOB_FETCH_TIMEOUT_MS + UPLOAD_EXTERNAL_TIMEOUT_MS;
    expect(totalInternalBudgetMs).toBeLessThan(UPLOAD_ROUTE_MAX_DURATION_SEC * 1000);
  });
});
