'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Send, Square, Plus, X, Paperclip, ChevronDown, FileIcon,
  Search, SlidersHorizontal,
  Upload, BookmarkPlus, Pencil, Trash2,
  FileSearch, Lightbulb, BarChart3, Database, Bot, FileText,
} from 'lucide-react'
import { Button } from '@/src/components/ui/shadcn/button'
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '@/src/lib/advisor/models'
import { getSavedPrompts, createSavedPrompt, updateSavedPrompt, deleteSavedPrompt, type SavedPrompt } from '@/src/lib/advisor/actions/saved-prompts'

export interface AttachedFile {
  file: File
  preview?: string
}

export interface ChatTool {
  id: string
  name: string
  description: string
  icon: typeof Bot
  /** 選択時に入力欄に自動挿入するテンプレ (P1-8 レポート作成のような起点系のみ) */
  template?: string
}

export const AVAILABLE_TOOLS: ChatTool[] = [
  {
    id: 'log_investigation',
    name: 'ログ調査',
    description: 'Vercel/DB/エラーログを横断的に確認',
    icon: FileSearch,
  },
  {
    id: 'system_advice',
    name: 'システムアドバイス',
    description: '仕様や実装方法、改善案を相談',
    icon: Lightbulb,
  },
  {
    id: 'analytics_query',
    name: '指標・データ集計',
    description: 'KPIや指標を期間/LP別で集計',
    icon: BarChart3,
  },
  {
    id: 'db_inspection',
    name: 'DB状態確認',
    description: 'テーブル構造や件数を読み取り専用で確認',
    icon: Database,
  },
  {
    id: 'report_create',
    name: 'レポート作成',
    description: '右の Canvas で要件を固めて Gemini で生成',
    icon: FileText,
    template:
      'レポートを作成したいです。\n' +
      '- 対象期間: (例: 先週 / 2026-04-24〜2026-04-30)\n' +
      '- レポートの目的: (例: 週次 KPI レビュー / 不具合の振り返り)\n' +
      '- 含めたいデータ: (例: GA4 流入、求人推移、エラーログ)',
  },
]

interface ChatInputProps {
  onSubmit: (message: string, modelId: string, files: AttachedFile[], toolId?: string) => void
  loading: boolean
  onAbort: () => void
  placeholder?: string
  disabled?: boolean
  showModelSelector?: boolean
}

export function ChatInput({
  onSubmit,
  loading,
  onAbort,
  placeholder = 'メッセージを入力...（Shift+Enterで改行）',
  disabled = false,
  showModelSelector = true,
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [toolMenuOpen, setToolMenuOpen] = useState(false)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [promptModalOpen, setPromptModalOpen] = useState(false)
  const [prompts, setPrompts] = useState<SavedPrompt[]>([])
  const [promptEditId, setPromptEditId] = useState<string | null>(null)
  const [promptEditTitle, setPromptEditTitle] = useState('')
  const [promptEditContent, setPromptEditContent] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('agent-hub-base-model')
    if (saved && AVAILABLE_MODELS.some(m => m.id === saved)) setModelId(saved)
  }, [])

  const [files, setFiles] = useState<AttachedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedModel = AVAILABLE_MODELS.find(m => m.id === modelId) ?? AVAILABLE_MODELS[0]

  function closeAllMenus() {
    setToolMenuOpen(false)
    setModelMenuOpen(false)
    setPlusMenuOpen(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if ((!text && files.length === 0) || loading) return
    onSubmit(text, modelId, files, selectedTool ?? undefined)
    setInput('')
    setFiles([])
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const additions: AttachedFile[] = []
    for (const file of Array.from(newFiles)) {
      if (file.size > 50 * 1024 * 1024) continue
      const attached: AttachedFile = { file }
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => {
          attached.preview = reader.result as string
          setFiles(prev => [...prev])
        }
        reader.readAsDataURL(file)
      }
      additions.push(attached)
    }
    setFiles(prev => [...prev, ...additions])
  }, [])

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  // プロンプト関連
  async function loadPrompts() {
    const list = await getSavedPrompts()
    setPrompts(list)
  }

  function openPromptModal() {
    setPlusMenuOpen(false)
    setPromptModalOpen(true)
    loadPrompts()
  }

  function selectPrompt(p: SavedPrompt) {
    setInput(p.content)
    setPromptModalOpen(false)
    inputRef.current?.focus()
  }

  function startEditPrompt(p: SavedPrompt) {
    setPromptEditId(p.id)
    setPromptEditTitle(p.title)
    setPromptEditContent(p.content)
  }

  function startNewPrompt() {
    setPromptEditId('new')
    setPromptEditTitle('')
    setPromptEditContent('')
  }

  async function savePromptEdit() {
    if (!promptEditTitle.trim() || !promptEditContent.trim()) return
    if (promptEditId === 'new') {
      await createSavedPrompt(promptEditTitle, promptEditContent)
    } else if (promptEditId) {
      await updateSavedPrompt(promptEditId, promptEditTitle, promptEditContent)
    }
    setPromptEditId(null)
    await loadPrompts()
  }

  async function handleDeletePrompt(id: string) {
    await deleteSavedPrompt(id)
    await loadPrompts()
  }

  /** いずれかのツールテンプレと一致するか (上書き許可判定用) */
  function isCurrentTemplate(text: string) {
    return AVAILABLE_TOOLS.some((t) => t.template && t.template === text)
  }

  // D&D
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true) }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); setIsDragging(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false)
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
  }

  return (
    <div
      className="border-t p-4 shrink-0"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
          <div className="border-2 border-dashed border-slate-400 rounded-2xl p-12 text-center">
            <Paperclip className="h-10 w-10 text-slate-500 mx-auto mb-3" />
            <p className="text-sm font-medium">ファイルをドロップして添付</p>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        {/* 添付ファイルプレビュー */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-muted/30 text-xs">
                {f.preview ? (
                  <img src={f.preview} alt="" className="h-6 w-6 rounded object-cover" />
                ) : (
                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="truncate max-w-[120px]">{f.file.name}</span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring transition-shadow">
            {/* テキスト入力 */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={placeholder}
              rows={1}
              className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm focus:outline-none max-h-40"
              disabled={disabled || loading}
            />

            {/* ツールバー（ボックス内下部）— Gemini準拠 */}
            <div className="flex items-center gap-0.5 px-2 pb-2 pt-0.5">

              {/* + ボタン → ドロップアップメニュー */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setPlusMenuOpen(!plusMenuOpen); setToolMenuOpen(false); setModelMenuOpen(false) }}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="追加"
                >
                  <Plus className="h-4.5 w-4.5" />
                </button>
                {plusMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setPlusMenuOpen(false)} />
                    <div
                      className="absolute bottom-full left-0 mb-2 z-50 bg-white border border-slate-200 rounded-xl py-2"
                      style={{ width: 260, boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
                    >
                      <button
                        type="button"
                        onClick={() => { setPlusMenuOpen(false); fileInputRef.current?.click() }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                      >
                        <Upload className="h-4 w-4 shrink-0 text-slate-500" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">ファイル添付</div>
                          <div className="text-[11px] text-slate-500">画像 / PDF を分析対象に追加</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={openPromptModal}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                      >
                        <BookmarkPlus className="h-4 w-4 shrink-0 text-slate-500" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">保存プロンプト</div>
                          <div className="text-[11px] text-slate-500">よく使う質問を保存・再利用</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = '' } }}
              />

              {/* ツールボタン（Geminiの ⚙ アイコン） */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setToolMenuOpen(!toolMenuOpen); setPlusMenuOpen(false); setModelMenuOpen(false) }}
                  className={`flex items-center gap-1.5 h-8 px-2 rounded-lg transition-colors text-xs ${
                    selectedTool
                      ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {!selectedTool && <span>ツール</span>}
                </button>
                {toolMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setToolMenuOpen(false)} />
                    <div
                      className="absolute bottom-full left-0 mb-2 z-50 bg-white border border-slate-200 rounded-xl py-2"
                      style={{ width: 320, boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
                    >
                      <div className="px-4 pb-1.5 pt-0.5 text-[11px] text-slate-400">
                        意図を明示すると Advisor が動きやすくなります
                      </div>
                      {AVAILABLE_TOOLS.map(tool => {
                        const Icon = tool.icon
                        const isSelected = selectedTool === tool.id
                        return (
                          <button
                            key={tool.id}
                            type="button"
                            onClick={() => {
                              const next = isSelected ? null : tool.id
                              setSelectedTool(next)
                              setToolMenuOpen(false)
                              // テンプレ付きツールは選択時に入力欄を埋める (空 or テンプレと同じ時のみ上書き)
                              if (next && tool.template) {
                                setInput((prev) =>
                                  !prev.trim() || isCurrentTemplate(prev) ? tool.template! : prev
                                )
                                // 次のフレームでフォーカスして高さも合わせる
                                setTimeout(() => {
                                  const ta = inputRef.current
                                  if (ta) {
                                    ta.focus()
                                    ta.style.height = 'auto'
                                    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
                                  }
                                }, 0)
                              }
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                              isSelected
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                            <div className="flex-1 min-w-0">
                              <div className={isSelected ? 'font-semibold' : 'font-medium'}>
                                {tool.name}
                              </div>
                              <div className={`text-[11px] font-normal ${isSelected ? 'text-blue-600/80' : 'text-slate-500'}`}>
                                {tool.description}
                              </div>
                            </div>
                            {isSelected && (
                              <span className="text-[10px] text-blue-700 shrink-0 font-semibold">選択中</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* 選択中ツール表示（Geminiスタイル: アイコン + 青太字 + ×） */}
              {selectedTool && (() => {
                const tool = AVAILABLE_TOOLS.find(t => t.id === selectedTool)
                if (!tool) return null
                const Icon = tool.icon
                return (
                  <div className="flex items-center gap-1 px-1 text-blue-500 dark:text-blue-400">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold">{tool.name}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTool(null)}
                      className="hover:text-blue-400 dark:hover:text-blue-300 ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })()}

              <div className="flex-1" />

              {/* モデル選択 */}
              {showModelSelector && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setModelMenuOpen(!modelMenuOpen)
                      setToolMenuOpen(false)
                      setPlusMenuOpen(false)
                    }}
                    className="flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    {selectedModel.name}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {modelMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setModelMenuOpen(false)} />
                      <div
                        className="absolute bottom-full right-0 mb-2 z-50 bg-white border border-slate-200 rounded-xl py-2"
                        style={{ width: 300, boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}
                      >
                        <div className="px-4 pb-1.5 pt-0.5 text-[11px] text-slate-400">
                          使用する Claude モデル
                        </div>
                        {AVAILABLE_MODELS.map(m => {
                          const isCurrent = m.id === modelId
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setModelId(m.id)
                                localStorage.setItem('advisor-base-model', m.id)
                                setModelMenuOpen(false)
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-start gap-3 ${
                                isCurrent ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className={`flex items-center gap-2 ${isCurrent ? 'font-semibold' : 'font-medium'}`}>
                                  {m.name}
                                  {m.recommended && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                      推奨
                                    </span>
                                  )}
                                </div>
                                <div className={`text-[11px] font-normal ${isCurrent ? 'text-blue-600/80' : 'text-slate-500'}`}>
                                  {m.description}
                                </div>
                              </div>
                              {isCurrent && (
                                <span className="text-[10px] text-blue-700 shrink-0 font-semibold mt-1">使用中</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 送信/停止ボタン */}
              {loading ? (
                <button
                  type="button"
                  onClick={onAbort}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg shrink-0 bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
                  aria-label="停止"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && files.length === 0}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg shrink-0 bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="送信"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* プロンプトモーダル */}
      {promptModalOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => { setPromptModalOpen(false); setPromptEditId(null) }} />
          <div className="fixed inset-x-0 bottom-24 z-50 mx-auto max-w-lg">
            <div className="bg-popover border rounded-2xl shadow-2xl overflow-hidden">
              {/* ヘッダー */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-sm font-semibold">プロンプト</h3>
                <div className="flex items-center gap-2">
                  <button onClick={startNewPrompt} className="text-xs text-blue-600 hover:underline">新規作成</button>
                  <button onClick={() => { setPromptModalOpen(false); setPromptEditId(null) }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 編集フォーム */}
              {promptEditId && (
                <div className="px-4 py-3 border-b bg-muted/30 space-y-2">
                  <input
                    type="text"
                    value={promptEditTitle}
                    onChange={e => setPromptEditTitle(e.target.value)}
                    placeholder="タイトル（例: 週次レポート作成）"
                    className="w-full text-sm px-3 py-1.5 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    autoFocus
                  />
                  <textarea
                    value={promptEditContent}
                    onChange={e => setPromptEditContent(e.target.value)}
                    placeholder="プロンプト本文"
                    rows={3}
                    className="w-full text-sm px-3 py-1.5 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-ring resize"
                    style={{ minHeight: '72px' }}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setPromptEditId(null)}>キャンセル</Button>
                    <Button size="sm" className="text-xs h-7" onClick={savePromptEdit} disabled={!promptEditTitle.trim() || !promptEditContent.trim()}>保存</Button>
                  </div>
                </div>
              )}

              {/* プロンプト一覧 */}
              <div className="max-h-60 overflow-y-auto">
                {prompts.length === 0 && !promptEditId ? (
                  <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
                    <BookmarkPlus className="h-8 w-8 mb-2 text-muted-foreground/30" />
                    <p>プロンプトがありません</p>
                    <button onClick={startNewPrompt} className="text-blue-600 hover:underline mt-1 text-xs">作成する</button>
                  </div>
                ) : (
                  prompts.map(p => (
                    <div key={p.id} className="group flex items-start gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors border-b last:border-b-0">
                      <button
                        type="button"
                        onClick={() => selectPrompt(p)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{p.content}</p>
                      </button>
                      <div className="shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                        <button onClick={() => startEditPrompt(p)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="編集">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleDeletePrompt(p.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500" title="削除">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
