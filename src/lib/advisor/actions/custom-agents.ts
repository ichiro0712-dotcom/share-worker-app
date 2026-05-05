'use server';

/**
 * legacy `app/actions/custom-agents.ts` の Advisor 用 stub。
 *
 * Advisor は単一エージェントなので Custom Agent 機能は使わない。
 * しかし legacy chat-layout の import を壊さないように、空配列/no-op を返す関数を提供する。
 */

export interface CustomAgent {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  icon_color: string;
  system_prompt: string;
  permissions: string[];
  is_pinned: boolean;
  pin_order: number;
  welcome_message: string | null;
  show_start_button: boolean;
  canvas_enabled: boolean;
  canvas_type: string | null;
  canvas_config: unknown | null;
  auto_task_enabled: boolean;
  auto_task_schedule: string | null;
  auto_task_time: string | null;
  auto_task_weekday: number | null;
  auto_task_cron: string | null;
  auto_task_prompt: string | null;
  auto_task_use_openclaw: boolean;
  auto_task_cron_job_id: string | null;
  auto_task_last_run_at: string | null;
  auto_task_last_result: string | null;
}

export interface CAConversationSummary {
  id: string;
  agent_id: string;
  agent_name?: string;
  agent_icon?: string;
  agent_icon_color?: string;
  title: string | null;
  last_message?: string | null;
  updated_at: string;
}

export async function getPinnedAgents(): Promise<CustomAgent[]> {
  // Advisor は単一なので、ピン止め機能は使わない
  return [];
}

export async function getCAConversations(): Promise<CAConversationSummary[]> {
  // Custom Agent 経由の会話は無い
  return [];
}

export async function deleteCAConversation(_conversationId: string): Promise<void> {
  // no-op
}
