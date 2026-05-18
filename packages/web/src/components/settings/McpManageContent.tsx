'use client';

import { useCallback, useState } from 'react';
import type { CapabilityBoardItem } from '../capability-board-ui';
import { HubIcon } from '../hub-icons';
import { McpConfigModal, type McpConfigModalProps } from '../McpConfigModal';
import {
  SettingsResourceIconButton,
  settingsResourceActionGroupClass,
  settingsResourceAvatarClass,
  settingsResourceCardClass,
  settingsResourceRowClass,
} from '../SettingsResourceCard';
import { PerCatToggles, ProjectSelector, ToggleSwitch } from './capability-settings-ui';
import { useCapabilityState } from './useCapabilityState';

interface ModalState {
  editId?: string;
  editData?: McpConfigModalProps['editData'];
  readOnly?: boolean;
  tools?: { name: string; description?: string }[];
}

function buildEditData(item: CapabilityBoardItem): McpConfigModalProps['editData'] {
  const server = item.mcpServer;
  if (!server) return undefined;
  return {
    transport: server.transport,
    command: server.command,
    args: server.args,
    url: server.url,
    env: server.env,
    headers: server.headers,
    envKeys: server.envKeys ?? Object.keys(server.env ?? {}),
    resolver: server.resolver,
  };
}

function mcpSubInfo(item: CapabilityBoardItem): string | undefined {
  const server = item.mcpServer;
  if (!server) return undefined;
  if (server.transport === 'streamableHttp') return server.url ? `http · ${server.url}` : 'http';
  if (!server.command) return server.resolver ? `resolver · ${server.resolver}` : undefined;
  return `stdio · ${server.command}${server.args?.length ? ` ${server.args.join(' ')}` : ''}`;
}

export function McpManageContent() {
  const cap = useCapabilityState('mcp');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCardClick = useCallback((item: CapabilityBoardItem) => {
    const readOnly = item.source !== 'external';
    setModal({
      editId: item.id,
      readOnly,
      tools: item.tools,
      editData: buildEditData(item),
    });
  }, []);

  const handleCreate = useCallback(() => setModal({}), []);

  const handleSaved = useCallback(() => {
    setModal(null);
    cap.refetch();
  }, [cap]);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleCreate}
          className="flex h-[34px] shrink-0 items-center justify-center rounded-xl bg-[var(--cafe-accent,#C65F3D)] px-3.5 text-compact font-bold text-[var(--cafe-surface)] transition-opacity hover:opacity-90"
        >
          新增 MCP
        </button>
      </div>

      <ProjectSelector
        resolvedPath={cap.resolvedProjectPath}
        knownProjects={cap.knownProjects}
        currentSelection={cap.projectPath}
        onSwitch={cap.switchProject}
      />

      {cap.error && (
        <div className="console-status-chip" data-status="error">
          {cap.error}
        </div>
      )}

      {cap.loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <div key={index} className="animate-pulse rounded-xl bg-[var(--console-card-bg)] p-4">
              <div className="h-4 w-1/3 rounded bg-[var(--console-border-soft)]" />
              <div className="mt-2 h-3 w-2/3 rounded bg-[var(--console-border-soft)]" />
            </div>
          ))}
        </div>
      )}

      {!cap.loading && cap.items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-[var(--console-card-bg)] px-8 py-16 text-center">
          <HubIcon name="box" className="mb-3 h-10 w-10 text-cafe-muted opacity-40" />
          <p className="text-base font-semibold text-cafe">暂无已安装的 MCP</p>
          <p className="mt-1 text-xs text-cafe-muted">点击上方按钮手动新增 MCP 配置</p>
        </div>
      )}

      <div className="space-y-2">
        {cap.items.map((item) => {
          const editable = item.source === 'external';
          const busy = cap.toggling === item.id;
          const removing = cap.disabling === item.id;
          const expanded = expandedId === item.id;
          const subInfo = mcpSubInfo(item);

          return (
            <div key={item.id} className={settingsResourceCardClass}>
              <div className={settingsResourceRowClass}>
                <HubIcon name="plug" className="h-[18px] w-[18px] shrink-0 text-cafe-muted" />
                <button
                  type="button"
                  onClick={() => handleCardClick(item)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 text-left"
                >
                  <div className={settingsResourceAvatarClass}>{item.id.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-cafe">{item.id}</p>
                    <p className="mt-0.5 truncate text-xs text-cafe-secondary">{item.description || '—'}</p>
                    {subInfo && <p className="mt-0.5 truncate text-label font-mono text-cafe-muted">{subInfo}</p>}
                  </div>
                </button>
                <div className={settingsResourceActionGroupClass}>
                  <ToggleSwitch
                    enabled={item.enabled}
                    busy={busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      cap.handleToggle(item, !item.enabled);
                    }}
                  />
                  {cap.catFamilies.length > 0 && (
                    <SettingsResourceIconButton
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      title="按猫开关"
                      aria-label="按猫开关"
                    >
                      <HubIcon name="users" className="h-4 w-4" />
                    </SettingsResourceIconButton>
                  )}
                  {editable && (
                    <SettingsResourceIconButton
                      disabled={removing}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (window.confirm(`确认禁用 MCP "${item.id}"？配置会保留，可稍后重新启用。`)) {
                          cap.handleRemoveMcp(item);
                        }
                      }}
                      title="禁用此 MCP"
                      aria-label="禁用此 MCP"
                      tone="danger"
                    >
                      <HubIcon name="trash" className="h-4 w-4" />
                    </SettingsResourceIconButton>
                  )}
                </div>
              </div>
              {expanded && (
                <PerCatToggles
                  item={item}
                  catFamilies={cap.catFamilies}
                  toggling={cap.toggling}
                  onToggle={cap.handleToggle}
                />
              )}
            </div>
          );
        })}
      </div>

      {modal && (
        <McpConfigModal
          projectPath={cap.projectPath ?? undefined}
          editId={modal.editId}
          editData={modal.editData}
          readOnly={modal.readOnly}
          tools={modal.tools}
          onSaved={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
