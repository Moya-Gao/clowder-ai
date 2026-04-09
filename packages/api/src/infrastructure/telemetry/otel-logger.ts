/**
 * F152: OTel Logger bridge — emits structured log records through the
 * OTel log pipeline (RedactingLogProcessor → exporter).
 *
 * This does NOT replace Pino for local logs. It provides a parallel
 * emission path so that key events flow through OTel's log signal,
 * enabling correlation with traces and metrics in external backends.
 */

import { trace } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';

const logger = logs.getLogger('cat-cafe-api', '0.1.0');

/**
 * Emit a structured log record through the OTel log pipeline.
 * Automatically captures active span context for trace-log correlation.
 */
export function emitOtelLog(
  severity: 'INFO' | 'WARN' | 'ERROR',
  body: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  const severityMap: Record<string, SeverityNumber> = {
    INFO: SeverityNumber.INFO,
    WARN: SeverityNumber.WARN,
    ERROR: SeverityNumber.ERROR,
  };

  // Capture active span context for trace-log correlation
  const activeSpan = trace.getActiveSpan();
  const spanContext = activeSpan?.spanContext();

  logger.emit({
    severityNumber: severityMap[severity],
    severityText: severity,
    body,
    attributes: {
      ...attributes,
      ...(spanContext ? { traceId: spanContext.traceId, spanId: spanContext.spanId } : {}),
    },
  });
}
