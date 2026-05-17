/**
 * レポート Markdown の「空き穴」検出 (Phase 1)
 *
 * 検出対象 (2026-05-07 修正: 表のみに絞る):
 *  - 表のうち、本文セル (ヘッダ以外) が全て "-" / "N/A" / 空 / "0" のもの
 *
 * 段落 (サマリ / 考察等) は触らない方針:
 *  - 「取得できません」と書かれていても、それは「考察」の一部としてユーザーが意図的に残している可能性が高い
 *  - LLM に書き直させると元の文脈 (サマリ全体・考察全体) を消してしまう事故が発生
 *  - したがって表だけを対象に絞り、段落は手を入れない
 *
 * 検出した穴は「ブロック単位」 (= 1 表) で返す。
 * 同じ章の連続ブロックは groupGapBlocks で 1 グループにまとめる (リトライ時のコンテキスト共有)。
 */

export interface GapBlock {
  /** 元 Markdown 内での位置 (置換時に使う) */
  start: number
  end: number
  /** 検出した生テキスト (改行込み) */
  rawText: string
  /** ブロック種別 (現在は empty_table のみ。段落は故意に対象外) */
  kind: 'empty_table'
  /** 直前の章タイトル (例: "## LP5 パフォーマンス概要") */
  chapterTitle: string | null
  /** 表の推定列名 (ヘッダ行から) */
  tableHeaders?: string[]
}

const EMPTY_CELL_PATTERNS = ['-', '—', 'N/A', 'n/a', '未取得', 'データなし', '取得不可', '']

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

        // 本体行が 1 つでも存在する場合の検出ロジック:
        //   (A) 全セル空率 >= 80% → 全体的に空 (= 元 Phase1 の判定)
        //   (B) **1 列以上が完全に空** (= その列の全本体セルが "-" 等)
        //       PV 列だけ埋まっていて他列が全部 "-" のような「部分空表」も拾う。
        //
        //   どちらかに当てはまれば gap として扱う。Claude 側のシステムプロンプトは
        //   「取れたセルだけ埋めて他は "-" のままで OK」という指示なので、
        //   部分空表に対しても安全に動く。
        if (bodyRows.length > 0) {
          const headerCells = parseTableRow(headerLine)
          const colCount = headerCells.length
          const totalCells = bodyRows.reduce((acc, r) => acc + r.length, 0)
          const emptyCells = bodyRows.reduce(
            (acc, r) => acc + r.filter(isCellEmpty).length,
            0
          )
          const wholeEmpty = totalCells > 0 && emptyCells / totalCells >= 0.8

          // 列単位で「その列の全本体セルが空か」を見る (= 全列空チェック)
          let hasFullyEmptyColumn = false
          for (let col = 0; col < colCount; col++) {
            // 全本体行でこの列が空セルか
            let colHasNonEmpty = false
            for (const row of bodyRows) {
              const cell = row[col]
              if (cell !== undefined && !isCellEmpty(cell)) {
                colHasNonEmpty = true
                break
              }
            }
            if (!colHasNonEmpty) {
              hasFullyEmptyColumn = true
              break
            }
          }

          if (wholeEmpty || hasFullyEmptyColumn) {
            const start = lineStarts[i]
            const end = lineStarts[bodyEnd] ?? markdown.length
            const rawText = markdown.slice(start, end)
            blocks.push({
              start,
              end,
              rawText,
              kind: 'empty_table',
              chapterTitle: findChapterTitle(lines, i - 1),
              tableHeaders: headerCells,
            })
          }
        }

        i = bodyEnd
        continue
      }
    }

    // 段落 (= 「取得できません」を含むサマリ・考察等) は意図的に検出しない。
    // LLM に書き直させると元の文脈を破壊する事故が発生したため、表のみ対象とする。
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
