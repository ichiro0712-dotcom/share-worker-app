/**
 * レポート Markdown の「空き穴」検出 (Phase 1)
 *
 * 検出対象:
 *  - 表のうち、本文セル (ヘッダ以外) が全て "-" / "N/A" / 空 / "0" のもの
 *  - 「取得できません」「未取得」「データなし」を含む段落
 *
 * 検出した穴は「ブロック単位」 (= 1 表 / 1 段落) で返す。
 * 同じ章の連続ブロックは groupGapBlocks で 1 グループにまとめる (リトライ時のコンテキスト共有)。
 */

export interface GapBlock {
  /** 元 Markdown 内での位置 (置換時に使う) */
  start: number
  end: number
  /** 検出した生テキスト (改行込み) */
  rawText: string
  /** ブロック種別 */
  kind: 'empty_table' | 'unavailable_paragraph'
  /** 直前の章タイトル (例: "## LP5 パフォーマンス概要") */
  chapterTitle: string | null
  /** 表のときの推定列名 (ヘッダ行から) */
  tableHeaders?: string[]
  /** 段落のときの "取得できない" 旨の文言 */
  unavailableReason?: string
}

const EMPTY_CELL_PATTERNS = ['-', '—', 'N/A', 'n/a', '未取得', 'データなし', '取得不可', '']

const UNAVAILABLE_KEYWORDS = [
  '取得できません',
  '取得できませんでした',
  '取得できない',
  '集計できません',
  '集計できませんでした',
  '集計できない',
  '現時点のデータでは集計できません',
  '現在取得できません',
  '未取得',
  'データなし',
]

/**
 * 1 行の表のセルが「空」とみなせるか。
 *  - "-" "N/A" "0" のみ、空白のみ、太字/イタリックの "-" など。
 *  - "**-**" のような Markdown 装飾も除いてから比較する。
 */
function isCellEmpty(cell: string): boolean {
  const cleaned = cell
    .trim()
    .replace(/^\*+|\*+$/g, '') // 前後の * を除く
    .replace(/^_+|_+$/g, '')   // 前後の _ を除く
    .trim()
  if (!cleaned) return true
  if (EMPTY_CELL_PATTERNS.includes(cleaned)) return true
  if (/^[-—\s]+$/.test(cleaned)) return true // ハイフン+空白だけ
  return false
}

/**
 * Markdown のテーブル行 (`| col1 | col2 |`) をセル配列に分解。
 * 区切り行 (`|---|---|`) は分離マーカーなのでセルとしてカウントしない側で処理。
 */
function parseTableRow(line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return []
  // 先頭・末尾の | を取り除いてから | で split
  const inner = trimmed.slice(1, -1)
  return inner.split('|').map((c) => c.trim())
}

function isSeparatorRow(line: string): boolean {
  const cells = parseTableRow(line)
  if (cells.length === 0) return false
  return cells.every((c) => /^:?-+:?$/.test(c.trim()))
}

/**
 * 直近の章タイトル (= "## ..." 行) を行番号から逆引きする。
 */
function findChapterTitle(markdownLines: string[], targetLineIndex: number): string | null {
  for (let i = targetLineIndex; i >= 0; i--) {
    const line = markdownLines[i]
    if (/^#{1,3}\s+/.test(line)) return line.trim()
  }
  return null
}

/**
 * Markdown 全体をスキャンして「空き穴」ブロックを抽出する。
 * シンプルな状態機械: 行を上から順に見て、表 / 段落の境界を検出。
 */
export function detectGapBlocks(markdown: string): GapBlock[] {
  const blocks: GapBlock[] = []
  const lines = markdown.split('\n')

  // 文字位置マップ: lines[i] が markdown 内の何文字目から始まるか
  const lineStarts: number[] = [0]
  let pos = 0
  for (let i = 0; i < lines.length; i++) {
    pos += lines[i].length + 1 // +1 for \n
    lineStarts.push(pos)
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // === 表の検出 ===
    if (line.trim().startsWith('|') && line.trim().endsWith('|') && parseTableRow(line).length >= 2) {
      // 表ブロックの開始候補。次行が separator ならば確定。
      const headerLine = line
      const sepLineIdx = i + 1
      if (sepLineIdx < lines.length && isSeparatorRow(lines[sepLineIdx])) {
        // 表本体: separator の次から、空行 or 非テーブル行まで
        const bodyStart = sepLineIdx + 1
        let bodyEnd = bodyStart
        const bodyRows: string[][] = []
        while (
          bodyEnd < lines.length &&
          lines[bodyEnd].trim().startsWith('|') &&
          lines[bodyEnd].trim().endsWith('|')
        ) {
          const cells = parseTableRow(lines[bodyEnd])
          if (cells.length > 0) bodyRows.push(cells)
          bodyEnd++
        }

        // 本体行が 1 つでも存在し、すべての本体セル (= 全体の 80% 以上) が空なら gap とみなす
        if (bodyRows.length > 0) {
          const totalCells = bodyRows.reduce((acc, r) => acc + r.length, 0)
          const emptyCells = bodyRows.reduce(
            (acc, r) => acc + r.filter(isCellEmpty).length,
            0
          )
          if (totalCells > 0 && emptyCells / totalCells >= 0.8) {
            const start = lineStarts[i]
            const end = lineStarts[bodyEnd] ?? markdown.length
            const rawText = markdown.slice(start, end)
            blocks.push({
              start,
              end,
              rawText,
              kind: 'empty_table',
              chapterTitle: findChapterTitle(lines, i - 1),
              tableHeaders: parseTableRow(headerLine),
            })
          }
        }

        i = bodyEnd
        continue
      }
    }

    // === 「取得できません」段落の検出 ===
    if (UNAVAILABLE_KEYWORDS.some((kw) => line.includes(kw))) {
      // 直前直後で同じ段落の境界を取る (空行で区切られる)
      let paraStart = i
      while (paraStart > 0 && lines[paraStart - 1].trim() !== '') paraStart--
      let paraEnd = i
      while (paraEnd < lines.length - 1 && lines[paraEnd + 1].trim() !== '') paraEnd++
      const start = lineStarts[paraStart]
      const end = lineStarts[paraEnd + 1] ?? markdown.length
      const rawText = markdown.slice(start, end)
      // 同じ段落をすでに登録していなければ追加
      if (!blocks.some((b) => b.start === start && b.end === end)) {
        blocks.push({
          start,
          end,
          rawText,
          kind: 'unavailable_paragraph',
          chapterTitle: findChapterTitle(lines, paraStart - 1),
          unavailableReason: line.trim(),
        })
      }
      i = paraEnd + 1
      continue
    }

    i++
  }

  return blocks
}

/**
 * gap ブロックを「同じ章」単位でグループ化する。
 * 同じ章なら整合性を保てるので 1 リクエストでまとめて Gemini に依頼する。
 */
export interface GapGroup {
  chapterTitle: string | null
  blocks: GapBlock[]
}

export function groupGapBlocks(blocks: GapBlock[]): GapGroup[] {
  const groups = new Map<string, GapBlock[]>()
  for (const b of blocks) {
    const key = b.chapterTitle ?? '__no_chapter__'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(b)
  }
  return Array.from(groups.entries()).map(([key, blocks]) => ({
    chapterTitle: key === '__no_chapter__' ? null : key,
    blocks,
  }))
}
