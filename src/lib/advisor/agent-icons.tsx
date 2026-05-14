import {
  Bot, MessageSquare, Calendar, ClipboardList, Target,
  Brain, BarChart3, Wrench, PenLine, Rocket,
  Lightbulb, Palette, Shield, Heart, Zap,
  type LucideIcon,
} from 'lucide-react'

export interface AgentIconDef {
  key: string
  label: string
  icon: LucideIcon
}

export const AGENT_ICONS: AgentIconDef[] = [
  { key: 'bot', label: 'ボット', icon: Bot },
  { key: 'message', label: 'チャット', icon: MessageSquare },
  { key: 'calendar', label: 'カレンダー', icon: Calendar },
  { key: 'clipboard', label: 'タスク', icon: ClipboardList },
  { key: 'target', label: 'ターゲット', icon: Target },
  { key: 'brain', label: '知識', icon: Brain },
  { key: 'chart', label: '分析', icon: BarChart3 },
  { key: 'wrench', label: '設定', icon: Wrench },
  { key: 'pen', label: '執筆', icon: PenLine },
  { key: 'rocket', label: '実行', icon: Rocket },
  { key: 'lightbulb', label: 'アイデア', icon: Lightbulb },
  { key: 'palette', label: 'デザイン', icon: Palette },
  { key: 'shield', label: 'セキュリティ', icon: Shield },
  { key: 'heart', label: 'ヘルス', icon: Heart },
  { key: 'zap', label: '自動化', icon: Zap },
]

const iconMap = new Map(AGENT_ICONS.map(i => [i.key, i.icon]))

/** キーからLucideIconコンポーネントを取得（デフォルト: Bot） */
export function getAgentIcon(key: string): LucideIcon {
  return iconMap.get(key) ?? Bot
}

export const ICON_COLORS: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  green: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
  pink: 'bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400',
  yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export const COLOR_OPTIONS = [
  { key: 'blue', label: '青', class: 'bg-blue-500' },
  { key: 'red', label: '赤', class: 'bg-red-500' },
  { key: 'green', label: '緑', class: 'bg-green-500' },
  { key: 'purple', label: '紫', class: 'bg-purple-500' },
  { key: 'orange', label: '橙', class: 'bg-orange-500' },
  { key: 'pink', label: 'ピンク', class: 'bg-pink-500' },
  { key: 'yellow', label: '黄', class: 'bg-yellow-500' },
  { key: 'gray', label: '灰', class: 'bg-gray-500' },
]
