export function formatSnapshotYaml(snapshot, dateStr) {
  const lines = [
    '---',
    'doc_kind: harness-feedback',
    'feedback_type: eval-snapshot',
    `feature_id: ${snapshot.featureId}`,
    `generated_at: "${snapshot.generatedAt}"`,
    `generated_by: "${snapshot.generatedBy}"`,
    '---',
    '',
    `# F167 Runtime Eval Snapshot — ${dateStr}`,
    '',
    `data_source: "${snapshot.dataSource}"`,
    `overall_confidence: ${snapshot.overallConfidence}`,
    '',
    'window:',
    `  start_ms: ${snapshot.window.startMs}`,
    `  end_ms: ${snapshot.window.endMs}`,
    `  duration_hours: ${snapshot.window.durationHours.toFixed(2)}`,
    '',
    'trace_store_stats:',
    `  span_count: ${snapshot.traceStoreStats.spanCount}`,
    `  max_spans: ${snapshot.traceStoreStats.maxSpans}`,
    `  max_age_ms: ${snapshot.traceStoreStats.maxAgeMs}`,
    '',
    `summary: "${snapshot.summary}"`,
    '',
    'components:',
  ];

  for (const c of snapshot.components) {
    lines.push(`  - id: ${c.componentId}`);
    lines.push(`    name: "${c.componentName}"`);
    lines.push(`    confidence: ${c.confidence}`);
    lines.push('    activation_counts:');
    for (const [k, v] of Object.entries(c.activationCounts)) {
      lines.push(`      ${k}: ${v ?? 'null'}`);
    }
    if (Object.keys(c.activationCounts).length === 0) {
      lines.push('      {}');
    }
    lines.push('    friction_counts:');
    for (const [k, v] of Object.entries(c.frictionCounts)) {
      lines.push(`      ${k}: ${v ?? 'null'}`);
    }
    if (Object.keys(c.frictionCounts).length === 0) {
      lines.push('      {}');
    }
    if (c.telemetryGaps.length > 0) {
      lines.push('    telemetry_gaps:');
      for (const gap of c.telemetryGaps) {
        lines.push(`      - metric: ${gap.metric}`);
        lines.push(`        reason: ${gap.reason}`);
        lines.push(`        impact: "${gap.impact}"`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function formatAttributionYaml(report, dateStr, fingerprintFn) {
  const lines = [
    '---',
    'doc_kind: harness-feedback',
    'feedback_type: attribution',
    `feature_id: ${report.featureId}`,
    `eval_snapshot_id: "${report.evalSnapshotId}"`,
    `generated_at: "${report.generatedAt}"`,
    '---',
    '',
    `# F167 Attribution Report — ${dateStr}`,
    '',
  ];

  if (report.findings.length === 0 && report.noFindingRecord) {
    lines.push('no_finding_record:');
    lines.push(`  reason: "${report.noFindingRecord.reason}"`);
    lines.push(`  evidence: "${report.noFindingRecord.evidence}"`);
    lines.push('');
    lines.push('findings: []');
  } else {
    lines.push(`finding_count: ${report.findings.length}`);
    lines.push('');
    lines.push('findings:');
    for (const f of report.findings) {
      lines.push(`  - id: ${f.id}`);
      lines.push(`    related_feature: ${f.relatedFeature}`);
      lines.push('    friction_signal:');
      lines.push(`      type: ${f.frictionSignal.type}`);
      lines.push(`      severity: ${f.frictionSignal.severity}`);
      lines.push(`      confidence: ${f.frictionSignal.confidence}`);
      lines.push('    attribution:');
      lines.push(`      primary_layer: ${f.attribution.primaryLayer}`);
      lines.push(`      pipeline_or_human: ${f.attribution.pipelineOrHuman}`);
      lines.push('      evidence:');
      for (const e of f.attribution.evidence) {
        lines.push(`        - type: ${e.type}`);
        lines.push(`          anchor: "${e.anchor}"`);
        lines.push(`          excerpt: "${e.excerpt}"`);
      }
      lines.push('    proposed_action:');
      for (const a of f.proposedAction) {
        lines.push(`      - action: ${a.action}`);
        lines.push(`        target: "${a.target}"`);
        lines.push(`        rationale: "${a.rationale}"`);
      }
      lines.push(`    fingerprint: "${fingerprintFn(f)}"`);
      lines.push(`    status: ${f.status}`);
      lines.push('');
    }
  }

  if (report.actionRate) {
    lines.push('');
    lines.push('action_rate:');
    lines.push(`  total: ${report.actionRate.total}`);
    lines.push(`  acted_on: ${report.actionRate.actedOn}`);
    lines.push(`  rate: ${report.actionRate.rate}`);
    lines.push(`  sunset_candidate: ${report.actionRate.sunsetCandidate}`);
  }

  return lines.join('\n');
}
