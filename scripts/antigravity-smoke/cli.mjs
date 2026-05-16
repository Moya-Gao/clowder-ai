const ARG_VALUE_ASSIGNERS = new Map([
  [
    '--mode',
    (args, value) => {
      args.mode = value;
    },
  ],
  [
    '--sentinel-root',
    (args, value) => {
      args.sentinelRoot = value;
    },
  ],
  [
    '--thread-id',
    (args, value) => {
      args.threadId = value;
    },
  ],
  [
    '--output-json',
    (args, value) => {
      args.outputJson = value;
    },
  ],
]);

function assignValueArg(args, argv, index) {
  const arg = argv[index];
  for (const [name, assign] of ARG_VALUE_ASSIGNERS) {
    if (arg === name) {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${name}`);
      assign(args, value);
      return { nextIndex: index + 1 };
    }
    const inlinePrefix = `${name}=`;
    if (arg.startsWith(inlinePrefix)) {
      assign(args, arg.slice(inlinePrefix.length));
      return { nextIndex: index };
    }
  }
  return undefined;
}

export function parseAntigravitySmokeArgs(argv) {
  const args = {
    mode: 'readonly',
    allowWrite: false,
    dryRun: false,
    sentinelRoot: undefined,
    threadId: undefined,
    outputJson: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--allow-write':
        args.allowWrite = true;
        continue;
      case '--dry-run':
        args.dryRun = true;
        continue;
    }

    const matched = assignValueArg(args, argv, i);
    if (matched) {
      i = matched.nextIndex;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!['readonly', 'sentinel', 'thread'].includes(args.mode)) {
    throw new Error(`Unsupported Antigravity smoke mode: ${args.mode}`);
  }
  return args;
}
