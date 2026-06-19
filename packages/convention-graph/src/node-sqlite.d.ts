// 最小 node:sqlite 类型声明。
// @types/node@20 尚无 node:sqlite 类型；runtime 在 Node 22.5+ 内置（已实测 Node 24 可用，无需 flag）。
// spike 权宜声明，待全仓 @types/node 升级到含 node:sqlite 类型后可移除。
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean; enableForeignKeyConstraints?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
  export class StatementSync {
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }
}
