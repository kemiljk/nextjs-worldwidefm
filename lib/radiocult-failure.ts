import type { RadioCultUploadFailure } from '@/lib/radiocult-upload';

export const RADIOCULT_FAILURE_CODES = [
  'storage_full',
  'service_unavailable',
  'upload_rejected',
  'unknown',
] as const;

export type RadioCultFailureCode = (typeof RADIOCULT_FAILURE_CODES)[number];

export type RadioCultFailureInput = Pick<
  RadioCultUploadFailure,
  'status' | 'error' | 'radiocultError'
>;

export type RadioCultFailureDescription = {
  code: RadioCultFailureCode;
  publicMessage: string;
  diagnosticMessage: string;
};

const PUBLIC_MESSAGE = "We couldn't finish processing your audio automatically.";

export function describeRadioCultFailure(
  input: RadioCultFailureInput
): RadioCultFailureDescription {
  const diagnosticMessage = extractDiagnosticMessage(input.radiocultError) || input.error;

  if (/available storage|storage (?:is )?full|exceed(?:ed)?[^.]*storage/i.test(diagnosticMessage)) {
    return { code: 'storage_full', publicMessage: PUBLIC_MESSAGE, diagnosticMessage };
  }

  if (input.status === undefined || input.status >= 500) {
    return { code: 'service_unavailable', publicMessage: PUBLIC_MESSAGE, diagnosticMessage };
  }

  if (input.status >= 400) {
    return { code: 'upload_rejected', publicMessage: PUBLIC_MESSAGE, diagnosticMessage };
  }

  return { code: 'unknown', publicMessage: PUBLIC_MESSAGE, diagnosticMessage };
}

function extractDiagnosticMessage(value?: string): string | undefined {
  if (!value?.trim()) return undefined;

  try {
    const parsed = JSON.parse(value) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error.trim();
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.trim();
  } catch {
    // RadioCult sometimes responds with plain text instead of JSON.
  }

  return value.trim();
}
