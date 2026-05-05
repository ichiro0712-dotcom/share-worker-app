import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind class name 統合ヘルパー
 * shadcn/ui スタイルのコンポーネント記法と互換性あり。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
