#!/usr/bin/env node

import fs from 'node:fs/promises';

const args = process.argv.slice(2);
const options = {
  file: 'docs/TECH-DEBT.md',
  sort: false,
  annotate: false,
  checkOrder: false,
  write: false,
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--file' || arg === '-f') {
    options.file = args[i + 1];
    i += 1;
    continue;
  }
  if (arg === '--sort') {
    options.sort = true;
    continue;
  }
  if (arg === '--annotate') {
    options.annotate = true;
    continue;
  }
  if (arg === '--check-order') {
    options.checkOrder = true;
    continue;
  }
  if (arg === '--write') {
    options.write = true;
    continue;
  }
  if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  }
}

if (!options.sort && !options.annotate) {
  if (!options.checkOrder) {
    printHelp();
    process.exit(0);
  }
}

const COMMIT_MAP = {
  TD038: ['adc368e'],
  TD037: ['adc368e'],
  TD091: ['970648e'],
  TD098: ['b88fd9f', 'cbf0451'],
  TD009: ['a953aad'],
  TD014: ['6b77e7f'],
  TD016: ['31b11ab'],
  TD021: ['ae710b6'],
  TD032: ['b2bcc23'],
  TD034: ['e46fd55'],
  TD035: ['ae710b6'],
  TD039: ['a953aad'],
  TD054: ['0e2b1f7'],
  TD055: ['0e2b1f7'],
  TD066: ['672eaf9'],
  TD070: ['fd98f85'],
  TD022: ['e46fd55'],
  TD023: ['dc80bf9'],
  TD028: ['e17e96d'],
  TD029: ['b23f38a'],
  TD030: ['f822eb8'],
  TD064: ['761df79'],
  TD065: ['761df79'],
};

const commitTag = /`[0-9a-f]{6,40}`/;
const headerRegex = /^\| ID \| 项目 \| 状态 \| 来源 \| 备注 \|$/;
const separatorRegex = /^\|[-:|\s]+\|$/;
const rowRegex = /^\|\s*(TD\d{3})\s*\|/;

(async () => {
  const raw = await fs.readFile(options.file, 'utf8');
  const lines = raw.split(/\r?\n/);

  const output = [];
  let tableLines = [];
  let tableRows = [];
  let inTable = false;
  let seenHeader = false;
  const inOrderViolations = [];

  const flushTable = () => {
    if (tableLines.length === 0) {
      return;
    }

    if (options.annotate) {
      tableRows = tableRows.map((item) => {
        const mapped = COMMIT_MAP[item.id];
        if (!mapped || mapped.length === 0 || commitTag.test(item.text)) {
          return item;
        }

        const commitText = mapped.map((hash) => `\`${hash}\``).join('、');
        const trimTail = item.text.replace(/\s*\|\s*$/, '');
        return { ...item, text: `${trimTail}；commit ${commitText} |` };
      });
    }

    if (options.sort) {
      tableRows.sort((a, b) => {
        if (a.idNum !== b.idNum) {
          return a.idNum - b.idNum;
        }
        return a.index - b.index;
      });
    } else {
      const ids = tableRows.map((row) => row.idNum);
      for (let i = 1; i < ids.length; i += 1) {
        if (ids[i - 1] > ids[i]) {
          inOrderViolations.push({
            idA: tableRows[i - 1].id,
            idB: tableRows[i].id,
            idxA: tableRows[i - 1].index,
            idxB: tableRows[i].index,
          });
          break;
        }
      }
    }

    const sortedRows = tableRows.map((row) => row.text);
    output.push(...tableLines);
    output.push(...sortedRows);

    tableLines = [];
    tableRows = [];
    inTable = false;
    seenHeader = false;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (!inTable) {
      if (headerRegex.test(line)) {
        inTable = true;
        seenHeader = false;
        tableLines = [line];
        tableRows = [];
        continue;
      }
      output.push(line);
      continue;
    }

    if (!seenHeader) {
      tableLines.push(line);
      if (separatorRegex.test(line.trim())) {
        seenHeader = true;
      }
      continue;
    }

    const match = rowRegex.exec(line);
    if (match?.[1]) {
      tableRows.push({
        id: match[1],
        idNum: Number.parseInt(match[1].slice(2), 10),
        index: i,
        text: line,
      });
      continue;
    }

    flushTable();
    if (line.trim() !== '') {
      output.push(line);
    } else {
      output.push(line);
    }
  }

  flushTable();

  if (options.checkOrder && inOrderViolations.length > 0) {
    console.error(`tech-debt-order: TD ID not in ascending order in ${options.file}`);
    inOrderViolations.forEach((item) => {
      console.error(`  - ${item.idA}(line ${item.idxA + 1}) appears before ${item.idB}(line ${item.idxB + 1})`);
    });
    process.exitCode = 1;
    return;
  }

  const next = output.join('\n');
  if ((options.sort || options.annotate) && options.write) {
    await fs.writeFile(options.file, next, 'utf8');
    return;
  }

  if (!options.write) {
    if (options.sort || options.annotate) {
      console.log(next);
      return;
    }

    const count = inOrderViolations.length;
    if (count > 0) {
      console.log(`Found ${count} ordering issue(s). Use --sort --write to fix.`);
    } else {
      console.log('No TD ordering violations.');
    }
  }
})();

function printHelp() {
  console.log(`Usage: node scripts/tech-debt-maintain.mjs [options]

Options:
  --file, -f <path>   Target markdown file (default: docs/TECH-DEBT.md)
  --sort               Sort each TD table by numeric TD id (TD001..TD999)
  --annotate           Add commit annotations for known TD ids
  --check-order        Return non-zero if any table is not sorted
  --write              Write changes back to file (required for persistence)
  --help               Show this help text

Examples:
  node scripts/tech-debt-maintain.mjs --check-order
  node scripts/tech-debt-maintain.mjs --sort --write
  node scripts/tech-debt-maintain.mjs --annotate --write
`);
}
