#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
const outIndex = process.argv.indexOf('--output');
const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : 'docs/features/index.json';
const features = [{ id: 'F999', status: 'in-progress', file: 'F999-story-player.md' }];
writeFileSync(outputPath, `${JSON.stringify({ features, generated_at: 'new' }, null, 2)}\n`, 'utf-8');
