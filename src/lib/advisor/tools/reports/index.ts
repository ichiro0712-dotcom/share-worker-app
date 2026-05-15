import type { AdvisorTool } from '../types'
import { updateReportDraftTool } from './update-report-draft'
import { editReportSectionTool } from './edit-report-section'
import { addTablesToReportTool } from './add-tables-to-report'

// get_report_draft は廃止: ドラフト状態は system prompt の dynamic 部分に毎回埋め込まれるため
// Claude がツール往復で取得する必要がない。loop=1 の TTFB 100 秒問題を回避する。
export const reportTools: AdvisorTool[] = [
  updateReportDraftTool as unknown as AdvisorTool,
  editReportSectionTool as unknown as AdvisorTool,
  addTablesToReportTool as unknown as AdvisorTool,
]
