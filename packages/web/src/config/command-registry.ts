/**
 * Slash command registry — single source of truth for all chat commands.
 * Used by useChatCommands (dispatch) and HubCommandsTab (display).
 *
 * To add a new command:
 * 1. Add a CommandDefinition here
 * 2. Add the handler in useChatCommands.ts
 * That's it — the "命令速查" tab picks it up automatically.
 */

export type CommandCategory = 'general' | 'memory' | 'knowledge' | 'mode' | 'task';

export interface CommandDefinition {
  /** The command string, e.g. '/help' */
  name: string;
  /** Usage pattern, e.g. '/config set <key> <value>' */
  usage: string;
  /** Human-readable description (Chinese) */
  description: string;
  /** Grouping category for display */
  category: CommandCategory;
}

export const COMMAND_CATEGORIES: Record<CommandCategory, string> = {
  general: '通用',
  memory: '记忆',
  knowledge: '知识库',
  mode: '模式',
  task: '任务',
};

export const COMMANDS: CommandDefinition[] = [
  // --- general ---
  { name: '/help', usage: '/help', description: '打开功能速查面板', category: 'general' },
  { name: '/config', usage: '/config', description: '打开系统配置面板', category: 'general' },
  { name: '/config set', usage: '/config set <key> <value>', description: '热更新运行时配置', category: 'general' },

  // --- memory ---
  { name: '/remember', usage: '/remember <key> <value>', description: '保存对话记忆', category: 'memory' },
  { name: '/recall', usage: '/recall [key]', description: '查看对话记忆（无 key 列出全部）', category: 'memory' },
  { name: '/approve', usage: '/approve <entryId>', description: '审批待发布的记忆条目', category: 'memory' },
  { name: '/archive', usage: '/archive <entryId>', description: '归档已发布的记忆条目', category: 'memory' },

  // --- knowledge ---
  { name: '/evidence', usage: '/evidence <query>', description: '搜索项目知识库（Hindsight）', category: 'knowledge' },
  { name: '/reflect', usage: '/reflect <query>', description: 'AI 反思项目知识', category: 'knowledge' },

  // --- mode ---
  { name: '/mode', usage: '/mode', description: '查看当前模式状态', category: 'mode' },
  { name: '/mode brainstorm', usage: '/mode brainstorm <议题> @猫A @猫B', description: '启动头脑风暴模式', category: 'mode' },
  { name: '/mode debate', usage: '/mode debate <议题> @猫A @猫B [轮数]', description: '启动辩论模式', category: 'mode' },
  { name: '/mode dev-loop', usage: '/mode dev-loop @开发猫 @review猫 <需求>', description: '启动开发自闭环模式', category: 'mode' },
  { name: '/mode end', usage: '/mode end [outcome]', description: '结束当前模式', category: 'mode' },

  // --- task ---
  { name: '/tasks extract', usage: '/tasks extract [N]', description: '从对话中提取任务', category: 'task' },
];
