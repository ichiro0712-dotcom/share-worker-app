'use server';

/**
 * legacy `app/actions/saved-prompts.ts` の Advisor 互換実装。
 * UI 側のシグネチャを維持。
 */

import { prisma } from '@/lib/prisma';
import { requireAdvisorAuth } from '../auth';

export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  sort_order: number;
  created_at: string;
}

export async function getSavedPrompts(): Promise<SavedPrompt[]> {
  const auth = await requireAdvisorAuth();
  const rows = await prisma.advisorSavedPrompt.findMany({
    where: { admin_id: auth.adminId },
    orderBy: [{ updated_at: 'desc' }],
  });
  return rows.map((r, idx) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    sort_order: idx,
    created_at: r.created_at.toISOString(),
  }));
}

export async function createSavedPrompt(
  title: string,
  content: string
): Promise<{ success: boolean; id?: string }> {
  try {
    const auth = await requireAdvisorAuth();
    const created = await prisma.advisorSavedPrompt.create({
      data: {
        admin_id: auth.adminId,
        title: title.trim().slice(0, 200),
        content: content.trim(),
      },
      select: { id: true },
    });
    return { success: true, id: created.id };
  } catch {
    return { success: false };
  }
}

export async function updateSavedPrompt(
  id: string,
  title: string,
  content: string
): Promise<{ success: boolean }> {
  try {
    const auth = await requireAdvisorAuth();
    await prisma.advisorSavedPrompt.updateMany({
      where: { id, admin_id: auth.adminId },
      data: { title: title.trim().slice(0, 200), content: content.trim() },
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function deleteSavedPrompt(id: string): Promise<{ success: boolean }> {
  try {
    const auth = await requireAdvisorAuth();
    await prisma.advisorSavedPrompt.deleteMany({
      where: { id, admin_id: auth.adminId },
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}
