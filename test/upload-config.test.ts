import { describe, expect, it } from 'bun:test';
import {
  UPLOAD_PROVIDER_TIMEOUT_MS,
  UPLOAD_PERSIST_TIMEOUT_MS,
  UPLOAD_CLEANUP_TIMEOUT_MS,
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

it('reserves persistence, cleanup and response time after all provider attempts', () => {
  expect(
    UPLOAD_PROVIDER_TIMEOUT_MS + UPLOAD_PERSIST_TIMEOUT_MS + UPLOAD_CLEANUP_TIMEOUT_MS
  ).toBeLessThan(UPLOAD_ROUTE_MAX_DURATION_SEC * 1000);
});
