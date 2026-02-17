/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make the codebase fragile and hard to refactor.',
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: 'no-services-depend-on-routes',
      severity: 'error',
      comment:
        'services/ is a lower layer than routes/. Services must not import from routes/.',
      from: {
        path: [
          'packages/api/src/domains/cats/services',
          'packages/api/src/services',
        ],
      },
      to: {
        path: 'packages/api/src/routes',
      },
    },
    {
      name: 'no-config-depend-on-domain',
      severity: 'error',
      comment:
        'config/ is foundational and must not depend on routes/ or domain services.',
      from: {
        path: 'packages/api/src/config',
      },
      to: {
        path: ['packages/api/src/routes', 'packages/api/src/domains'],
      },
    },
    {
      name: 'no-shared-depend-on-api',
      severity: 'error',
      comment:
        'shared/ is a cross-package library and must not depend on api/ internals.',
      from: {
        path: 'packages/shared/src',
      },
      to: {
        path: 'packages/api/src',
      },
    },
    {
      name: 'no-orphans',
      severity: 'info',
      comment: 'Files that are not imported by anything (potential dead code).',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+', // dotfiles
          '\\.d\\.ts$', // type declarations
          '(^|/)tsconfig\\.json$',
          'index\\.ts$', // barrel exports
          '__tests__/', // test files
          '\\.test\\.', // test files
          '\\.spec\\.', // spec files
          'scripts/', // scripts
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: {
      path: ['node_modules'],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.base.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
    // Focus on API package source code
    includeOnly: ['packages/api/src', 'packages/shared/src'],
    exclude: {
      path: ['node_modules', '\\.d\\.ts$'],
    },
  },
};
