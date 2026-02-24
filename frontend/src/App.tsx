import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChatWidget } from './ChatWidget'
import { DetailedRoadmap } from './DetailedRoadmap'

type CapacityRoleAlert = {
  role: 'FE' | 'BE' | 'AI' | 'PM' | string
  status: 'OK' | 'WARNING' | 'CRITICAL' | string
  portfolio: 'client' | 'internal' | '' | string
  peak_week: string
  peak_demand_fte: number
  capacity_fte: number
  required_extra_fte: number
  peak_utilization_pct: number | null
}

type CapacityGovernanceAlert = {
  status: 'OK' | 'WARNING' | 'CRITICAL' | string
  message: string
  shortage_roles: string[]
  warning_roles: string[]
  unscheduled_demand_items: number
  role_alerts: CapacityRoleAlert[]
}

type Dashboard = {
  intake_total: number
  intake_understanding_pending: number
  intake_draft: number
  rnd_intake_total: number
  ai_intake_total: number
  commitments_total: number
  commitments_ready: number
  commitments_locked: number
  rnd_commitments_total: number
  ai_commitments_total: number
  roadmap_total: number
  rnd_roadmap_total: number
  ai_roadmap_total: number
  roadmap_movement_pending: number
  roadmap_movement_approved: number
  roadmap_movement_rejected: number
  roadmap_movement_total: number
  intake_by_context: Record<string, number>
  commitments_by_context: Record<string, number>
  roadmap_by_context: Record<string, number>
  intake_by_mode: Record<string, number>
  commitments_by_mode: Record<string, number>
  roadmap_by_mode: Record<string, number>
  commitments_by_priority: Record<string, number>
  roadmap_by_priority: Record<string, number>
  capacity_governance_alert?: CapacityGovernanceAlert
}

type DocumentItem = {
  id: number
  project_id: number | null
  uploaded_by: number
  file_name: string
  file_type: string
  file_path: string
  notes: string
}

type IntakeItem = {
  id: number
  document_id: number
  document_class: string
  title: string
  scope: string
  activities: string[]
  source_quotes: string[]
  priority: string
  project_context: string
  initiative_type: string
  delivery_mode: string
  rnd_hypothesis: string
  rnd_experiment_goal: string
  rnd_success_criteria: string
  rnd_timebox_weeks: number | null
  rnd_decision_date: string
  rnd_next_gate: string
  rnd_risk_level: string
  status: string
  roadmap_item_id: number | null
  version_no: number
  created_at?: string
}

type RoadmapItem = {
  id: number
  title: string
  scope: string
  activities: string[]
  priority: string
  project_context: string
  initiative_type: string
  delivery_mode: string
  rnd_hypothesis: string
  rnd_experiment_goal: string
  rnd_success_criteria: string
  rnd_timebox_weeks: number | null
  rnd_decision_date: string
  rnd_next_gate: string
  rnd_risk_level: string
  fe_fte: number | null
  be_fte: number | null
  ai_fte: number | null
  pm_fte: number | null
  accountable_person: string
  picked_up: boolean
  source_document_id: number | null
  version_no: number
  created_at: string
}

type RoadmapRedundancy = {
  item_id: number
  is_redundant: boolean
  best_score: number
  best_match_id: number | null
  best_match_title: string
  resolved_by_decision: string
  matches: Array<{
    item_id: number
    title: string
    score: number
  }>
}

type LLMConfig = {
  id: number
  provider: string
  model: string
  base_url: string
  is_active: boolean
}

type LLMTestResult = {
  ok: boolean
  provider: string
  model: string
  message: string
}

type GovernanceConfig = {
  id: number
  team_fe: number
  team_be: number
  team_ai: number
  team_pm: number
  efficiency_fe: number
  efficiency_be: number
  efficiency_ai: number
  efficiency_pm: number
  quota_client: number
  quota_internal: number
  team_locked_until: string | null
  team_locked_by: number | null
  quota_locked_until: string | null
  quota_locked_by: number | null
  efficiency_confirmed_ceo_at: string | null
  efficiency_confirmed_ceo_by: number | null
  efficiency_confirmed_vp_at: string | null
  efficiency_confirmed_vp_by: number | null
  roadmap_locked: boolean
  roadmap_locked_at: string | null
  roadmap_locked_by: number | null
  roadmap_lock_note: string
}

type CapacityValidationResult = {
  status: 'APPROVED' | 'REJECTED'
  breach_roles: string[]
  utilization_percentage: {
    FE: string
    BE: string
    AI: string
    PM: string
  }
  reason: string
}

type VersionItem = {
  id: number
  action: string
  changed_by: number | null
  changed_by_email: string | null
  changed_fields: string[]
  before_data: Record<string, unknown>
  after_data: Record<string, unknown>
  created_at: string
}

type AuditSummary = {
  documents_total: number
  intake_changes_total: number
  roadmap_changes_total: number
  movement_total: number
}

type AuditDocumentRow = {
  document_id: number
  file_name: string
  file_type: string
  file_hash: string
  notes: string
  uploaded_by: number
  uploaded_by_email: string | null
  uploaded_by_role: string | null
  created_at: string
  intake_item_id: number | null
  intake_status: string
  roadmap_item_id: number | null
  roadmap_plan_item_id: number | null
  roadmap_planning_status: string
  project_context: string
}

type AuditIntakeChangeRow = {
  event_id: number
  intake_item_id: number
  document_id: number | null
  title: string
  action: string
  status: string
  project_context: string
  changed_by: number | null
  changed_by_email: string | null
  changed_by_role: string | null
  changed_fields: string[]
  created_at: string
}

type AuditRoadmapChangeRow = {
  event_id: number
  roadmap_item_id: number
  title: string
  action: string
  project_context: string
  changed_by: number | null
  changed_by_email: string | null
  changed_by_role: string | null
  changed_fields: string[]
  created_at: string
}

type AuditMovementRow = {
  request_id: number
  plan_item_id: number
  bucket_item_id: number
  title: string
  status: string
  request_type: string
  project_context: string
  from_start_date: string
  from_end_date: string
  to_start_date: string
  to_end_date: string
  reason: string
  blocker: string
  decision_reason: string
  requested_by: number | null
  requested_by_email: string | null
  requested_by_role: string | null
  decided_by: number | null
  decided_by_email: string | null
  decided_by_role: string | null
  requested_at: string
  decided_at: string | null
  executed_at: string | null
}

type AuditCenterPayload = {
  generated_at: string
  summary: AuditSummary
  documents: AuditDocumentRow[]
  intake_changes: AuditIntakeChangeRow[]
  roadmap_changes: AuditRoadmapChangeRow[]
  movement_events: AuditMovementRow[]
}

type IntakeAnalysisPayload = {
  intake_item_id: number
  primary_type: string
  confidence: string
  output_json: Record<string, unknown>
  intake_item_version_no?: number
}

type ChatResponse = {
  answer: string
  evidence: string[]
  actions?: string[]
  support_applied?: boolean
  intake_item_id?: number | null
  support_state?: string
  intent_clear?: boolean | null
  next_action?: string
}

type SystemRole = 'ADMIN' | 'CEO' | 'VP' | 'BA' | 'PM' | 'PO'

type CurrentUser = {
  id: number
  full_name: string
  email: string
  role: SystemRole
  role_label: string
  custom_role_id: number | null
  custom_role_name: string | null
  is_active: boolean
  force_password_change: boolean
  password_changed_at: string | null
}

type UserAdmin = {
  id: number
  full_name: string
  email: string
  role: SystemRole
  role_label: string
  custom_role_id: number | null
  custom_role_name: string | null
  is_active: boolean
  force_password_change: boolean
  password_changed_at: string | null
}

type RolePolicy = {
  role: string
  role_kind: 'system' | 'custom' | string
  base_role: SystemRole
  can_create_users: boolean
  can_configure_team_capacity: boolean
  can_allocate_portfolio_quotas: boolean
  can_submit_commitment: boolean
  can_edit_roadmap: boolean
  can_manage_settings: boolean
  scope: string
  responsibilities: string[]
}

type CustomRole = {
  id: number
  name: string
  base_role: SystemRole
  scope: string
  responsibilities: string[]
  can_create_users: boolean
  can_configure_team_capacity: boolean
  can_allocate_portfolio_quotas: boolean
  can_submit_commitment: boolean
  can_edit_roadmap: boolean
  can_manage_settings: boolean
  is_active: boolean
}

type RoadmapMovementRequest = {
  id: number
  plan_item_id: number
  bucket_item_id: number
  request_type: string
  status: string
  from_start_date: string
  from_end_date: string
  to_start_date: string
  to_end_date: string
  reason: string
  blocker: string
  decision_reason: string
  requested_by: number | null
  decided_by: number | null
  requested_at: string
  decided_at: string | null
  executed_at: string | null
  created_at: string
  updated_at: string
}

type WorkflowAlert = {
  id: string
  level: 'critical' | 'warning' | 'info'
  title: string
  message: string
  path: string
}

type IntakeSeedMeta = {
  priority: string
  project_context: string
  initiative_type: string
  delivery_mode: string
  rnd_hypothesis: string
  rnd_experiment_goal: string
  rnd_success_criteria: string
  rnd_timebox_weeks: number | null
  rnd_decision_date: string
  rnd_next_gate: string
  rnd_risk_level: string
}

type ManualIntakeIn = {
  title: string
  scope: string
  activities: string[]
  priority: string
  project_context: string
  initiative_type: string
  delivery_mode: string
  rnd_hypothesis: string
  rnd_experiment_goal: string
  rnd_success_criteria: string
  rnd_timebox_weeks: number | null
  rnd_decision_date: string
  rnd_next_gate: string
  rnd_risk_level: string
}

type UnderstandingApprovalInput = {
  primary_intent: string
  explicit_outcomes: string[]
  dominant_theme: string
  confidence: string
  activity_mode: 'commitment' | 'implementation'
  expected_version_no: number
}

type RoadmapPlanItem = {
  id: number
  bucket_item_id: number
  title: string
  scope: string
  activities: string[]
  priority: string
  project_context: string
  initiative_type: string
  delivery_mode: string
  rnd_hypothesis: string
  rnd_experiment_goal: string
  rnd_success_criteria: string
  rnd_timebox_weeks: number | null
  rnd_decision_date: string
  rnd_next_gate: string
  rnd_risk_level: string
  fe_fte: number | null
  be_fte: number | null
  ai_fte: number | null
  pm_fte: number | null
  accountable_person: string
  entered_roadmap_at: string
  planned_start_date: string
  planned_end_date: string
  resource_count: number | null
  effort_person_weeks: number | null
  planning_status: string
  confidence: string
  dependency_ids: number[]
  tentative_duration_weeks: number | null
  pickup_period: string
  completion_period: string
  version_no: number
  created_at: string
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'
const EFFICIENCY_MIN = 0.1
const EFFICIENCY_MAX = 1.0
const TEAM_SIZE_MIN = 1
const EFFICIENCY_CONFIRM_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000
const PASSWORD_MIN_LENGTH = 12
const PASSWORD_MAX_LENGTH = 128

// Helper function to get project type color for Gantt bars
function getProjectTypeColor(projectContext: string, deliveryMode: string): string {
  if (deliveryMode === 'rnd') return '#7C3AED' // Purple for R&D
  if (projectContext === 'client') return '#059669' // Green for Client
  return '#D97706' // Orange for Internal
}

const rolePresets = [
  { label: 'ADMIN', email: 'admin@local.test' },
  { label: 'CEO', email: 'ceo@local.test' },
  { label: 'VP', email: 'vp@local.test' },
  { label: 'BA', email: 'ba@local.test' },
  { label: 'PM', email: 'pm@local.test' },
  { label: 'PO', email: 'po@local.test' },
]

const providerModelMap: Record<string, string[]> = {
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  vertex_gemini: ['gemini-2.0-flash-001', 'gemini-1.5-pro-002', 'gemini-1.5-flash-002'],
  claude: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
  glm: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],
  qwen: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  ollama: ['qwen2.5:7b', 'qwen2.5:14b', 'llama3.1:8b'],
  openai_compatible: ['gpt-4o-mini', 'gpt-4.1-mini', 'custom-model'],
}

async function api<T>(path: string, opts: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(opts.headers)
  if (!headers.has('Content-Type') && !(opts.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
  })

  if (!res.ok) {
    const text = await res.text()
    let message = text || `Request failed with ${res.status}`
    try {
      const parsed = JSON.parse(text)
      if (parsed?.detail) {
        message = String(parsed.detail)
      }
    } catch {
      // keep raw text
    }
    throw new Error(message)
  }

  return (await res.json()) as T
}

function fmtDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function fmtDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function fmtDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

function isStrongPassword(value: string): boolean {
  const pwd = String(value || '')
  if (pwd.length < PASSWORD_MIN_LENGTH || pwd.length > PASSWORD_MAX_LENGTH) return false
  if (!/[A-Z]/.test(pwd)) return false
  if (!/[a-z]/.test(pwd)) return false
  if (!/[0-9]/.test(pwd)) return false
  if (!/[^A-Za-z0-9]/.test(pwd)) return false
  if (/\s/.test(pwd)) return false
  return true
}

function parsePercent(value: string | undefined): number | null {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return 0
  if (raw === 'N/A' || raw === 'NA' || raw === '-') return null
  const n = Number(raw.replace('%', '').trim())
  if (!Number.isFinite(n)) return null
  return n
}

function capacityTone(usedPercent: number | null): 'ok' | 'warn' | 'error' {
  if (usedPercent == null) return 'error'
  if (usedPercent > 100) return 'error'
  if (usedPercent >= 85) return 'warn'
  return 'ok'
}

function CapacityMeters({
  title,
  utilization,
}: {
  title: string
  utilization: CapacityValidationResult['utilization_percentage']
}) {
  const roles: Array<'FE' | 'BE' | 'AI' | 'PM'> = ['FE', 'BE', 'AI', 'PM']
  return (
    <div className="capacity-meter-wrap">
      <div className="line-item">
        <strong>{title}</strong>
      </div>
      <div className="capacity-meter-grid">
        {roles.map((role) => {
          const parsedUsed = parsePercent(utilization[role])
          const used = parsedUsed == null ? null : Math.max(0, parsedUsed)
          const available = used == null ? null : Math.max(0, 100 - used)
          const tone = capacityTone(used)
          const overBy = used != null && used > 100 ? used - 100 : 0
          return (
            <div key={role} className="capacity-meter-card">
              <div className="capacity-meter-head">
                <span>{role}</span>
                <span className={`capacity-meter-state ${tone}`}>
                  {used == null ? 'No capacity configured' : `${used.toFixed(1)}% used`}
                </span>
              </div>
              <div className="capacity-meter-track" aria-hidden="true">
                <div
                  className={`capacity-meter-fill ${tone}`}
                  style={{ width: `${used == null ? 100 : Math.min(used, 100)}%` }}
                />
              </div>
              <div className="capacity-meter-foot">
                <span className="muted">
                  {used == null
                    ? 'Assign team size, efficiency, and quota.'
                    : overBy > 0
                      ? `Over by ${overBy.toFixed(1)}%`
                      : `Available ${(available || 0).toFixed(1)}%`}
                </span>
                <span className="mono">{utilization[role]}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type RoleTotals = {
  FE: number
  BE: number
  AI: number
  PM: number
}

function emptyRoleTotals(): RoleTotals {
  return { FE: 0, BE: 0, AI: 0, PM: 0 }
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const at = date.getTime()
  return at >= start.getTime() && at <= end.getTime()
}

function addPlanFte(usage: RoleTotals, plan: RoadmapPlanItem): RoleTotals {
  return {
    FE: usage.FE + Math.max(0, plan.fe_fte || 0),
    BE: usage.BE + Math.max(0, plan.be_fte || 0),
    AI: usage.AI + Math.max(0, plan.ai_fte || 0),
    PM: usage.PM + Math.max(0, plan.pm_fte || 0),
  }
}

function weeklyCapacityByPortfolio(governanceConfig: GovernanceConfig | null, portfolio: 'client' | 'internal'): RoleTotals {
  if (!governanceConfig) return emptyRoleTotals()
  const quota = portfolio === 'client' ? governanceConfig.quota_client : governanceConfig.quota_internal
  return {
    FE: Math.max(0, governanceConfig.team_fe * governanceConfig.efficiency_fe * quota),
    BE: Math.max(0, governanceConfig.team_be * governanceConfig.efficiency_be * quota),
    AI: Math.max(0, governanceConfig.team_ai * governanceConfig.efficiency_ai * quota),
    PM: Math.max(0, governanceConfig.team_pm * governanceConfig.efficiency_pm * quota),
  }
}

function utilizationFromUsage(usage: RoleTotals, capacity: RoleTotals): CapacityValidationResult['utilization_percentage'] {
  const roles: Array<keyof RoleTotals> = ['FE', 'BE', 'AI', 'PM']
  const out: CapacityValidationResult['utilization_percentage'] = { FE: '0.0%', BE: '0.0%', AI: '0.0%', PM: '0.0%' }
  for (const role of roles) {
    const used = usage[role]
    const cap = capacity[role]
    if (cap <= 0) {
      out[role] = used <= 0 ? '0.0%' : 'N/A'
      continue
    }
    const pct = (used / cap) * 100
    out[role] = `${pct.toFixed(1)}%`
  }
  return out
}

type ActivityTag = 'FE' | 'BE' | 'AI'

const ACTIVITY_TAGS: ActivityTag[] = ['FE', 'BE', 'AI']

function parseActivityEntry(value: string): { text: string; tags: ActivityTag[] } {
  const raw = (value || '').trim()
  const matched = raw.match(/^\[([^\]]+)\]\s*(.*)$/)
  if (!matched) return { text: raw, tags: [] }

  const parsed = matched[1]
    .split(/[\/,\s|]+/)
    .map((x) => x.trim().toUpperCase())
    .filter((x): x is ActivityTag => ACTIVITY_TAGS.includes(x as ActivityTag))
  const tags = Array.from(new Set(parsed))
  return { text: (matched[2] || '').trim(), tags }
}

function formatActivityEntry(text: string, tags: ActivityTag[]): string {
  const cleanText = (text || '').trim()
  const cleanTags = Array.from(new Set(tags.filter((t) => ACTIVITY_TAGS.includes(t))))
  if (!cleanTags.length) return cleanText
  if (!cleanText) return `[${cleanTags.join('/')}]`
  return `[${cleanTags.join('/')}] ${cleanText}`
}

function inferActivityTag(text: string): ActivityTag {
  const low = (text || '').toLowerCase()
  if (/(ui|ux|frontend|front-end|screen|dashboard|form|portal|web|mobile|component|view)/.test(low)) return 'FE'
  if (/(ai|ml|llm|model|prompt|ocr|classif|extract|summar|nlp|inference|genai|rag)/.test(low)) return 'AI'
  return 'BE'
}

function hasAiTagInActivities(items: string[]): boolean {
  return (items || []).some((entry) => parseActivityEntry(entry).tags.includes('AI'))
}

function ensureTaggedActivity(value: string): string {
  const parsed = parseActivityEntry(value)
  const text = (parsed.text || value || '').trim()
  if (parsed.tags.length > 0) return formatActivityEntry(text, parsed.tags)
  return formatActivityEntry(text, [inferActivityTag(text)])
}

function normalizeActivitiesForEditor(items: string[]): string[] {
  if (!items.length) return ['[BE]']
  return items.map((it) => ensureTaggedActivity(it))
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [email, setEmail] = useState('ceo@local.test')
  const [password, setPassword] = useState('pass1234')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordModalForced, setPasswordModalForced] = useState(false)
  const [passwordCurrent, setPasswordCurrent] = useState('')
  const [passwordNext, setPasswordNext] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [intakeItems, setIntakeItems] = useState<IntakeItem[]>([])
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([])
  const [roadmapPlanItems, setRoadmapPlanItems] = useState<RoadmapPlanItem[]>([])
  const [roadmapRedundancy, setRoadmapRedundancy] = useState<RoadmapRedundancy[]>([])
  const [roadmapRedundancyError, setRoadmapRedundancyError] = useState('')
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([])

  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadPickerKey, setUploadPickerKey] = useState(0)
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')

  const [selectedIntakeId, setSelectedIntakeId] = useState<number | null>(null)
  const [reviewTitle, setReviewTitle] = useState('')
  const [reviewScope, setReviewScope] = useState('')
  const [reviewActivities, setReviewActivities] = useState<string[]>([])
  const [intakeHistory, setIntakeHistory] = useState<VersionItem[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<IntakeAnalysisPayload | null>(null)
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([])

  const [selectedRoadmapId, setSelectedRoadmapId] = useState<number | null>(null)
  const [roadmapTitle, setRoadmapTitle] = useState('')
  const [roadmapScope, setRoadmapScope] = useState('')
  const [roadmapActivities, setRoadmapActivities] = useState<string[]>([])
  const [roadmapPriority, setRoadmapPriority] = useState('medium')
  const [roadmapProjectContext, setRoadmapProjectContext] = useState('client')
  const [roadmapInitiativeType, setRoadmapInitiativeType] = useState('new_feature')
  const [roadmapDeliveryMode, setRoadmapDeliveryMode] = useState('standard')
  const [roadmapRndHypothesis, setRoadmapRndHypothesis] = useState('')
  const [roadmapRndExperimentGoal, setRoadmapRndExperimentGoal] = useState('')
  const [roadmapRndSuccessCriteria, setRoadmapRndSuccessCriteria] = useState('')
  const [roadmapRndTimeboxWeeks, setRoadmapRndTimeboxWeeks] = useState<number | null>(null)
  const [roadmapRndDecisionDate, setRoadmapRndDecisionDate] = useState('')
  const [roadmapRndNextGate, setRoadmapRndNextGate] = useState('')
  const [roadmapRndRiskLevel, setRoadmapRndRiskLevel] = useState('')
  const [roadmapFeFte, setRoadmapFeFte] = useState('')
  const [roadmapBeFte, setRoadmapBeFte] = useState('')
  const [roadmapAiFte, setRoadmapAiFte] = useState('')
  const [roadmapPmFte, setRoadmapPmFte] = useState('')
  const [roadmapAccountablePerson, setRoadmapAccountablePerson] = useState('')
  const [roadmapPickedUp, setRoadmapPickedUp] = useState(false)
  const [selectedRoadmapIds, setSelectedRoadmapIds] = useState<number[]>([])
  const [roadmapMove, setRoadmapMove] = useState({
    tentative_duration_weeks: '',
    pickup_period: '',
    completion_period: '',
  })

  const [providerForm, setProviderForm] = useState({
    provider: 'ollama',
    model: 'qwen2.5:7b',
    base_url: 'http://localhost:11434/v1',
    api_key: '',
  })
  const [governanceConfig, setGovernanceConfig] = useState<GovernanceConfig | null>(null)
  const [users, setUsers] = useState<UserAdmin[]>([])
  const [roadmapMovementRequests, setRoadmapMovementRequests] = useState<RoadmapMovementRequest[]>([])
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [rolePolicies, setRolePolicies] = useState<RolePolicy[]>([])
  const [useCustomModel, setUseCustomModel] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<LLMTestResult | null>(null)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [chatSupportRequest, setChatSupportRequest] = useState<{
    key: string
    intakeItemId: number
    title: string
  } | null>(null)
  const alertsRef = useRef<HTMLDivElement | null>(null)

  const isLoggedIn = Boolean(token)

  const intakeByDocument = useMemo(() => {
    const map = new Map<number, IntakeItem>()
    for (const item of intakeItems) map.set(item.document_id, item)
    return map
  }, [intakeItems])

  const activeConfig = useMemo(() => llmConfigs.find((cfg) => cfg.is_active), [llmConfigs])
  const welcomeBanner = useMemo(() => {
    if (!currentUser) return ''
    const displayName = (currentUser.full_name || '').trim() || currentUser.email
    const roleName = currentUser.custom_role_name || currentUser.role
    switch (currentUser.role) {
      case 'ADMIN':
        return `Welcome ${displayName} (${roleName})`
      case 'CEO':
        return `Welcome ${displayName} (${roleName})`
      case 'VP':
        return `Welcome ${displayName} (${roleName})`
      case 'BA':
        return `Welcome ${displayName} (${roleName})`
      case 'PM':
      case 'PO':
        return `Welcome ${displayName} (${roleName})`
      default:
        return `Welcome ${displayName} (${roleName}).`
    }
  }, [currentUser])

  const workflowAlerts = useMemo<WorkflowAlert[]>(() => {
    const role = currentUser?.role
    if (!role) return []
    const alerts: WorkflowAlert[] = []
    const now = Date.now()
    const isExec = role === 'CEO' || role === 'VP'
    const isDelivery = role === 'PM' || role === 'PO'

    const push = (item: WorkflowAlert) => alerts.push(item)

    if (!activeConfig && (isExec || role === 'BA' || isDelivery)) {
      push({
        id: 'alert-no-llm',
        level: 'warning',
        title: 'AI Provider Not Configured',
        message: 'No active LLM provider is configured in Settings.',
        path: '/settings',
      })
    }

    if (governanceConfig) {
      const teamMin = Math.min(
        governanceConfig.team_fe || 0,
        governanceConfig.team_be || 0,
        governanceConfig.team_ai || 0,
        governanceConfig.team_pm || 0,
      )
      const effMin = Math.min(
        governanceConfig.efficiency_fe || 0,
        governanceConfig.efficiency_be || 0,
        governanceConfig.efficiency_ai || 0,
        governanceConfig.efficiency_pm || 0,
      )
      const effMax = Math.max(
        governanceConfig.efficiency_fe || 0,
        governanceConfig.efficiency_be || 0,
        governanceConfig.efficiency_ai || 0,
        governanceConfig.efficiency_pm || 0,
      )
      const quotaTotal = (governanceConfig.quota_client || 0) + (governanceConfig.quota_internal || 0)
      const teamLock = governanceConfig.team_locked_until ? new Date(governanceConfig.team_locked_until).getTime() : 0
      const quotaLock = governanceConfig.quota_locked_until ? new Date(governanceConfig.quota_locked_until).getTime() : 0

      if (role === 'CEO' && teamMin < TEAM_SIZE_MIN) {
        push({
          id: 'alert-team-size-invalid',
          level: 'critical',
          title: 'Team Capacity Invalid',
          message: `One or more team sizes are below ${TEAM_SIZE_MIN}.`,
          path: '/settings',
        })
      }
      if (role === 'CEO' && (effMin < EFFICIENCY_MIN || effMax > EFFICIENCY_MAX)) {
        push({
          id: 'alert-efficiency-invalid',
          level: 'critical',
          title: 'Efficiency Out of Bounds',
          message: `Efficiency must stay between ${EFFICIENCY_MIN.toFixed(2)} and ${EFFICIENCY_MAX.toFixed(2)}.`,
          path: '/settings',
        })
      }
      if (isExec && quotaTotal > 1.0 + 1e-9) {
        push({
          id: 'alert-quota-over',
          level: 'critical',
          title: 'Quota Limit Breached',
          message: `Client + Internal quota is ${quotaTotal.toFixed(2)} (> 1.00).`,
          path: '/settings',
        })
      }
      if (isExec && quotaTotal < 1.0 - 1e-9) {
        push({
          id: 'alert-quota-under',
          level: 'info',
          title: 'Unallocated Capacity',
          message: `Portfolio quota total is ${quotaTotal.toFixed(2)}; capacity remains unallocated.`,
          path: '/settings',
        })
      }
      if (role === 'CEO' && Number.isFinite(teamLock) && teamLock > now) {
        push({
          id: 'alert-team-locked',
          level: 'warning',
          title: 'Team Capacity Locked',
          message: `Team configuration is locked for ${fmtDuration(teamLock - now)}.`,
          path: '/settings',
        })
      }
      if (isExec && Number.isFinite(quotaLock) && quotaLock > now) {
        push({
          id: 'alert-quota-locked',
          level: 'warning',
          title: 'Portfolio Quotas Locked',
          message: `Quota configuration is locked for ${fmtDuration(quotaLock - now)}.`,
          path: '/settings',
        })
      }
      if (role === 'CEO' && governanceConfig.roadmap_locked) {
        push({
          id: 'alert-roadmap-locked',
          level: 'info',
          title: 'Roadmap Is Locked',
          message: `Locked governance is active${governanceConfig.roadmap_locked_at ? ` since ${fmtDateTime(governanceConfig.roadmap_locked_at)}` : ''}.`,
          path: '/roadmap-agent',
        })
      }
      if (role === 'CEO') {
        const lastConfirmed = governanceConfig.efficiency_confirmed_ceo_at ? new Date(governanceConfig.efficiency_confirmed_ceo_at).getTime() : 0
        if (!Number.isFinite(lastConfirmed) || lastConfirmed <= 0 || now - lastConfirmed >= EFFICIENCY_CONFIRM_INTERVAL_MS) {
          push({
            id: 'alert-eff-confirm-ceo',
            level: 'warning',
            title: 'Monthly Efficiency Confirmation Due',
            message: 'Confirm FE/BE/AI/PM efficiency baseline for this month.',
            path: '/settings',
          })
        }
      }
      if (role === 'VP') {
        const lastConfirmed = governanceConfig.efficiency_confirmed_vp_at ? new Date(governanceConfig.efficiency_confirmed_vp_at).getTime() : 0
        if (!Number.isFinite(lastConfirmed) || lastConfirmed <= 0 || now - lastConfirmed >= EFFICIENCY_CONFIRM_INTERVAL_MS) {
          push({
            id: 'alert-eff-confirm-vp',
            level: 'warning',
            title: 'Monthly Efficiency Confirmation Due',
            message: 'Confirm FE/BE/AI/PM efficiency baseline for this month.',
            path: '/settings',
          })
        }
      }
    } else if (isExec || isDelivery) {
      push({
        id: 'alert-governance-missing',
        level: 'critical',
        title: 'Governance Missing',
        message: 'Team capacity and portfolio quotas are not configured.',
        path: '/settings',
      })
    }

    if (dashboard) {
      if (isExec && dashboard.capacity_governance_alert) {
        const capAlert = dashboard.capacity_governance_alert
        if (capAlert.status === 'CRITICAL') {
          const detail = capAlert.role_alerts
            .filter((r) => r.status === 'CRITICAL')
            .map((r) => `${r.role} (+${(r.required_extra_fte || 0).toFixed(1)} FTE)`)
            .join(', ')
          push({
            id: 'alert-capacity-shortage',
            level: 'critical',
            title: 'Deterministic Capacity Shortage',
            message: detail || capAlert.message,
            path: '/dashboard',
          })
        } else if (capAlert.status === 'WARNING') {
          const detail = capAlert.role_alerts
            .filter((r) => r.status === 'WARNING')
            .map((r) => `${r.role} (${(r.peak_utilization_pct || 0).toFixed(1)}%)`)
            .join(', ')
          push({
            id: 'alert-capacity-risk',
            level: 'warning',
            title: 'Capacity Risk Near Limit',
            message: detail || capAlert.message,
            path: '/dashboard',
          })
        }
        if (capAlert.unscheduled_demand_items > 0) {
          push({
            id: 'alert-unscheduled-demand',
            level: 'warning',
            title: 'Unscheduled Demand With FTE',
            message: `${capAlert.unscheduled_demand_items} roadmap item(s) have FTE demand but no schedule.`,
            path: '/roadmap-agent',
          })
        }
      }

      if (role === 'BA') {
        if (dashboard.intake_draft > 0) {
          push({
            id: 'alert-intake-draft',
            level: 'info',
            title: 'Draft Intake Pending',
            message: `${dashboard.intake_draft} intake item(s) still in draft.`,
            path: '/intake',
          })
        }
        if (dashboard.intake_understanding_pending > 0) {
          push({
            id: 'alert-intake-review',
            level: 'warning',
            title: 'Understanding Review Pending',
            message: `${dashboard.intake_understanding_pending} item(s) awaiting clarification/approval.`,
            path: '/intake',
          })
        }
      }

      if (role === 'CEO' && dashboard.intake_understanding_pending > 0) {
        push({
          id: 'alert-ceo-intake-approval',
          level: 'warning',
          title: 'CEO Intake Approval Needed',
          message: `${dashboard.intake_understanding_pending} intake item(s) require approval.`,
          path: '/intake',
        })
      }

      if (isExec || isDelivery) {
        if (dashboard.commitments_ready > 0) {
          push({
            id: 'alert-commitments-ready',
            level: 'info',
            title: 'Commitments Ready',
            message: `${dashboard.commitments_ready} commitment(s) are ready for roadmap planning.`,
            path: '/roadmap',
          })
        }
        if (dashboard.commitments_locked > 0) {
          push({
            id: 'alert-commitments-locked',
            level: 'warning',
            title: 'Locked Commitments',
            message: `${dashboard.commitments_locked} commitment(s) are locked and need unlock flow.`,
            path: '/roadmap',
          })
        }
      }
      if (role === 'CEO' && (dashboard.roadmap_total || 0) > 0 && !governanceConfig?.roadmap_locked) {
        push({
          id: 'alert-roadmap-lock-missing',
          level: 'warning',
          title: 'Roadmap Not Locked',
          message: 'Roadmap has committed items but governance lock is not enabled.',
          path: '/roadmap-agent',
        })
      }
      if (role === 'CEO' && (dashboard.roadmap_movement_pending || 0) > 0) {
        push({
          id: 'alert-roadmap-move-pending',
          level: 'critical',
          title: 'Movement Approvals Pending',
          message: `${dashboard.roadmap_movement_pending} roadmap movement request(s) await CEO decision.`,
          path: '/roadmap-agent',
        })
      }
    }

    if (isDelivery) {
      const pendingMine = roadmapMovementRequests.filter((r) => r.status === 'pending').length
      if (pendingMine > 0) {
        push({
          id: 'alert-my-move-pending',
          level: 'warning',
          title: 'Movement Request Pending',
          message: `${pendingMine} of your roadmap movement request(s) are pending CEO approval.`,
          path: '/roadmap-agent',
        })
      }
      const rejectedMine = roadmapMovementRequests.filter((r) => r.status === 'rejected').length
      if (rejectedMine > 0) {
        push({
          id: 'alert-my-move-rejected',
          level: 'info',
          title: 'Movement Request Rejected',
          message: `${rejectedMine} of your roadmap movement request(s) were rejected. Review decision notes.`,
          path: '/roadmap-agent',
        })
      }
    }

    if (isExec || isDelivery) {
      const unscheduledPlans = roadmapPlanItems.filter((p) => !p.planned_start_date || !p.planned_end_date).length
      if (unscheduledPlans > 0) {
        push({
          id: 'alert-unscheduled-plans',
          level: 'warning',
          title: 'Roadmap Dates Missing',
          message: `${unscheduledPlans} roadmap item(s) missing start/end dates.`,
          path: '/roadmap-agent',
        })
      }
      if (role === 'CEO' || isDelivery) {
        const missingOwners = roadmapPlanItems.filter((p) => !(p.accountable_person || '').trim()).length
        if (missingOwners > 0) {
          push({
            id: 'alert-missing-owner',
            level: 'warning',
            title: 'Owner Missing',
            message: `${missingOwners} roadmap item(s) do not have accountable owner.`,
            path: '/roadmap-agent',
          })
        }
      }
    }

    if (role === 'ADMIN') {
      if (!users.length) {
        push({
          id: 'alert-no-users-loaded',
          level: 'warning',
          title: 'User Directory Unavailable',
          message: 'User list is empty or unavailable.',
          path: '/settings',
        })
      } else {
        const hasCEO = users.some((u) => u.role === 'CEO' && u.is_active)
        const hasVP = users.some((u) => u.role === 'VP' && u.is_active)
        const hasBA = users.some((u) => u.role === 'BA' && u.is_active)
        const hasDelivery = users.some((u) => (u.role === 'PM' || u.role === 'PO') && u.is_active)
        const missingRoles: string[] = []
        if (!hasCEO) missingRoles.push('CEO')
        if (!hasVP) missingRoles.push('VP')
        if (!hasBA) missingRoles.push('BA')
        if (!hasDelivery) missingRoles.push('PM/PO')
        if (missingRoles.length) {
          push({
            id: 'alert-missing-roles',
            level: 'critical',
            title: 'Mandatory Roles Missing',
            message: `No active user for: ${missingRoles.join(', ')}.`,
            path: '/settings',
          })
        }
        const inactiveUsers = users.filter((u) => !u.is_active).length
        if (inactiveUsers > 0) {
          push({
            id: 'alert-inactive-users',
            level: 'info',
            title: 'Inactive Users Present',
            message: `${inactiveUsers} user account(s) are inactive.`,
            path: '/settings',
          })
        }
      }
      if (customRoles.filter((r) => r.is_active).length === 0) {
        push({
          id: 'alert-custom-role-none',
          level: 'info',
          title: 'No Custom User Types',
          message: 'Define custom user types if you need finer role splits (for example AI Engineer, Data Scientist).',
          path: '/settings',
        })
      }
    }

    return alerts
  }, [currentUser, activeConfig, governanceConfig, dashboard, roadmapPlanItems, users, customRoles, roadmapMovementRequests])

  const selectedIntakeItem = useMemo(
    () => intakeItems.find((item) => item.id === selectedIntakeId) || null,
    [intakeItems, selectedIntakeId],
  )

  const selectedRoadmapItem = useMemo(
    () => roadmapItems.find((item) => item.id === selectedRoadmapId) || null,
    [roadmapItems, selectedRoadmapId],
  )

  useEffect(() => {
    if (!selectedRoadmapItem) {
      setRoadmapTitle('')
      setRoadmapScope('')
      setRoadmapActivities([])
      setRoadmapPriority('medium')
      setRoadmapProjectContext('client')
      setRoadmapInitiativeType('new_feature')
      setRoadmapDeliveryMode('standard')
      setRoadmapRndHypothesis('')
      setRoadmapRndExperimentGoal('')
      setRoadmapRndSuccessCriteria('')
      setRoadmapRndTimeboxWeeks(null)
      setRoadmapRndDecisionDate('')
      setRoadmapRndNextGate('')
      setRoadmapRndRiskLevel('')
      setRoadmapFeFte('')
      setRoadmapBeFte('')
      setRoadmapAiFte('')
      setRoadmapPmFte('')
      setRoadmapAccountablePerson('')
      setRoadmapPickedUp(false)
      return
    }
    setRoadmapTitle(selectedRoadmapItem.title)
    setRoadmapScope(selectedRoadmapItem.scope)
    setRoadmapActivities(selectedRoadmapItem.activities)
    setRoadmapPriority(selectedRoadmapItem.priority || 'medium')
    setRoadmapProjectContext(selectedRoadmapItem.project_context || 'client')
    setRoadmapInitiativeType(selectedRoadmapItem.initiative_type || 'new_feature')
    setRoadmapDeliveryMode(selectedRoadmapItem.delivery_mode || 'standard')
    setRoadmapRndHypothesis(selectedRoadmapItem.rnd_hypothesis || '')
    setRoadmapRndExperimentGoal(selectedRoadmapItem.rnd_experiment_goal || '')
    setRoadmapRndSuccessCriteria(selectedRoadmapItem.rnd_success_criteria || '')
    setRoadmapRndTimeboxWeeks(selectedRoadmapItem.rnd_timebox_weeks ?? null)
    setRoadmapRndDecisionDate(selectedRoadmapItem.rnd_decision_date || '')
    setRoadmapRndNextGate(selectedRoadmapItem.rnd_next_gate || '')
    setRoadmapRndRiskLevel(selectedRoadmapItem.rnd_risk_level || '')
    setRoadmapFeFte(selectedRoadmapItem.fe_fte == null ? '' : String(selectedRoadmapItem.fe_fte))
    setRoadmapBeFte(selectedRoadmapItem.be_fte == null ? '' : String(selectedRoadmapItem.be_fte))
    setRoadmapAiFte(selectedRoadmapItem.ai_fte == null ? '' : String(selectedRoadmapItem.ai_fte))
    setRoadmapPmFte(selectedRoadmapItem.pm_fte == null ? '' : String(selectedRoadmapItem.pm_fte))
    setRoadmapAccountablePerson(selectedRoadmapItem.accountable_person || '')
    setRoadmapPickedUp(Boolean(selectedRoadmapItem.picked_up))
  }, [selectedRoadmapItem])

  const isCEO = currentUser?.role === 'CEO'
  const isVP = currentUser?.role === 'VP'
  const canManageCommitments = currentUser?.role === 'CEO' || currentUser?.role === 'VP'
  const canViewRndLab = currentUser?.role === 'CEO' || currentUser?.role === 'VP'
  const canViewAuditCenter = currentUser?.role === 'ADMIN' || currentUser?.role === 'CEO' || currentUser?.role === 'VP'
  const canDeleteDocuments =
    currentUser?.role === 'CEO' ||
    currentUser?.role === 'VP' ||
    currentUser?.role === 'BA' ||
    currentUser?.role === 'PM' ||
    currentUser?.role === 'PO'

  async function loadData(activeToken: string) {
    const [meRes, dashboardRes, docsRes, intakeRes, roadmapRes, roadmapPlanRes, redundancyRes, cfgRes, governanceRes, usersRes, movementRes, customRolesRes, rolePoliciesRes] =
      await Promise.allSettled([
        api<CurrentUser>('/auth/me', {}, activeToken),
        api<Dashboard>('/dashboard/summary', {}, activeToken),
        api<DocumentItem[]>('/documents', {}, activeToken),
        api<IntakeItem[]>('/intake/items', {}, activeToken),
        api<RoadmapItem[]>('/roadmap/items', {}, activeToken),
        api<RoadmapPlanItem[]>('/roadmap/plan/items', {}, activeToken),
        api<RoadmapRedundancy[]>('/roadmap/items/redundancy', {}, activeToken),
        api<LLMConfig[]>('/settings/llm', {}, activeToken),
        api<GovernanceConfig>('/settings/governance', {}, activeToken),
        api<UserAdmin[]>('/users', {}, activeToken),
        api<RoadmapMovementRequest[]>('/roadmap/movement/requests', {}, activeToken),
        api<CustomRole[]>('/users/custom-roles', {}, activeToken),
        api<RolePolicy[]>('/users/roles-matrix', {}, activeToken),
      ])

    if (meRes.status !== 'fulfilled') throw meRes.reason
    setCurrentUser(meRes.value)
    setDashboard(dashboardRes.status === 'fulfilled' ? dashboardRes.value : null)
    setDocuments(docsRes.status === 'fulfilled' ? docsRes.value : [])
    setIntakeItems(intakeRes.status === 'fulfilled' ? intakeRes.value : [])
    setRoadmapItems(roadmapRes.status === 'fulfilled' ? roadmapRes.value : [])
    setRoadmapPlanItems(roadmapPlanRes.status === 'fulfilled' ? roadmapPlanRes.value : [])
    setRoadmapRedundancy(redundancyRes.status === 'fulfilled' ? redundancyRes.value : [])
    setRoadmapRedundancyError(
      redundancyRes.status === 'rejected'
        ? redundancyRes.reason instanceof Error
          ? redundancyRes.reason.message
          : 'Redundancy API unavailable'
        : '',
    )
    setLlmConfigs(cfgRes.status === 'fulfilled' ? cfgRes.value : [])
    setGovernanceConfig(governanceRes.status === 'fulfilled' ? governanceRes.value : null)
    setUsers(usersRes.status === 'fulfilled' ? usersRes.value : [])
    setRoadmapMovementRequests(movementRes.status === 'fulfilled' ? movementRes.value : [])
    setCustomRoles(customRolesRes.status === 'fulfilled' ? customRolesRes.value : [])
    setRolePolicies(rolePoliciesRes.status === 'fulfilled' ? rolePoliciesRes.value : [])
  }

  async function fetchDocumentBlob(documentId: number): Promise<{ blob: Blob; contentType: string }> {
    if (!token) throw new Error('Login required')
    const res = await fetch(`${API_BASE}/documents/${documentId}/file`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Preview failed with ${res.status}`)
    }
    const blob = await res.blob()
    const contentType = res.headers.get('content-type') || blob.type || 'application/octet-stream'
    return { blob, contentType }
  }

  async function loadIntakeHistory(itemId: number) {
    if (!token) return
    const data = await api<VersionItem[]>(`/intake/items/${itemId}/history`, {}, token)
    setIntakeHistory(data)
  }

  async function loadIntakeAnalysis(itemId: number) {
    if (!token) return
    const data = await api<IntakeAnalysisPayload>(`/intake/items/${itemId}/analysis`, {}, token)
    setSelectedAnalysis(data)
  }

  async function bulkDeleteRoadmap(idsOverride?: number[]) {
    const ids = idsOverride && idsOverride.length ? idsOverride : selectedRoadmapIds
    if (!token || !ids.length) return
    const ok = await deleteRoadmapItemsByIds(ids)
    if (!ok) return
    setSelectedRoadmapIds([])
    setSelectedRoadmapId(null)
  }

  async function deleteRoadmapItemsByIds(ids: number[]): Promise<boolean> {
    if (!token || !ids.length) return false
    setBusy(true)
    setError('')
    try {
      await api(
        '/roadmap/items/bulk-delete',
        { method: 'POST', body: JSON.stringify({ ids }) },
        token,
      )
      await loadData(token)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function bulkDeleteDocuments(idsOverride?: number[]) {
    const ids = idsOverride && idsOverride.length ? idsOverride : selectedDocumentIds
    if (!token || !ids.length) return
    const ok = await deleteDocumentsByIds(ids)
    if (!ok) return
    setSelectedDocumentIds([])
  }

  async function deleteDocumentsByIds(ids: number[]): Promise<boolean> {
    if (!token || !ids.length) return false
    setBusy(true)
    setError('')
    try {
      await api('/documents/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }, token)
      await loadData(token)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function deleteIntakeItemsByIds(ids: number[]): Promise<boolean> {
    if (!token || !ids.length) return false
    setBusy(true)
    setError('')
    try {
      await api('/intake/items/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }, token)
      await loadData(token)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api<{ access_token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      localStorage.setItem('token', data.access_token)
      setToken(data.access_token)
      await loadData(data.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    if (!token) {
      setError('Session expired. Please sign in again and retry upload.')
      return
    }
    if (uploadFiles.length === 0) {
      setError('Please choose at least one document before uploading.')
      return
    }
    setBusy(true)
    setError('')
    setUploadMessage('')

    try {
      const uploaded: string[] = []
      const duplicates: string[] = []
      const failed: string[] = []

      for (const file of uploadFiles) {
        const form = new FormData()
        form.append('file', file)
        form.append('notes', uploadNotes)
        try {
          await api('/documents/upload', { method: 'POST', body: form }, token)
          uploaded.push(file.name)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed'
          if (msg.toLowerCase().includes('duplicate upload detected')) {
            duplicates.push(file.name)
          } else {
            failed.push(`${file.name}: ${msg}`)
          }
        }
      }

      if (uploaded.length > 0) {
        await loadData(token)
      }

      const summary: string[] = []
      if (uploaded.length) summary.push(`${uploaded.length} uploaded`)
      if (duplicates.length) summary.push(`${duplicates.length} duplicate skipped`)
      if (failed.length) summary.push(`${failed.length} failed`)
      setUploadMessage(summary.join(' • ') || 'No files uploaded.')

      if (failed.length) {
        setError(failed.slice(0, 2).join(' | '))
      }
      setUploadFiles([])
      setUploadPickerKey((k) => k + 1)
      setUploadNotes('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function analyzeDocument(documentId: number, seed?: IntakeSeedMeta) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const item = await api<IntakeItem>(
        `/intake/analyze/${documentId}?force=1`,
        { method: 'POST', body: JSON.stringify(seed || {}) },
        token,
      )
      setSelectedIntakeId(item.id)
      setReviewTitle(item.title)
      setReviewScope(item.scope)
      setReviewActivities(normalizeActivitiesForEditor(item.activities))
      await loadData(token)
      await loadIntakeHistory(item.id)
      await loadIntakeAnalysis(item.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analyze failed')
    } finally {
      setBusy(false)
    }
  }

  async function approveUnderstanding(itemId: number, payload: UnderstandingApprovalInput) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const item = await api<IntakeItem>(
        `/intake/items/${itemId}/approve-understanding`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        token,
      )
      setIntakeItems((items) => items.map((it) => (it.id === item.id ? item : it)))
      setSelectedIntakeId(item.id)
      setReviewTitle(item.title)
      setReviewScope(item.scope)
      setReviewActivities(normalizeActivitiesForEditor(item.activities))
      await loadData(token)
      await loadIntakeHistory(item.id)
      await loadIntakeAnalysis(item.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveUnderstandingDraft(itemId: number, payload: UnderstandingApprovalInput): Promise<IntakeAnalysisPayload> {
    if (!token) throw new Error('Session expired. Please sign in again.')
    setBusy(true)
    setError('')
    try {
      const result = await api<IntakeAnalysisPayload>(
        `/intake/items/${itemId}/understanding-draft`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
        token,
      )
      if (result.intake_item_version_no) {
        setIntakeItems((items) =>
          items.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  status: 'understanding_pending',
                  version_no: result.intake_item_version_no || it.version_no,
                }
              : it,
          ),
        )
      }
      await loadIntakeAnalysis(itemId)
      await loadIntakeHistory(itemId)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save understanding draft')
      throw err
    } finally {
      setBusy(false)
    }
  }

  async function createManualIntake(payload: ManualIntakeIn) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const item = await api<IntakeItem>(
        '/intake/manual-create',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        token,
      )
      setSelectedIntakeId(item.id)
      setReviewTitle(item.title)
      setReviewScope(item.scope)
      setReviewActivities(normalizeActivitiesForEditor(item.activities))
      await loadData(token)
      await loadIntakeHistory(item.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Manual intake creation failed')
    } finally {
      setBusy(false)
    }
  }

  async function promoteRndIntakeToCommitment(item: IntakeItem) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const updated = await api<IntakeItem>(
        `/intake/items/${item.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: item.title,
            scope: item.scope,
            activities: item.activities,
            status: 'approved',
            expected_version_no: item.version_no,
          }),
        },
        token,
      )
      await loadData(token)
      if (updated.roadmap_item_id) setSelectedRoadmapId(updated.roadmap_item_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move to commitment failed')
    } finally {
      setBusy(false)
    }
  }

  async function promoteRndCommitmentToRoadmap(item: RoadmapItem) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const duration = item.rnd_timebox_weeks && item.rnd_timebox_weeks > 0 ? item.rnd_timebox_weeks : 4
      const totalFte = (item.fe_fte || 0) + (item.be_fte || 0) + (item.ai_fte || 0) + (item.pm_fte || 0)
      if (totalFte <= 0) {
        throw new Error(`Cannot move "${item.title}" to roadmap. Set FE/BE/AI/PM FTE in Commitment Shaping first.`)
      }
      await api<RoadmapItem>(
        `/roadmap/items/${item.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: item.title,
            scope: item.scope,
            activities: item.activities,
            priority: item.priority,
            project_context: item.project_context,
            initiative_type: item.initiative_type,
            delivery_mode: item.delivery_mode,
            rnd_hypothesis: item.rnd_hypothesis,
            rnd_experiment_goal: item.rnd_experiment_goal,
            rnd_success_criteria: item.rnd_success_criteria,
            rnd_timebox_weeks: item.rnd_timebox_weeks,
            rnd_decision_date: item.rnd_decision_date,
            rnd_next_gate: item.rnd_next_gate,
            rnd_risk_level: item.rnd_risk_level,
            fe_fte: item.fe_fte,
            be_fte: item.be_fte,
            ai_fte: item.ai_fte,
            pm_fte: item.pm_fte,
            accountable_person: item.accountable_person || '',
            picked_up: true,
            expected_version_no: item.version_no,
          }),
        },
        token,
      )
      await api<{ moved: number }>(
        '/roadmap/plan/move',
        {
          method: 'POST',
          body: JSON.stringify({
            ids: [item.id],
            tentative_duration_weeks: duration,
            pickup_period: 'R&D',
            completion_period: item.rnd_next_gate ? `Gate: ${item.rnd_next_gate}` : '',
          }),
        },
        token,
      )
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move to roadmap failed')
    } finally {
      setBusy(false)
    }
  }

  async function startReview(item: IntakeItem) {
    setSelectedIntakeId(item.id)
    setSelectedAnalysis(null)
    setReviewTitle(item.title)
    setReviewScope(item.scope)
    setReviewActivities(normalizeActivitiesForEditor(item.activities))
    try {
      await loadIntakeHistory(item.id)
      await loadIntakeAnalysis(item.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load intake history')
    }
  }

  async function submitReview(
    status: 'draft' | 'approved' | 'understanding_pending',
    expectedVersionNo?: number,
  ) {
    if (!token || !selectedIntakeId) return
    setBusy(true)
    setError('')

    try {
      const updated = await api<IntakeItem>(
        `/intake/items/${selectedIntakeId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: reviewTitle,
            scope: reviewScope,
            activities: reviewActivities.map((x) => x.trim()).filter(Boolean),
            status,
            expected_version_no: expectedVersionNo ?? selectedIntakeItem?.version_no ?? 0,
          }),
        },
        token,
      )
      await loadData(token)
      await loadIntakeHistory(selectedIntakeId)
      if (updated.roadmap_item_id) {
        setSelectedRoadmapId(updated.roadmap_item_id)
      }
      if (status === 'approved') {
        setSelectedIntakeId(null)
        setSelectedAnalysis(null)
        setIntakeHistory([])
        setReviewTitle('')
        setReviewScope('')
        setReviewActivities([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review update failed')
    } finally {
      setBusy(false)
    }
  }

  function addReviewActivity() {
    setReviewActivities((items) => [...items, '[BE]'])
  }

  function updateReviewActivity(index: number, value: string) {
    setReviewActivities((items) =>
      items.map((it, i) => {
        if (i !== index) return it
        const parsed = parseActivityEntry(it)
        const tags = parsed.tags.length ? parsed.tags : [inferActivityTag(value)]
        return formatActivityEntry(value, tags)
      }),
    )
  }

  function toggleReviewActivityTag(index: number, tag: ActivityTag) {
    setReviewActivities((items) =>
      items.map((it, i) => {
        if (i !== index) return it
        const parsed = parseActivityEntry(it)
        const has = parsed.tags.includes(tag)
        let nextTags = has ? parsed.tags.filter((t) => t !== tag) : [...parsed.tags, tag]
        if (nextTags.length === 0) nextTags = ['BE']
        return formatActivityEntry(parsed.text, nextTags)
      }),
    )
  }

  function removeReviewActivity(index: number) {
    setReviewActivities((items) => items.filter((_, i) => i !== index))
  }

  function requestIntakeSupport(item: IntakeItem) {
    setChatSupportRequest({
      key: `${item.id}:${Date.now()}`,
      intakeItemId: item.id,
      title: item.title || `Intake ${item.id}`,
    })
  }

  async function handleSupportApplied(itemId: number) {
    if (!token) return
    try {
      setChatSupportRequest(null)
      await loadData(token)
      const latest = await api<IntakeItem[]>('/intake/items', {}, token)
      setIntakeItems(latest)
      const resolved = latest.find((x) => x.id === itemId)
      if (resolved) {
        await startReview(resolved)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh intake after support apply')
    }
  }

  async function startRoadmapEdit(item: RoadmapItem) {
    setSelectedRoadmapId(item.id)
  }

  function roadmapUpdatePayload() {
    const parsedFe = Number(roadmapFeFte)
    const parsedBe = Number(roadmapBeFte)
    const parsedAi = Number(roadmapAiFte)
    const parsedPm = Number(roadmapPmFte)
    return {
      title: roadmapTitle,
      scope: roadmapScope,
      activities: roadmapActivities.map((x) => x.trim()).filter(Boolean),
      priority: roadmapPriority,
      project_context: roadmapProjectContext,
      initiative_type: roadmapInitiativeType,
      delivery_mode: roadmapDeliveryMode,
      rnd_hypothesis: roadmapRndHypothesis,
      rnd_experiment_goal: roadmapRndExperimentGoal,
      rnd_success_criteria: roadmapRndSuccessCriteria,
      rnd_timebox_weeks: roadmapRndTimeboxWeeks,
      rnd_decision_date: roadmapRndDecisionDate,
      rnd_next_gate: roadmapRndNextGate,
      rnd_risk_level: roadmapRndRiskLevel,
      fe_fte: Number.isFinite(parsedFe) && parsedFe >= 0 ? parsedFe : null,
      be_fte: Number.isFinite(parsedBe) && parsedBe >= 0 ? parsedBe : null,
      ai_fte: Number.isFinite(parsedAi) && parsedAi >= 0 ? parsedAi : null,
      pm_fte: Number.isFinite(parsedPm) && parsedPm >= 0 ? parsedPm : null,
      accountable_person: roadmapAccountablePerson,
      picked_up: roadmapPickedUp,
      expected_version_no: selectedRoadmapItem?.version_no ?? 0,
    }
  }

  async function saveRoadmapCandidate(itemId: number) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await api<RoadmapItem>(
        `/roadmap/items/${itemId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(roadmapUpdatePayload()),
        },
        token,
      )
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saving commitment shaping failed')
    } finally {
      setBusy(false)
    }
  }

  async function commitSelectedToRoadmap(itemId: number) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await api<RoadmapItem>(
        `/roadmap/items/${itemId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(roadmapUpdatePayload()),
        },
        token,
      )
      const result = await api<{ moved: number }>(
        '/roadmap/plan/move',
        {
          method: 'POST',
          body: JSON.stringify({
            ids: [itemId],
            tentative_duration_weeks: roadmapMove.tentative_duration_weeks
              ? Number(roadmapMove.tentative_duration_weeks)
              : null,
            pickup_period: roadmapMove.pickup_period,
            completion_period: roadmapMove.completion_period,
          }),
        },
        token,
      )
      if (!result.moved) {
        setError('Commit failed. Ensure commitment readiness is set to Ready to commit.')
      }
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit to roadmap failed')
    } finally {
      setBusy(false)
    }
  }

  async function unlockRoadmapCommitment(itemId: number) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const result = await api<{ unlocked: boolean }>(`/roadmap/items/${itemId}/unlock`, { method: 'POST' }, token)
      if (!result.unlocked) {
        setError('This commitment is already unlocked.')
      }
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed')
    } finally {
      setBusy(false)
    }
  }

  async function moveRoadmapCandidateToRnd(itemId: number) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await api<RoadmapItem>(`/roadmap/items/${itemId}/move-to-rnd`, { method: 'POST' }, token)
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move to R&D Lab failed')
    } finally {
      setBusy(false)
    }
  }

  async function applyRedundancyDecision(
    itemId: number,
    action: 'merge' | 'keep_both' | 'intentional_overlap',
    otherItemId: number,
  ) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await api(
        `/roadmap/items/${itemId}/redundancy-decision`,
        { method: 'POST', body: JSON.stringify({ action, other_item_id: otherItemId }) },
        token,
      )
      if (action === 'merge' && selectedRoadmapId === otherItemId) {
        setSelectedRoadmapId(itemId)
      }
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Redundancy action failed')
    } finally {
      setBusy(false)
    }
  }

  async function updateRoadmapPlanItem(
    itemId: number,
    payload: {
      planned_start_date: string
      planned_end_date: string
      resource_count: number | null
      effort_person_weeks: number | null
      planning_status: string
      confidence: string
      dependency_ids: number[]
      change_reason?: string
      expected_version_no: number
    },
  ) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await api<RoadmapPlanItem>(
        `/roadmap/plan/items/${itemId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
        token,
      )
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Roadmap planning update failed')
    } finally {
      setBusy(false)
    }
  }

  async function setRoadmapGovernanceLock(payload: { roadmap_locked: boolean; note: string }) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await api<{
        roadmap_locked: boolean
        roadmap_locked_at: string | null
        roadmap_locked_by: number | null
        roadmap_lock_note: string
      }>(
        '/roadmap/governance-lock',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        token,
      )
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Roadmap governance lock update failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitRoadmapMovementRequest(
    planItemId: number,
    payload: {
      proposed_start_date: string
      proposed_end_date: string
      reason: string
      blocker: string
    },
  ) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await api<RoadmapMovementRequest>(
        `/roadmap/plan/items/${planItemId}/movement-request`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        token,
      )
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Roadmap movement request failed')
    } finally {
      setBusy(false)
    }
  }

  async function decideRoadmapMovementRequest(
    requestId: number,
    payload: {
      decision: 'approved' | 'rejected'
      decision_reason: string
    },
  ) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await api<RoadmapMovementRequest>(
        `/roadmap/movement/requests/${requestId}/decision`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        token,
      )
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Roadmap movement decision failed')
    } finally {
      setBusy(false)
    }
  }

  async function ceoMoveRoadmapPlanItem(
    planItemId: number,
    payload: {
      proposed_start_date: string
      proposed_end_date: string
      reason: string
      blocker: string
    },
  ) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await api<RoadmapMovementRequest>(
        `/roadmap/plan/items/${planItemId}/ceo-move`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        token,
      )
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CEO roadmap movement failed')
    } finally {
      setBusy(false)
    }
  }

  async function downloadRoadmapPlanExcel(filters: {
    year: number
    priority: string
    context: string
    mode: string
    period: string
  }) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const params = new URLSearchParams({
        year: String(filters.year),
        priority: filters.priority,
        context: filters.context,
        mode: filters.mode,
        period: filters.period,
      })
      const res = await fetch(`${API_BASE}/roadmap/plan/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || `Export failed with ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `roadmap_gantt_${filters.year}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gantt export failed')
    } finally {
      setBusy(false)
    }
  }

  async function downloadProjectDocument(payload: {
    version?: string
    prepared_by?: string
    approved_by?: string
    level?: 'l1' | 'l2'
  }) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (payload.version?.trim()) params.set('version', payload.version.trim())
      if (payload.prepared_by?.trim()) params.set('prepared_by', payload.prepared_by.trim())
      if (payload.approved_by?.trim()) params.set('approved_by', payload.approved_by.trim())
      if (payload.level) params.set('level', payload.level)
      const query = params.toString()
      const res = await fetch(`${API_BASE}/settings/project-document/download${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || `Document download failed with ${res.status}`)
      }
      const blob = await res.blob()
      const contentDisposition = res.headers.get('content-disposition') || ''
      const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/)
      const filename = match?.[1] || 'resource_commitment_capacity_governance.pdf'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Project document download failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveLLMConfig(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setBusy(true)
    setError('')

    try {
      await api<LLMConfig>(
        '/settings/llm/active',
        {
          method: 'POST',
          body: JSON.stringify(providerForm),
        },
        token,
      )
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'LLM settings update failed')
    } finally {
      setBusy(false)
    }
  }

  async function testLLMConfig() {
    if (!token) return
    setBusy(true)
    setError('')
    setLlmTestResult(null)
    try {
      const result = await api<LLMTestResult>(
        '/settings/llm/test',
        {
          method: 'POST',
          body: JSON.stringify(providerForm),
        },
        token,
      )
      setLlmTestResult(result)
      if (!result.ok) {
        setError(`Provider test failed: ${result.message}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'LLM test failed')
    } finally {
      setBusy(false)
    }
  }

  function toNumberOrZero(value: string): number {
    const n = Number(value)
    if (!Number.isFinite(n)) return 0
    return n
  }

  async function saveGovernanceTeamConfig(payload: {
    team_fe: string
    team_be: string
    team_ai: string
    team_pm: string
    efficiency_fe: string
    efficiency_be: string
    efficiency_ai: string
    efficiency_pm: string
  }) {
    if (!token) return
    const teamFe = Math.max(0, Math.round(toNumberOrZero(payload.team_fe)))
    const teamBe = Math.max(0, Math.round(toNumberOrZero(payload.team_be)))
    const teamAi = Math.max(0, Math.round(toNumberOrZero(payload.team_ai)))
    const teamPm = Math.max(0, Math.round(toNumberOrZero(payload.team_pm)))
    const minTeam = Math.min(teamFe, teamBe, teamAi, teamPm)
    if (minTeam < TEAM_SIZE_MIN) {
      setError(`Team size must be at least ${TEAM_SIZE_MIN} for FE, BE, AI, and PM.`)
      return
    }
    const effFe = Math.max(0, toNumberOrZero(payload.efficiency_fe))
    const effBe = Math.max(0, toNumberOrZero(payload.efficiency_be))
    const effAi = Math.max(0, toNumberOrZero(payload.efficiency_ai))
    const effPm = Math.max(0, toNumberOrZero(payload.efficiency_pm))
    const minEff = Math.min(effFe, effBe, effAi, effPm)
    const maxEff = Math.max(effFe, effBe, effAi, effPm)
    if (minEff < EFFICIENCY_MIN || maxEff > EFFICIENCY_MAX) {
      setError(`Efficiency must be between ${EFFICIENCY_MIN.toFixed(2)} and ${EFFICIENCY_MAX.toFixed(2)}.`)
      return
    }
    const proceed = window.confirm(
      `CEO acknowledgement required:\n- Team size must be at least ${TEAM_SIZE_MIN} for FE/BE/AI/PM\n- Efficiency must be between ${EFFICIENCY_MIN.toFixed(2)} and ${EFFICIENCY_MAX.toFixed(2)}\n- Save will lock Team Capacity for 3 hours\nContinue?`,
    )
    if (!proceed) return
    setBusy(true)
    setError('')
    try {
      const cfg = await api<GovernanceConfig>(
        '/settings/governance/team-config',
        {
          method: 'POST',
          body: JSON.stringify({
            team_fe: teamFe,
            team_be: teamBe,
            team_ai: teamAi,
            team_pm: teamPm,
            efficiency_fe: effFe,
            efficiency_be: effBe,
            efficiency_ai: effAi,
            efficiency_pm: effPm,
          }),
        },
        token,
      )
      setGovernanceConfig(cfg)
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Governance team settings update failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveGovernanceQuotas(payload: { quota_client: string; quota_internal: string }) {
    if (!token) return
    const quotaClient = Math.max(0, toNumberOrZero(payload.quota_client))
    const quotaInternal = Math.max(0, toNumberOrZero(payload.quota_internal))
    if (quotaClient + quotaInternal > 1.0 + 1e-9) {
      setError('Invalid quota allocation: Client + Internal must be less than or equal to 1.00.')
      return
    }
    const proceed = window.confirm(
      'VP/CEO acknowledgement required:\n- Total quota must be <= 1.00\n- Save will lock Portfolio Quotas for 3 hours\nContinue?',
    )
    if (!proceed) return
    setBusy(true)
    setError('')
    try {
      const cfg = await api<GovernanceConfig>(
        '/settings/governance/portfolio-quotas',
        {
          method: 'POST',
          body: JSON.stringify({
            quota_client: quotaClient,
            quota_internal: quotaInternal,
          }),
        },
        token,
      )
      setGovernanceConfig(cfg)
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Governance quota update failed')
    } finally {
      setBusy(false)
    }
  }

  async function confirmGovernanceEfficiency() {
    if (!token) return
    const proceed = window.confirm(
      'Monthly efficiency confirmation:\n- You are confirming FE/BE/AI/PM efficiency values for current governance period.\nContinue?',
    )
    if (!proceed) return
    setBusy(true)
    setError('')
    try {
      const cfg = await api<GovernanceConfig>(
        '/settings/governance/efficiency-confirmation',
        {
          method: 'POST',
        },
        token,
      )
      setGovernanceConfig(cfg)
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Efficiency confirmation failed')
    } finally {
      setBusy(false)
    }
  }

  async function createPlatformUser(payload: {
    full_name: string
    email: string
    password: string
    role: SystemRole
    custom_role_id?: number | null
  }) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await api<UserAdmin>(
        '/users',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        token,
      )
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'User creation failed')
    } finally {
      setBusy(false)
    }
  }

  async function updatePlatformUser(
    userId: number,
    payload: {
      full_name?: string
      role?: SystemRole
      custom_role_id?: number | null
      password?: string
      is_active?: boolean
    },
  ) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await api<UserAdmin>(
        `/users/id/${userId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
        token,
      )
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'User update failed')
    } finally {
      setBusy(false)
    }
  }

  function openPasswordModal(force = false) {
    setPasswordSuccess('')
    setPasswordCurrent('')
    setPasswordNext('')
    setPasswordConfirm('')
    setPasswordModalForced(force)
    setPasswordModalOpen(true)
  }

  function closePasswordModal() {
    if (passwordModalForced) return
    setPasswordModalOpen(false)
    setPasswordSuccess('')
    setPasswordCurrent('')
    setPasswordNext('')
    setPasswordConfirm('')
  }

  async function changeMyPassword(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    if (!passwordCurrent || !passwordNext || !passwordConfirm) {
      setError('Current password and new password fields are required.')
      return
    }
    if (passwordNext !== passwordConfirm) {
      setError('New password and confirm password do not match.')
      return
    }
    if (!isStrongPassword(passwordNext)) {
      setError(
        `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} chars with uppercase, lowercase, number, and special character (no spaces).`,
      )
      return
    }
    setBusy(true)
    setError('')
    setPasswordSuccess('')
    try {
      await api<{ ok: boolean; message: string }>(
        '/auth/change-password',
        {
          method: 'POST',
          body: JSON.stringify({
            current_password: passwordCurrent,
            new_password: passwordNext,
          }),
        },
        token,
      )
      setPasswordSuccess('Password changed successfully.')
      setPasswordModalOpen(false)
      setPasswordModalForced(false)
      setPasswordCurrent('')
      setPasswordNext('')
      setPasswordConfirm('')
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed')
    } finally {
      setBusy(false)
    }
  }

  async function createCustomRole(payload: {
    name: string
    base_role: SystemRole
    scope: string
    responsibilities: string[]
    can_create_users: boolean
    can_configure_team_capacity: boolean
    can_allocate_portfolio_quotas: boolean
    can_submit_commitment: boolean
    can_edit_roadmap: boolean
    can_manage_settings: boolean
    is_active: boolean
  }) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await api<CustomRole>(
        '/users/custom-roles',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        token,
      )
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Custom role creation failed')
    } finally {
      setBusy(false)
    }
  }

  async function updateCustomRole(
    customRoleId: number,
    payload: {
      name?: string
      base_role?: SystemRole
      scope?: string
      responsibilities?: string[]
      can_create_users?: boolean
      can_configure_team_capacity?: boolean
      can_allocate_portfolio_quotas?: boolean
      can_submit_commitment?: boolean
      can_edit_roadmap?: boolean
      can_manage_settings?: boolean
      is_active?: boolean
    },
  ) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await api<CustomRole>(
        `/users/custom-roles/${customRoleId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
        token,
      )
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Custom role update failed')
    } finally {
      setBusy(false)
    }
  }

  async function validateCapacity(payload: {
    project_context: string
    tentative_duration_weeks: number
    planned_start_date?: string
    planned_end_date?: string
    fe_fte: number
    be_fte: number
    ai_fte: number
    pm_fte: number
    exclude_bucket_item_id?: number
  }) {
    if (!token) throw new Error('Login required')
    return api<CapacityValidationResult>(
      '/roadmap/capacity/validate',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    )
  }

  function logout() {
    localStorage.removeItem('token')
    setToken(null)
    setCurrentUser(null)
    setDashboard(null)
    setDocuments([])
    setIntakeItems([])
    setRoadmapItems([])
    setRoadmapPlanItems([])
    setLlmConfigs([])
    setGovernanceConfig(null)
    setUsers([])
    setRoadmapMovementRequests([])
    setCustomRoles([])
    setRolePolicies([])
    setIntakeHistory([])
    setSelectedAnalysis(null)
    setSelectedRoadmapIds([])
    setSelectedDocumentIds([])
    setLlmTestResult(null)
    setPasswordModalOpen(false)
    setPasswordModalForced(false)
    setPasswordCurrent('')
    setPasswordNext('')
    setPasswordConfirm('')
    setPasswordSuccess('')
  }

  useEffect(() => {
    if (!token) return
    loadData(token).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    })
  }, [token])

  useEffect(() => {
    if (currentUser?.force_password_change && !passwordModalOpen) {
      openPasswordModal(true)
    }
  }, [currentUser, passwordModalOpen])

  useEffect(() => {
    const options = providerModelMap[providerForm.provider] ?? []
    if (!useCustomModel && options.length > 0 && !options.includes(providerForm.model)) {
      setProviderForm((s) => ({ ...s, model: options[0] }))
    }
  }, [providerForm.provider, providerForm.model, useCustomModel])

  useEffect(() => {
    if (!alertsOpen) return
    function onMouseDown(event: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setAlertsOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [alertsOpen])

  if (!isLoggedIn) {
    return (
      <div className="auth-shell">
        <div className="auth-main">
          <div className="auth-card">
            <img className="brand-logo auth-brand-logo" src="/yavar-logo.svg" alt="Yavar" />
            <h1>Sign in to Z- Roadmap Workspace</h1>
            <p className="muted">Upload BRD/PPT/RFP/Excel, review extracted activities, then shape commitments.</p>
            <div className="preset-row">
              {rolePresets.map((preset) => (
                <button key={preset.label} type="button" className="ghost-btn" onClick={() => setEmail(preset.email)}>
                  {preset.label}
                </button>
              ))}
            </div>
            <form className="stack" onSubmit={handleLogin}>
              <label>
                Email
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ceo@local.test" />
              </label>
              <label>
                Password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="pass1234" />
              </label>
              <button disabled={busy} className="primary-btn" type="submit">
                {busy ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
            {error && <p className="error-text">{error}</p>}
          </div>
        </div>
        <footer className="auth-footer">Copyright © 2026 Yavar techworks Pte Ltd., All rights reserved.</footer>
      </div>
    )
  }

  return (
    <div className="workspace">
      <header className="top-nav">
        <div className="top-left">
          <img className="brand-logo top-brand-logo" src="/yavar-logo.svg" alt="Yavar" />
          <span className="org-name">Z- Roadmap</span>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'top-link active' : 'top-link')}>
            Dashboard
          </NavLink>
          <NavLink to="/intake" className={({ isActive }) => (isActive ? 'top-link active' : 'top-link')}>
            Intake
          </NavLink>
          <NavLink to="/roadmap" className={({ isActive }) => (isActive ? 'top-link active' : 'top-link')}>
            Commitments
          </NavLink>
          <NavLink to="/roadmap-agent" className={({ isActive }) => (isActive ? 'top-link active' : 'top-link')}>
            Roadmap
          </NavLink>
          {canViewRndLab && (
            <NavLink to="/rnd-lab" className={({ isActive }) => (isActive ? 'top-link active' : 'top-link')}>
              R&D Lab
            </NavLink>
          )}
          <NavLink to="/detailed-roadmap" className={({ isActive }) => (isActive ? 'top-link active' : 'top-link')}>
            Analytics
          </NavLink>
          {canViewAuditCenter && (
            <NavLink to="/audit" className={({ isActive }) => (isActive ? 'top-link active' : 'top-link')}>
              Audit Center
            </NavLink>
          )}
        </div>
        <div className="top-right">
          {currentUser && (
            <div className="welcome-banner" title={`${currentUser.full_name} (${currentUser.email})`}>
              {welcomeBanner}
            </div>
          )}
          <div className="alerts-wrap" ref={alertsRef}>
            <button
              type="button"
              className={alertsOpen ? 'icon-link active alerts-toggle' : 'icon-link alerts-toggle'}
              title="Alerts"
              aria-label="Alerts"
              onClick={() => setAlertsOpen((v) => !v)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {workflowAlerts.length > 0 && (
                <span className="alert-badge">{workflowAlerts.length > 99 ? '99+' : workflowAlerts.length}</span>
              )}
            </button>
            {alertsOpen && (
              <section className="alerts-panel">
                <div className="alerts-head">
                  <strong>Workflow Alerts</strong>
                  <span className="muted">{workflowAlerts.length}</span>
                </div>
                {workflowAlerts.length === 0 ? (
                  <p className="muted alerts-empty">No active alerts.</p>
                ) : (
                  <ul className="alerts-list">
                    {workflowAlerts.map((alert) => (
                      <li key={alert.id} className={`alerts-item ${alert.level}`}>
                        <div className="alerts-item-head">
                          <strong>{alert.title}</strong>
                          <NavLink to={alert.path} onClick={() => setAlertsOpen(false)} className="alerts-open-link">
                            Open
                          </NavLink>
                        </div>
                        <p>{alert.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
          <button
            type="button"
            className="icon-link"
            title="Change Password"
            aria-label="Change Password"
            onClick={() => openPasswordModal(false)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 10V7a5 5 0 1 1 10 0v3" />
              <rect x="4" y="10" width="16" height="11" rx="2" ry="2" />
              <circle cx="12" cy="15.5" r="1.5" />
            </svg>
          </button>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'icon-link active' : 'icon-link')} title="Settings">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.29 1.52 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </NavLink>
          <button onClick={logout} className="logout-min" type="button" title="Logout">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {busy && (
        <div className="processing-indicator" role="status" aria-live="polite">
          <span className="processing-dot" />
          <span>Processing</span>
        </div>
      )}
      {passwordModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Change Password">
          <div className="modal-card">
            <h3>{passwordModalForced ? 'Password Update Required' : 'Change Password'}</h3>
            <p className="muted">
              Password must be {PASSWORD_MIN_LENGTH}-{PASSWORD_MAX_LENGTH} characters and include uppercase, lowercase, number, and special character.
            </p>
            {passwordModalForced && (
              <p className="error-text">Your account is marked for password update. Please change password to continue.</p>
            )}
            {passwordSuccess && <p className="success-text">{passwordSuccess}</p>}
            <form className="stack" onSubmit={changeMyPassword}>
              <label>
                Current Password
                <input
                  type="password"
                  value={passwordCurrent}
                  disabled={busy}
                  onChange={(e) => setPasswordCurrent(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label>
                New Password
                <input
                  type="password"
                  value={passwordNext}
                  disabled={busy}
                  onChange={(e) => setPasswordNext(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Confirm New Password
                <input
                  type="password"
                  value={passwordConfirm}
                  disabled={busy}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <div className="row-actions">
                {!passwordModalForced && (
                  <button type="button" className="ghost-btn" disabled={busy} onClick={closePasswordModal}>
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={
                    busy ||
                    !passwordCurrent ||
                    !passwordNext ||
                    !passwordConfirm ||
                    passwordNext !== passwordConfirm ||
                    !isStrongPassword(passwordNext)
                  }
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Routes>
        <Route
          path="/dashboard"
          element={
            <DashboardPage
              dashboard={dashboard}
              intakeItems={intakeItems}
              roadmapItems={roadmapItems}
              roadmapPlanItems={roadmapPlanItems}
              governanceConfig={governanceConfig}
              movementRequests={roadmapMovementRequests}
            />
          }
        />
        <Route
          path="/intake"
          element={
            <IntakePage
              canEnterRndFromIntake={Boolean(isVP)}
              token={token}
              documents={documents}
              roadmapItems={roadmapItems}
              intakeByDocument={intakeByDocument}
              uploadFiles={uploadFiles}
              setUploadFiles={setUploadFiles}
              uploadPickerKey={uploadPickerKey}
              uploadNotes={uploadNotes}
              setUploadNotes={setUploadNotes}
              handleUpload={handleUpload}
              uploadMessage={uploadMessage}
              analyzeDocument={analyzeDocument}
              startReview={startReview}
              selectedIntakeItem={selectedIntakeItem}
              reviewTitle={reviewTitle}
              setReviewTitle={setReviewTitle}
              reviewScope={reviewScope}
              setReviewScope={setReviewScope}
              reviewActivities={reviewActivities}
              setReviewActivities={setReviewActivities}
              updateReviewActivity={updateReviewActivity}
              toggleReviewActivityTag={toggleReviewActivityTag}
              addReviewActivity={addReviewActivity}
              removeReviewActivity={removeReviewActivity}
              submitReview={submitReview}
              intakeHistory={intakeHistory}
              selectedAnalysis={selectedAnalysis}
              isCEO={isCEO}
              canDeleteDocuments={Boolean(canDeleteDocuments)}
              approveUnderstanding={approveUnderstanding}
              saveUnderstandingDraft={saveUnderstandingDraft}
              createManualIntake={createManualIntake}
              selectedDocumentIds={selectedDocumentIds}
              setSelectedDocumentIds={setSelectedDocumentIds}
              bulkDeleteDocuments={bulkDeleteDocuments}
              busy={busy}
              fetchDocumentBlob={fetchDocumentBlob}
              setErrorMessage={setError}
              requestIntakeSupport={requestIntakeSupport}
            />
          }
        />
        <Route
          path="/roadmap"
          element={
            <RoadmapPage
              roadmapItems={roadmapItems}
              documents={documents}
              selectedRoadmapItem={selectedRoadmapItem}
              startRoadmapEdit={startRoadmapEdit}
              roadmapTitle={roadmapTitle}
              setRoadmapTitle={setRoadmapTitle}
              roadmapScope={roadmapScope}
              setRoadmapScope={setRoadmapScope}
              roadmapActivities={roadmapActivities}
              setRoadmapActivities={setRoadmapActivities}
              roadmapProjectContext={roadmapProjectContext}
              setRoadmapProjectContext={setRoadmapProjectContext}
              roadmapInitiativeType={roadmapInitiativeType}
              setRoadmapInitiativeType={setRoadmapInitiativeType}
              roadmapDeliveryMode={roadmapDeliveryMode}
              setRoadmapDeliveryMode={setRoadmapDeliveryMode}
              roadmapRndHypothesis={roadmapRndHypothesis}
              roadmapRndExperimentGoal={roadmapRndExperimentGoal}
              roadmapRndSuccessCriteria={roadmapRndSuccessCriteria}
              roadmapRndTimeboxWeeks={roadmapRndTimeboxWeeks}
              roadmapRndDecisionDate={roadmapRndDecisionDate}
              roadmapRndNextGate={roadmapRndNextGate}
              roadmapRndRiskLevel={roadmapRndRiskLevel}
              roadmapFeFte={roadmapFeFte}
              setRoadmapFeFte={setRoadmapFeFte}
              roadmapBeFte={roadmapBeFte}
              setRoadmapBeFte={setRoadmapBeFte}
              roadmapAiFte={roadmapAiFte}
              setRoadmapAiFte={setRoadmapAiFte}
              roadmapPmFte={roadmapPmFte}
              setRoadmapPmFte={setRoadmapPmFte}
              roadmapAccountablePerson={roadmapAccountablePerson}
              setRoadmapAccountablePerson={setRoadmapAccountablePerson}
              setRoadmapPickedUp={setRoadmapPickedUp}
              isCEO={isCEO}
              isVP={isVP}
              canManageCommitments={canManageCommitments}
              setSelectedRoadmapIds={setSelectedRoadmapIds}
              bulkDeleteRoadmap={bulkDeleteRoadmap}
              roadmapMove={roadmapMove}
              setRoadmapMove={setRoadmapMove}
              roadmapPlanItems={roadmapPlanItems}
              roadmapRedundancy={roadmapRedundancy}
              roadmapRedundancyError={roadmapRedundancyError}
              validateCapacity={validateCapacity}
              saveRoadmapCandidate={saveRoadmapCandidate}
              commitSelectedToRoadmap={commitSelectedToRoadmap}
              unlockRoadmapCommitment={unlockRoadmapCommitment}
              moveRoadmapCandidateToRnd={moveRoadmapCandidateToRnd}
              applyRedundancyDecision={applyRedundancyDecision}
              busy={busy}
            />
          }
        />
        <Route
          path="/roadmap-agent"
          element={
            <RoadmapAgentPage
              roadmapPlanItems={roadmapPlanItems}
              movementRequests={roadmapMovementRequests}
              governanceConfig={governanceConfig}
              currentUserRole={currentUser?.role || 'PM'}
              updateRoadmapPlanItem={updateRoadmapPlanItem}
              setRoadmapGovernanceLock={setRoadmapGovernanceLock}
              submitRoadmapMovementRequest={submitRoadmapMovementRequest}
              decideRoadmapMovementRequest={decideRoadmapMovementRequest}
              ceoMoveRoadmapPlanItem={ceoMoveRoadmapPlanItem}
              validateCapacity={validateCapacity}
              downloadRoadmapPlanExcel={downloadRoadmapPlanExcel}
              busy={busy}
            />
          }
        />
        <Route
          path="/rnd-lab"
          element={
            <RndLabPage
              currentUserRole={currentUser?.role || 'PM'}
              documents={documents}
              intakeByDocument={intakeByDocument}
              intakeItems={intakeItems}
              roadmapItems={roadmapItems}
              roadmapPlanItems={roadmapPlanItems}
              analyzeDocument={analyzeDocument}
              createManualIntake={createManualIntake}
              promoteRndIntakeToCommitment={promoteRndIntakeToCommitment}
              promoteRndCommitmentToRoadmap={promoteRndCommitmentToRoadmap}
              unlockRoadmapCommitment={unlockRoadmapCommitment}
              deleteRoadmapItemsByIds={deleteRoadmapItemsByIds}
              deleteDocumentsByIds={deleteDocumentsByIds}
              deleteIntakeItemsByIds={deleteIntakeItemsByIds}
              busy={busy}
            />
          }
        />
        <Route
          path="/detailed-roadmap"
          element={<DetailedRoadmap roadmapPlanItems={roadmapPlanItems} governanceConfig={governanceConfig} busy={busy} />}
        />
        <Route
          path="/audit"
          element={
            <AuditCenterPage
              token={token}
              canView={Boolean(canViewAuditCenter)}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <SettingsPage
              activeConfig={activeConfig || null}
              llmConfigs={llmConfigs}
              governanceConfig={governanceConfig}
              users={users}
              customRoles={customRoles}
              rolePolicies={rolePolicies}
              currentUserRole={currentUser?.role || 'PM'}
              providerForm={providerForm}
              setProviderForm={setProviderForm}
              useCustomModel={useCustomModel}
              setUseCustomModel={setUseCustomModel}
              saveLLMConfig={saveLLMConfig}
              testLLMConfig={testLLMConfig}
              saveGovernanceTeamConfig={saveGovernanceTeamConfig}
              saveGovernanceQuotas={saveGovernanceQuotas}
              confirmGovernanceEfficiency={confirmGovernanceEfficiency}
              createPlatformUser={createPlatformUser}
              createCustomRole={createCustomRole}
              updatePlatformUser={updatePlatformUser}
              updateCustomRole={updateCustomRole}
              downloadProjectDocument={downloadProjectDocument}
              llmTestResult={llmTestResult}
              busy={busy}
            />
          }
        />
        <Route path="*" element={<Navigate to="/intake" replace />} />
      </Routes>

      {/* Global Chat Widget */}
      <ChatWidget
        token={token}
        busy={busy}
        onChat={async (question) => {
          const data = await api<ChatResponse>(
            '/chat',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ question }),
            },
            token ?? undefined
          )
          return data
        }}
        supportRequest={chatSupportRequest}
        onSupportDismiss={() => setChatSupportRequest(null)}
        onIntakeSupport={async (intakeItemId, question) => {
          const data = await api<ChatResponse>(
            '/chat/intake-support',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ intake_item_id: intakeItemId, question: question || '' }),
            },
            token ?? undefined,
          )
          return data
        }}
        onSupportApplied={handleSupportApplied}
      />

      {/* Footer with copyright */}
      <footer className="app-footer">
        <p>Copyright © 2026 Yavar techworks Pte Ltd., All rights reserved.</p>
      </footer>
    </div>
  )
}

type DashboardProps = {
  dashboard: Dashboard | null
  intakeItems: IntakeItem[]
  roadmapItems: RoadmapItem[]
  roadmapPlanItems: RoadmapPlanItem[]
  governanceConfig: GovernanceConfig | null
  movementRequests: RoadmapMovementRequest[]
}

function DashboardPage({ dashboard, intakeItems, roadmapItems, roadmapPlanItems, governanceConfig, movementRequests }: DashboardProps) {
  const [cadence, setCadence] = useState<'month' | 'quarter'>('month')
  const [windowSize, setWindowSize] = useState(6)
  const today = useMemo(() => new Date(), [])
  const chartGridStroke = '#e8edf5'
  const chartColorPrimary = '#0f766e'
  const chartColorSecondary = '#f59e0b'
  const chartColorMuted = '#475569'
  const chartColorAccent = '#0ea5e9'
  const chartColorSlate = '#94a3b8'
  const chartColorSuccess = '#16a34a'
  const chartColorWarn = '#f59e0b'
  const chartColorError = '#dc2626'

  useEffect(() => {
    if (cadence === 'month' && ![6, 12].includes(windowSize)) setWindowSize(6)
    if (cadence === 'quarter' && ![4, 8].includes(windowSize)) setWindowSize(4)
  }, [cadence, windowSize])

  const trendBuckets = useMemo(() => {
    const now = new Date()
    const buckets: Array<{
      key: string
      label: string
      startMs: number
      endMs: number
    }> = []
    for (let i = windowSize - 1; i >= 0; i--) {
      let start: Date
      if (cadence === 'month') {
        start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      } else {
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
        start = new Date(now.getFullYear(), quarterStartMonth - i * 3, 1)
      }
      const end =
        cadence === 'month'
          ? new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999)
          : new Date(start.getFullYear(), start.getMonth() + 3, 0, 23, 59, 59, 999)
      const label =
        cadence === 'month'
          ? start.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
          : `Q${Math.floor(start.getMonth() / 3) + 1} ${String(start.getFullYear()).slice(-2)}`
      const key =
        cadence === 'month'
          ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
          : `${start.getFullYear()}-Q${Math.floor(start.getMonth() / 3) + 1}`
      buckets.push({ key, label, startMs: start.getTime(), endMs: end.getTime() })
    }
    return buckets
  }, [cadence, windowSize])

  const trendSeries = useMemo(() => {
    const rows = trendBuckets.map((bucket) => ({
      period: bucket.label,
      period_key: bucket.key,
      client: 0,
      internal: 0,
      total: 0,
      movement_total: 0,
      movement_pending: 0,
      movement_approved: 0,
      movement_rejected: 0,
      rnd_intake: 0,
      rnd_commitments: 0,
      rnd_roadmap: 0,
      ai_intake: 0,
      ai_commitments: 0,
      ai_roadmap: 0,
    }))

    const bucketIndex = (raw: string | null | undefined): number => {
      const date = parseIsoDate(raw || '')
      if (!date) return -1
      const ts = date.getTime()
      return trendBuckets.findIndex((bucket) => ts >= bucket.startMs && ts <= bucket.endMs)
    }

    for (const item of roadmapPlanItems) {
      const idx = bucketIndex(item.planned_start_date || item.entered_roadmap_at || item.created_at)
      if (idx < 0) continue
      const row = rows[idx]
      if (item.project_context === 'client') row.client += 1
      else row.internal += 1
      row.total += 1
      if ((item.delivery_mode || '').toLowerCase() === 'rnd') row.rnd_roadmap += 1
      if ((item.ai_fte || 0) > 0 || hasAiTagInActivities(item.activities || [])) row.ai_roadmap += 1
    }

    for (const item of roadmapItems) {
      const idx = bucketIndex(item.created_at)
      if (idx < 0) continue
      const row = rows[idx]
      if ((item.delivery_mode || '').toLowerCase() === 'rnd') row.rnd_commitments += 1
      if ((item.ai_fte || 0) > 0 || hasAiTagInActivities(item.activities || [])) row.ai_commitments += 1
    }

    for (const item of intakeItems) {
      const idx = bucketIndex(item.created_at)
      if (idx < 0) continue
      const row = rows[idx]
      if ((item.delivery_mode || '').toLowerCase() === 'rnd') row.rnd_intake += 1
      if (hasAiTagInActivities(item.activities || [])) row.ai_intake += 1
    }

    for (const req of movementRequests) {
      const idx = bucketIndex(req.created_at || req.requested_at)
      if (idx < 0) continue
      const row = rows[idx]
      row.movement_total += 1
      const status = (req.status || '').toLowerCase()
      if (status === 'approved') row.movement_approved += 1
      else if (status === 'rejected') row.movement_rejected += 1
      else row.movement_pending += 1
    }

    return rows
  }, [trendBuckets, roadmapPlanItems, roadmapItems, intakeItems, movementRequests])

  const rndStageChart = useMemo(
    () =>
      trendSeries.map((row) => ({
        period: row.period,
        Intake: row.rnd_intake,
        Commitments: row.rnd_commitments,
        Roadmap: row.rnd_roadmap,
      })),
    [trendSeries],
  )

  const aiStageChart = useMemo(
    () =>
      trendSeries.map((row) => ({
        period: row.period,
        Intake: row.ai_intake,
        Commitments: row.ai_commitments,
        Roadmap: row.ai_roadmap,
      })),
    [trendSeries],
  )

  const movementChart = useMemo(
    () =>
      trendSeries.map((row) => ({
        period: row.period,
        Approved: row.movement_approved,
        Pending: row.movement_pending,
        Rejected: row.movement_rejected,
      })),
    [trendSeries],
  )

  const rndWindowTotal = useMemo(
    () => rndStageChart.reduce((acc, row) => acc + row.Intake + row.Commitments + row.Roadmap, 0),
    [rndStageChart],
  )
  const aiWindowTotal = useMemo(
    () => aiStageChart.reduce((acc, row) => acc + row.Intake + row.Commitments + row.Roadmap, 0),
    [aiStageChart],
  )

  const capacitySnapshot = useMemo(() => {
    const usage = {
      client: emptyRoleTotals(),
      internal: emptyRoleTotals(),
    }
    let unscheduled = 0
    let activeNow = 0
    for (const item of roadmapPlanItems) {
      const start = parseIsoDate(item.planned_start_date)
      const end = parseIsoDate(item.planned_end_date)
      if (!start || !end || end < start) {
        unscheduled += 1
        continue
      }
      if (!isDateInRange(today, start, end)) continue
      activeNow += 1
      const portfolio = item.project_context === 'client' ? 'client' : 'internal'
      usage[portfolio] = addPlanFte(usage[portfolio], item)
    }
    const capacity = {
      client: weeklyCapacityByPortfolio(governanceConfig, 'client'),
      internal: weeklyCapacityByPortfolio(governanceConfig, 'internal'),
    }
    return {
      usage,
      capacity,
      clientUtilization: utilizationFromUsage(usage.client, capacity.client),
      internalUtilization: utilizationFromUsage(usage.internal, capacity.internal),
      unscheduled,
      activeNow,
    }
  }, [roadmapPlanItems, governanceConfig, today])

  const capacityAlert = dashboard?.capacity_governance_alert
  const capacityCritical = capacityAlert?.role_alerts.filter((r) => r.status === 'CRITICAL') || []
  const capacityWarning = capacityAlert?.role_alerts.filter((r) => r.status === 'WARNING') || []
  const windowLabel = cadence === 'month' ? `${windowSize} months` : `${windowSize} quarters`
  const cadenceLabel = cadence === 'month' ? 'Month-on-Month' : 'Quarter-on-Quarter'
  const movementTotal = dashboard?.roadmap_movement_total ?? 0
  const movementApproved = dashboard?.roadmap_movement_approved ?? 0
  const movementApprovalRate = movementTotal > 0 ? (movementApproved / movementTotal) * 100 : 0

  return (
    <main className="page-wrap dashboard-minimal dashboard-modern">
      <section className="stats-row dashboard-kpi-grid">
        <article className="metric-card">
          <p>Intake Queue</p>
          <h2>{dashboard?.intake_total ?? 0}</h2>
        </article>
        <article className="metric-card">
          <p>Commitment Candidates</p>
          <h2>{dashboard?.commitments_total ?? 0}</h2>
        </article>
        <article className="metric-card">
          <p>Roadmap Committed</p>
          <h2>{dashboard?.roadmap_total ?? 0}</h2>
        </article>
        <article className="metric-card">
          <p>Understanding Pending</p>
          <h2>{dashboard?.intake_understanding_pending ?? 0}</h2>
        </article>
        <article className="metric-card">
          <p>Movement Pending</p>
          <h2>{dashboard?.roadmap_movement_pending ?? 0}</h2>
        </article>
        <article className="metric-card">
          <p>R&D Pipeline</p>
          <h2>{rndWindowTotal}</h2>
          <span className="muted">{windowLabel}</span>
        </article>
        <article className="metric-card">
          <p>AI Pipeline</p>
          <h2>{aiWindowTotal}</h2>
          <span className="muted">{windowLabel}</span>
        </article>
        <article className="metric-card">
          <p>Movement Approval Rate</p>
          <h2>{movementApprovalRate.toFixed(0)}%</h2>
          <span className="muted">{movementApproved}/{movementTotal} approved</span>
        </article>
      </section>

      <section className="panel-card dashboard-toolbar-card">
        <div className="dashboard-toolbar-row">
          <div>
            <h3>Governance Trend Lens</h3>
            <p className="muted">Charts are driven by {cadenceLabel} over the last {windowLabel}.</p>
          </div>
          <div className="dashboard-filter-group">
            <div className="segmented-control" role="group" aria-label="Cadence">
              <button
                type="button"
                className={cadence === 'month' ? 'active' : ''}
                onClick={() => setCadence('month')}
              >
                MoM
              </button>
              <button
                type="button"
                className={cadence === 'quarter' ? 'active' : ''}
                onClick={() => setCadence('quarter')}
              >
                QoQ
              </button>
            </div>
            <div className="segmented-control" role="group" aria-label="Window">
              {(cadence === 'month' ? [6, 12] : [4, 8]).map((size) => (
                <button
                  key={`window-${size}`}
                  type="button"
                  className={windowSize === size ? 'active' : ''}
                  onClick={() => setWindowSize(size)}
                >
                  {cadence === 'month' ? `${size}M` : `${size}Q`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card-grid two">
        <article className="panel-card">
          <h3>Roadmap Movement Governance</h3>
          <p className="muted">Deterministic movement outcomes by {cadence === 'month' ? 'month' : 'quarter'}.</p>
          <div className="chart-wrap chart-wrap-tall">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={movementChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="period" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Approved" stackId="movement" fill={chartColorSuccess} radius={[8, 8, 0, 0]} />
                <Bar dataKey="Pending" stackId="movement" fill={chartColorWarn} />
                <Bar dataKey="Rejected" stackId="movement" fill={chartColorError} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="panel-card">
          <h3>Client vs Internal Portfolio Trend</h3>
          <p className="muted">Roadmap throughput split for client and internal portfolios.</p>
          <div className="chart-wrap chart-wrap-tall">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendSeries}>
                <defs>
                  <linearGradient id="clientArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColorPrimary} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={chartColorPrimary} stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="internalArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColorSecondary} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={chartColorSecondary} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="period" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="client" stroke={chartColorPrimary} fill="url(#clientArea)" strokeWidth={2.1} />
                <Area type="monotone" dataKey="internal" stroke={chartColorSecondary} fill="url(#internalArea)" strokeWidth={2.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="card-grid two">
        <article className="panel-card">
          <h3>Client Portfolio Weekly Capacity</h3>
          <p className="muted">Active timeline utilization for the current date.</p>
          {governanceConfig ? (
            <CapacityMeters
              title={`Client Utilization (${today.toLocaleDateString()})`}
              utilization={capacitySnapshot.clientUtilization}
            />
          ) : (
            <p className="muted">Governance configuration is missing. Set team sizes, efficiency, and quotas in Settings.</p>
          )}
          <h3>Deterministic Capacity Alert</h3>
          {!capacityAlert ? (
            <p className="muted">Capacity alert data is not available.</p>
          ) : (
            <div className="stack">
              <div className="line-item">
                <span className="muted">Status</span>
                <strong
                  className={
                    capacityAlert.status === 'CRITICAL'
                      ? 'capacity-meter-state error'
                      : capacityAlert.status === 'WARNING'
                        ? 'capacity-meter-state warn'
                        : 'capacity-meter-state ok'
                  }
                >
                  {capacityAlert.status}
                </strong>
              </div>
              <p className="muted">{capacityAlert.message}</p>
              {capacityCritical.length > 0 &&
                capacityCritical.map((item) => (
                  <div className="line-item" key={`cap-critical-${item.role}`}>
                    <span className="muted">{item.role} shortage ({item.portfolio || 'n/a'})</span>
                    <strong>{item.required_extra_fte.toFixed(1)} FTE</strong>
                  </div>
                ))}
              {capacityCritical.length === 0 &&
                capacityWarning.length > 0 &&
                capacityWarning.map((item) => (
                  <div className="line-item" key={`cap-warning-${item.role}`}>
                    <span className="muted">{item.role} peak utilization ({item.portfolio || 'n/a'})</span>
                    <strong>{(item.peak_utilization_pct || 0).toFixed(1)}%</strong>
                  </div>
                ))}
              <div className="line-item">
                <span className="muted">Unscheduled demand items</span>
                <strong>{capacityAlert.unscheduled_demand_items}</strong>
              </div>
            </div>
          )}
        </article>
        <article className="panel-card">
          <h3>Internal Portfolio Weekly Capacity</h3>
          <p className="muted">Active timeline utilization for the current date.</p>
          {governanceConfig ? (
            <CapacityMeters
              title={`Internal Utilization (${today.toLocaleDateString()})`}
              utilization={capacitySnapshot.internalUtilization}
            />
          ) : (
            <p className="muted">Governance configuration is missing. Set team sizes, efficiency, and quotas in Settings.</p>
          )}
          <div className="line-item">
            <span className="muted">Active commitments now: {capacitySnapshot.activeNow}</span>
            <span className={capacitySnapshot.unscheduled > 0 ? 'capacity-meter-state error' : 'muted'}>
              Unscheduled commitments: {capacitySnapshot.unscheduled}
            </span>
          </div>
        </article>
      </section>

      <section className="card-grid two">
        <article className="panel-card">
          <h3>R&D Stage Split</h3>
          <p className="muted">Placed below portfolio capacity as requested. Interactive with {cadence === 'month' ? 'MoM' : 'QoQ'} filter.</p>
          <div className="chart-wrap chart-wrap-tall">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rndStageChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="period" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Intake" stackId="rnd" fill={chartColorPrimary} radius={[8, 8, 0, 0]} />
                <Bar dataKey="Commitments" stackId="rnd" fill={chartColorAccent} />
                <Bar dataKey="Roadmap" stackId="rnd" fill={chartColorMuted} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel-card">
          <h3>AI Stage Split</h3>
          <p className="muted">AI-tagged progression across Intake, Commitment, and Roadmap stages.</p>
          <div className="chart-wrap chart-wrap-tall">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={aiStageChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="period" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Intake" stackId="ai" fill={chartColorPrimary} radius={[8, 8, 0, 0]} />
                <Bar dataKey="Commitments" stackId="ai" fill={chartColorAccent} />
                <Bar dataKey="Roadmap" stackId="ai" fill={chartColorSlate} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </main>
  )
}

type RndLabProps = {
  currentUserRole: SystemRole
  documents: DocumentItem[]
  intakeByDocument: Map<number, IntakeItem>
  intakeItems: IntakeItem[]
  roadmapItems: RoadmapItem[]
  roadmapPlanItems: RoadmapPlanItem[]
  analyzeDocument: (documentId: number, seed?: IntakeSeedMeta) => Promise<void>
  createManualIntake: (payload: ManualIntakeIn) => Promise<void>
  promoteRndIntakeToCommitment: (item: IntakeItem) => Promise<void>
  promoteRndCommitmentToRoadmap: (item: RoadmapItem) => Promise<void>
  unlockRoadmapCommitment: (itemId: number) => Promise<void>
  deleteRoadmapItemsByIds: (ids: number[]) => Promise<boolean>
  deleteDocumentsByIds: (ids: number[]) => Promise<boolean>
  deleteIntakeItemsByIds: (ids: number[]) => Promise<boolean>
  busy: boolean
}

function RndLabPage({
  currentUserRole,
  documents,
  intakeByDocument,
  intakeItems,
  roadmapItems,
  roadmapPlanItems,
  analyzeDocument,
  createManualIntake,
  promoteRndIntakeToCommitment,
  promoteRndCommitmentToRoadmap,
  unlockRoadmapCommitment,
  deleteRoadmapItemsByIds,
  deleteDocumentsByIds,
  deleteIntakeItemsByIds,
  busy,
}: RndLabProps) {
  const navigate = useNavigate()
  const isVP = currentUserRole === 'VP'
  const isCEO = currentUserRole === 'CEO'
  const [manualOpen, setManualOpen] = useState(false)
  const [stageView, setStageView] = useState<'intake' | 'commitment' | 'roadmap'>('intake')
  const [manualForm, setManualForm] = useState<ManualIntakeIn>({
    title: '',
    scope: '',
    activities: [],
    priority: 'medium',
    project_context: 'internal',
    initiative_type: 'new_feature',
    delivery_mode: 'rnd',
    rnd_hypothesis: '',
    rnd_experiment_goal: '',
    rnd_success_criteria: '',
    rnd_timebox_weeks: null,
    rnd_decision_date: '',
    rnd_next_gate: '',
    rnd_risk_level: '',
  })

  const rndIntake = useMemo(
    () => intakeItems.filter((item) => (item.delivery_mode || '').toLowerCase() === 'rnd'),
    [intakeItems],
  )
  const rndRoadmap = useMemo(
    () => roadmapPlanItems.filter((item) => (item.delivery_mode || '').toLowerCase() === 'rnd'),
    [roadmapPlanItems],
  )
  const roadmapItemById = useMemo(() => {
    const map = new Map<number, RoadmapItem>()
    for (const row of roadmapItems) map.set(row.id, row)
    return map
  }, [roadmapItems])
  const roadmapLinkedDocIds = useMemo(() => {
    const ids = new Set<number>()
    for (const row of roadmapItems) {
      if (row.source_document_id) ids.add(row.source_document_id)
    }
    return ids
  }, [roadmapItems])
  const rndRoadmapBucketIds = useMemo(() => new Set(rndRoadmap.map((item) => item.bucket_item_id)), [rndRoadmap])
  const rndCommitments = useMemo(
    () =>
      roadmapItems.filter(
        (item) => (item.delivery_mode || '').toLowerCase() === 'rnd' && !rndRoadmapBucketIds.has(item.id),
      ),
    [roadmapItems, rndRoadmapBucketIds],
  )
  const aiInRnd = useMemo(
    () => ({
      intake: rndIntake.filter((item) => hasAiTagInActivities(item.activities || [])).length,
      commitments: rndCommitments.filter((item) => (item.ai_fte || 0) > 0 || hasAiTagInActivities(item.activities || [])).length,
      roadmap: rndRoadmap.filter((item) => (item.ai_fte || 0) > 0 || hasAiTagInActivities(item.activities || [])).length,
    }),
    [rndIntake, rndCommitments, rndRoadmap],
  )
  const unassignedDocs = useMemo(
    () => documents.filter((doc) => !intakeByDocument.has(doc.id) && !roadmapLinkedDocIds.has(doc.id)),
    [documents, intakeByDocument, roadmapLinkedDocIds],
  )

  useEffect(() => {
    if (stageView === 'intake' && rndIntake.length > 0) return
    if (stageView === 'commitment' && rndCommitments.length > 0) return
    if (stageView === 'roadmap' && rndRoadmap.length > 0) return
    if (rndIntake.length > 0) {
      setStageView('intake')
      return
    }
    if (rndCommitments.length > 0) {
      setStageView('commitment')
      return
    }
    if (rndRoadmap.length > 0) {
      setStageView('roadmap')
    }
  }, [rndIntake.length, rndCommitments.length, rndRoadmap.length, stageView])

  async function deleteDocumentWithFeedback(documentId: number, label: string) {
    const ok = await deleteDocumentsByIds([documentId])
    if (!ok) {
      window.alert(`Delete failed for "${label}". Check top error banner for reason.`)
      return
    }
    window.alert(`Deleted "${label}".`)
  }

  async function deleteCommitmentWithFeedback(itemId: number, label: string) {
    const ok = await deleteRoadmapItemsByIds([itemId])
    if (!ok) {
      window.alert(`Delete failed for "${label}". Check top error banner for reason.`)
      return
    }
    window.alert(`Deleted "${label}".`)
  }

  async function deleteIntakeWithFeedback(itemId: number, label: string) {
    const ok = await deleteIntakeItemsByIds([itemId])
    if (!ok) {
      window.alert(`Delete failed for "${label}". Check top error banner for reason.`)
      return
    }
    window.alert(`Deleted "${label}".`)
  }

  if (!isVP && !isCEO) {
    return (
      <main className="page-shell">
        <section className="panel-card">
          <h3>R&D Lab</h3>
          <p className="error-text">Access denied. R&D Lab is available to CEO/VP roles.</p>
        </section>
      </main>
    )
  }

  return (
    <>
      <main className="page-shell rnd-lab">
        <section className="panel-card rnd-hero">
          <div className="line-item rnd-title-row">
            <h2 className="rnd-title">
              <span className="rnd-title-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M8 3h8" />
                  <path d="M9 3v5l-4 7a4 4 0 0 0 3.5 6h7A4 4 0 0 0 19 15l-4-7V3" />
                  <path d="M8 14h8" />
                </svg>
              </span>
              R&D Lab
            </h2>
            <span className="muted">VP-owned intake for AI/R&D experiments and MVP conversion flow.</span>
          </div>
          <details className="flat-detail" open>
            <summary>R&D pipeline (source of truth)</summary>
            <ol className="understanding-list">
              <li>VP creates R&D intake from uploaded document (Start R&D Intake) or Manual R&D Intake.</li>
              <li>Intake is reviewed and approved; system creates/updates commitment candidate with <code>delivery_mode = rnd</code>.</li>
              <li>In Commitment Shaping, VP/CEO refines scope, activities, and FTE, then confirms roadmap commitment.</li>
              <li>After commit, item moves to roadmap plan and appears in R&D Roadmap metrics and dashboard charts.</li>
            </ol>
          </details>
          <div className="stats-grid rnd-kpis">
            <div className="stat-item">
              <p>R&D Intake</p>
              <h2>{rndIntake.length}</h2>
            </div>
            <div className="stat-item">
              <p>R&D Commitments</p>
              <h2>{rndCommitments.length}</h2>
            </div>
            <div className="stat-item">
              <p>R&D Roadmap</p>
              <h2>{rndRoadmap.length}</h2>
            </div>
            <div className="stat-item">
              <p>AI in R&D (All Stages)</p>
              <h2>{aiInRnd.intake + aiInRnd.commitments + aiInRnd.roadmap}</h2>
            </div>
          </div>
          <div className="line-item">
            <span className="muted">AI-tagged R&D Intake: {aiInRnd.intake}</span>
            <span className="muted">AI-loaded R&D Commitments: {aiInRnd.commitments}</span>
            <span className="muted">AI-loaded R&D Roadmap: {aiInRnd.roadmap}</span>
          </div>
          <p className="muted">Single-state model: one project appears in only one stage at a time (Intake or Commitment or Roadmap).</p>
        </section>

        <section className="panel-card rnd-section">
          <div className="line-item rnd-section-head">
            <h3>
              <span className="rnd-mini-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              Create R&D Intake
            </h3>
            {isVP && (
              <button className="ghost-btn tiny" type="button" onClick={() => setManualOpen(true)}>
                Manual R&D Intake
              </button>
            )}
          </div>
          <p className="muted">
            {isVP
              ? 'Use uploaded documents to start R&D intake or create manual intake.'
              : 'CEO can review and transition stages. VP role is required to create new R&D intake.'}
          </p>
          <details className="flat-detail">
            <summary>Start from uploaded documents ({unassignedDocs.length})</summary>
            <div className="intake-table-wrap">
              <table className="docs-table rnd-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedDocs.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">
                        No unassigned uploaded documents available.
                      </td>
                    </tr>
                  )}
                  {unassignedDocs.map((doc) => (
                    <tr key={doc.id}>
                      <td>{doc.file_name}</td>
                      <td>{(doc.file_type || '').toUpperCase()}</td>
                      <td>
                        <div className="activity-chip-row">
                          <button
                            className="ghost-btn tiny"
                            type="button"
                            disabled={busy || !isVP}
                            onClick={() =>
                              analyzeDocument(doc.id, {
                                priority: 'medium',
                                project_context: 'internal',
                                initiative_type: 'new_feature',
                                delivery_mode: 'rnd',
                                rnd_hypothesis: '',
                                rnd_experiment_goal: '',
                                rnd_success_criteria: '',
                                rnd_timebox_weeks: null,
                                rnd_decision_date: '',
                                rnd_next_gate: '',
                                rnd_risk_level: '',
                              })
                            }
                          >
                            Start R&D Intake
                          </button>
                          <button
                            className="ghost-btn tiny"
                            type="button"
                            disabled={busy}
                            title="Delete document"
                            onClick={async () => {
                              const ok = window.confirm(`Delete uploaded document "${doc.file_name}"?`)
                              if (!ok) return
                              await deleteDocumentWithFeedback(doc.id, doc.file_name)
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section className="panel-card rnd-section">
          <div className="line-item rnd-section-head">
            <h3>
              <span className="rnd-mini-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h10M4 18h6" />
                </svg>
              </span>
              R&D Stage Workspace
            </h3>
            <div className="activity-chip-row rnd-stage-tabs">
              <button
                className={`ghost-btn tiny${stageView === 'intake' ? ' active-pill' : ''}`}
                type="button"
                onClick={() => setStageView('intake')}
              >
                Intake ({rndIntake.length})
              </button>
              <button
                className={`ghost-btn tiny${stageView === 'commitment' ? ' active-pill' : ''}`}
                type="button"
                onClick={() => setStageView('commitment')}
              >
                Commitment ({rndCommitments.length})
              </button>
              <button
                className={`ghost-btn tiny${stageView === 'roadmap' ? ' active-pill' : ''}`}
                type="button"
                onClick={() => setStageView('roadmap')}
              >
                Roadmap ({rndRoadmap.length})
              </button>
            </div>
          </div>
          <p className="muted">
            {stageView === 'intake' && 'Intake to Commitment transition: validates and creates commitment candidate.'}
            {stageView === 'commitment' && 'Commitment to Roadmap transition: requires FTE and timebox; capacity checks are enforced.'}
            {stageView === 'roadmap' && 'Roadmap to Commitment transition: unlock item to move it back for reshaping.'}
          </p>
          <div className="intake-table-wrap">
            <table className="docs-table rnd-table">
              {stageView === 'intake' && (
                <>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Next Gate</th>
                      <th>Risk</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rndIntake.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted">
                          No R&D intake items.
                        </td>
                      </tr>
                    )}
                    {rndIntake.map((item) => (
                      <tr key={`rnd-intake-${item.id}`}>
                        <td>{item.id}</td>
                        <td>{item.title || '-'}</td>
                        <td>{item.status || '-'}</td>
                        <td>{item.rnd_next_gate || '-'}</td>
                        <td>{item.rnd_risk_level || '-'}</td>
                        <td>
                          <div className="activity-chip-row">
                            <button
                              className="ghost-btn tiny"
                              type="button"
                              disabled={busy}
                              onClick={() => void promoteRndIntakeToCommitment(item)}
                            >
                              Move to Commitment
                            </button>
                            <button
                              className="ghost-btn tiny"
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                const ok = window.confirm(`Delete R&D intake "${item.title}"?`)
                                if (!ok) return
                                await deleteIntakeWithFeedback(item.id, item.title || `Intake ${item.id}`)
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
              {stageView === 'commitment' && (
                <>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Priority</th>
                      <th>FTE (FE/BE/AI/PM)</th>
                      <th>Timebox</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rndCommitments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted">
                          No R&D commitments.
                        </td>
                      </tr>
                    )}
                    {rndCommitments.map((item) => (
                      <tr key={`rnd-commit-${item.id}`}>
                        <td>{item.id}</td>
                        <td>{item.title || '-'}</td>
                        <td>{item.priority || '-'}</td>
                        <td>{`${(item.fe_fte || 0).toFixed(1)}/${(item.be_fte || 0).toFixed(1)}/${(item.ai_fte || 0).toFixed(1)}/${(item.pm_fte || 0).toFixed(1)}`}</td>
                        <td>{item.rnd_timebox_weeks || '-'}</td>
                        <td>
                          <div className="activity-chip-row">
                            <button
                              className="ghost-btn tiny"
                              type="button"
                              disabled={busy}
                              onClick={() => void promoteRndCommitmentToRoadmap(item)}
                            >
                              Move to Roadmap
                            </button>
                            <button className="ghost-btn tiny" type="button" disabled={busy} onClick={() => navigate('/roadmap')}>
                              Open Commitment
                            </button>
                            <button
                              className="ghost-btn tiny"
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                const ok = window.confirm(`Delete R&D commitment "${item.title}"?`)
                                if (!ok) return
                                await deleteCommitmentWithFeedback(item.id, item.title || `Commitment ${item.id}`)
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
              {stageView === 'roadmap' && (
                <>
                  <thead>
                    <tr>
                      <th>Plan ID</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rndRoadmap.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted">
                          No R&D roadmap items.
                        </td>
                      </tr>
                    )}
                    {rndRoadmap.map((item) => (
                      <tr key={`rnd-roadmap-${item.id}`}>
                        <td>{item.id}</td>
                        <td>{item.title || '-'}</td>
                        <td>{item.planning_status || '-'}</td>
                        <td>{item.planned_start_date || '-'}</td>
                        <td>{item.planned_end_date || '-'}</td>
                        <td>
                          <div className="activity-chip-row">
                            <button
                              className="ghost-btn tiny"
                              type="button"
                              disabled={busy}
                              onClick={() => void unlockRoadmapCommitment(item.bucket_item_id)}
                            >
                              Move back to Commitment
                            </button>
                            <button className="ghost-btn tiny" type="button" disabled={busy} onClick={() => navigate('/roadmap-agent')}>
                              Open Roadmap
                            </button>
                            <button
                              className="ghost-btn tiny"
                              type="button"
                              disabled={
                                busy ||
                                !isCEO ||
                                !(roadmapItemById.get(item.bucket_item_id)?.source_document_id)
                              }
                              onClick={async () => {
                                const bucket = roadmapItemById.get(item.bucket_item_id)
                                if (!bucket?.source_document_id) return
                                const ok = window.confirm(
                                  `Delete roadmap item "${item.title}" and linked source document? This cannot be undone.`,
                                )
                                if (!ok) return
                                await deleteDocumentWithFeedback(bucket.source_document_id, item.title || `Roadmap ${item.id}`)
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        </section>
      </main>

      {manualOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>Manual R&D Intake (VP)</h3>
            <div className="stack">
              <label>
                Title
                <input value={manualForm.title} onChange={(e) => setManualForm((s) => ({ ...s, title: e.target.value }))} />
              </label>
              <label>
                Scope
                <textarea rows={3} value={manualForm.scope} onChange={(e) => setManualForm((s) => ({ ...s, scope: e.target.value }))} />
              </label>
              <label>
                Activities (one per line)
                <textarea
                  rows={4}
                  value={manualForm.activities.join('\n')}
                  onChange={(e) =>
                    setManualForm((s) => ({
                      ...s,
                      activities: e.target.value
                        .split('\n')
                        .map((x) => x.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </label>
              <div className="split-2">
                <label>
                  Priority
                  <select value={manualForm.priority} onChange={(e) => setManualForm((s) => ({ ...s, priority: e.target.value }))}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
                <label>
                  Project Context
                  <select value={manualForm.project_context} onChange={(e) => setManualForm((s) => ({ ...s, project_context: e.target.value }))}>
                    <option value="internal">Internal Product Development</option>
                    <option value="client">Client Project</option>
                  </select>
                </label>
              </div>
              <label>
                Hypothesis
                <textarea rows={2} value={manualForm.rnd_hypothesis} onChange={(e) => setManualForm((s) => ({ ...s, rnd_hypothesis: e.target.value }))} />
              </label>
              <label>
                Experiment Goal
                <textarea rows={2} value={manualForm.rnd_experiment_goal} onChange={(e) => setManualForm((s) => ({ ...s, rnd_experiment_goal: e.target.value }))} />
              </label>
              <label>
                Success Criteria
                <textarea rows={2} value={manualForm.rnd_success_criteria} onChange={(e) => setManualForm((s) => ({ ...s, rnd_success_criteria: e.target.value }))} />
              </label>
              <div className="split-2">
                <label>
                  Timebox (weeks)
                  <input
                    type="number"
                    min={1}
                    value={manualForm.rnd_timebox_weeks ?? ''}
                    onChange={(e) => setManualForm((s) => ({ ...s, rnd_timebox_weeks: e.target.value ? Number(e.target.value) : null }))}
                  />
                </label>
                <label>
                  Decision Date
                  <input type="date" value={manualForm.rnd_decision_date} onChange={(e) => setManualForm((s) => ({ ...s, rnd_decision_date: e.target.value }))} />
                </label>
              </div>
              <div className="split-2">
                <label>
                  Next Gate
                  <select value={manualForm.rnd_next_gate} onChange={(e) => setManualForm((s) => ({ ...s, rnd_next_gate: e.target.value }))}>
                    <option value="">Select</option>
                    <option value="continue">Continue</option>
                    <option value="pivot">Pivot</option>
                    <option value="stop">Stop</option>
                    <option value="productize">Productize</option>
                  </select>
                </label>
                <label>
                  Risk Level
                  <select value={manualForm.rnd_risk_level} onChange={(e) => setManualForm((s) => ({ ...s, rnd_risk_level: e.target.value }))}>
                    <option value="">Select</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="row-actions">
              <button className="ghost-btn" type="button" onClick={() => setManualOpen(false)}>
                Cancel
              </button>
              <button
                className="primary-btn"
                type="button"
                disabled={busy || !isVP || !manualForm.title.trim()}
                onClick={async () => {
                  await createManualIntake({
                    ...manualForm,
                    delivery_mode: 'rnd',
                  })
                  setManualOpen(false)
                  setManualForm({
                    title: '',
                    scope: '',
                    activities: [],
                    priority: 'medium',
                    project_context: 'internal',
                    initiative_type: 'new_feature',
                    delivery_mode: 'rnd',
                    rnd_hypothesis: '',
                    rnd_experiment_goal: '',
                    rnd_success_criteria: '',
                    rnd_timebox_weeks: null,
                    rnd_decision_date: '',
                    rnd_next_gate: '',
                    rnd_risk_level: '',
                  })
                }}
              >
                Create R&D Intake
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

type IntakeProps = {
  canEnterRndFromIntake: boolean
  token: string | null
  documents: DocumentItem[]
  roadmapItems: RoadmapItem[]
  intakeByDocument: Map<number, IntakeItem>
  uploadFiles: File[]
  setUploadFiles: Dispatch<SetStateAction<File[]>>
  uploadPickerKey: number
  uploadNotes: string
  setUploadNotes: Dispatch<SetStateAction<string>>
  handleUpload: (e: FormEvent) => Promise<void>
  uploadMessage: string
  analyzeDocument: (documentId: number, seed?: IntakeSeedMeta) => Promise<void>
  startReview: (item: IntakeItem) => Promise<void>
  selectedIntakeItem: IntakeItem | null
  reviewTitle: string
  setReviewTitle: Dispatch<SetStateAction<string>>
  reviewScope: string
  setReviewScope: Dispatch<SetStateAction<string>>
  reviewActivities: string[]
  setReviewActivities: Dispatch<SetStateAction<string[]>>
  updateReviewActivity: (index: number, value: string) => void
  toggleReviewActivityTag: (index: number, tag: ActivityTag) => void
  addReviewActivity: () => void
  removeReviewActivity: (index: number) => void
  submitReview: (status: 'draft' | 'approved' | 'understanding_pending', expectedVersionNo?: number) => Promise<void>
  intakeHistory: VersionItem[]
  selectedAnalysis: IntakeAnalysisPayload | null
  isCEO: boolean
  canDeleteDocuments: boolean
  approveUnderstanding: (itemId: number, payload: UnderstandingApprovalInput) => Promise<void>
  saveUnderstandingDraft: (itemId: number, payload: UnderstandingApprovalInput) => Promise<IntakeAnalysisPayload>
  createManualIntake: (payload: ManualIntakeIn) => Promise<void>
  selectedDocumentIds: number[]
  setSelectedDocumentIds: Dispatch<SetStateAction<number[]>>
  bulkDeleteDocuments: () => Promise<void>
  busy: boolean
  fetchDocumentBlob: (documentId: number) => Promise<{ blob: Blob; contentType: string }>
  setErrorMessage: Dispatch<SetStateAction<string>>
  requestIntakeSupport: (item: IntakeItem) => void
}

type AuditStageFilter = 'all' | 'documents' | 'intake' | 'roadmap' | 'movement'

type AuditCenterProps = {
  token: string | null
  canView: boolean
}

function AuditCenterPage({ token, canView }: AuditCenterProps) {
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [audit, setAudit] = useState<AuditCenterPayload | null>(null)
  const [stage, setStage] = useState<AuditStageFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!token || !canView) return
    setLoading(true)
    setLoadError('')
    api<AuditCenterPayload>('/audit/center', {}, token)
      .then((data) => setAudit(data))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load audit center'))
      .finally(() => setLoading(false))
  }, [token, canView])

  function inDateRange(value: string): boolean {
    if (!value) return true
    const at = new Date(value).getTime()
    if (!Number.isFinite(at)) return false
    if (dateFrom) {
      const start = new Date(`${dateFrom}T00:00:00`).getTime()
      if (at < start) return false
    }
    if (dateTo) {
      const end = new Date(`${dateTo}T23:59:59`).getTime()
      if (at > end) return false
    }
    return true
  }

  function matchesActor(email: string | null | undefined): boolean {
    if (!actorFilter.trim()) return true
    return (email || '').toLowerCase().includes(actorFilter.trim().toLowerCase())
  }

  function matchesRole(role: string | null | undefined): boolean {
    if (roleFilter === 'all') return true
    return (role || '').toUpperCase() === roleFilter.toUpperCase()
  }

  function matchesProject(context: string): boolean {
    if (projectFilter === 'all') return true
    return (context || '').toLowerCase() === projectFilter.toLowerCase()
  }

  function matchesStatus(value: string): boolean {
    if (!statusFilter.trim()) return true
    return (value || '').toLowerCase().includes(statusFilter.trim().toLowerCase())
  }

  function matchesSearch(value: string): boolean {
    if (!search.trim()) return true
    return (value || '').toLowerCase().includes(search.trim().toLowerCase())
  }

  const documents = useMemo(() => {
    const rows = audit?.documents || []
    return rows.filter((row) => {
      const lifecycle = `${row.intake_status || ''} ${row.roadmap_planning_status || ''}`.trim()
      return (
        inDateRange(row.created_at) &&
        matchesActor(row.uploaded_by_email) &&
        matchesRole(row.uploaded_by_role) &&
        matchesProject(row.project_context || '') &&
        matchesStatus(lifecycle) &&
        matchesSearch(`${row.file_name} ${row.notes} ${row.file_hash}`)
      )
    })
  }, [audit?.documents, dateFrom, dateTo, actorFilter, roleFilter, projectFilter, statusFilter, search])

  const intakeChanges = useMemo(() => {
    const rows = audit?.intake_changes || []
    return rows.filter((row) => {
      const statusAction = `${row.status || ''} ${row.action || ''}`.trim()
      return (
        inDateRange(row.created_at) &&
        matchesActor(row.changed_by_email) &&
        matchesRole(row.changed_by_role) &&
        matchesProject(row.project_context || '') &&
        matchesStatus(statusAction) &&
        matchesSearch(`${row.title} ${row.action} ${(row.changed_fields || []).join(' ')}`)
      )
    })
  }, [audit?.intake_changes, dateFrom, dateTo, actorFilter, roleFilter, projectFilter, statusFilter, search])

  const roadmapChanges = useMemo(() => {
    const rows = audit?.roadmap_changes || []
    return rows.filter((row) => {
      return (
        inDateRange(row.created_at) &&
        matchesActor(row.changed_by_email) &&
        matchesRole(row.changed_by_role) &&
        matchesProject(row.project_context || '') &&
        matchesStatus(row.action || '') &&
        matchesSearch(`${row.title} ${row.action} ${(row.changed_fields || []).join(' ')}`)
      )
    })
  }, [audit?.roadmap_changes, dateFrom, dateTo, actorFilter, roleFilter, projectFilter, statusFilter, search])

  const movementEvents = useMemo(() => {
    const rows = audit?.movement_events || []
    return rows.filter((row) => {
      return (
        inDateRange(row.requested_at) &&
        (matchesActor(row.requested_by_email) || matchesActor(row.decided_by_email)) &&
        (matchesRole(row.requested_by_role) || matchesRole(row.decided_by_role)) &&
        matchesProject(row.project_context || '') &&
        matchesStatus(`${row.status || ''} ${row.request_type || ''}`) &&
        matchesSearch(`${row.title} ${row.reason} ${row.blocker} ${row.decision_reason}`)
      )
    })
  }, [audit?.movement_events, dateFrom, dateTo, actorFilter, roleFilter, projectFilter, statusFilter, search])

  function csvEscape(value: unknown): string {
    const raw = String(value ?? '')
    if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`
    }
    return raw
  }

  function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
    if (!rows.length) return
    const headers = Object.keys(rows[0])
    const lines = [headers.join(',')]
    for (const row of rows) {
      lines.push(headers.map((h) => csvEscape(row[h])).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!canView) {
    return (
      <main className="page-shell">
        <section className="panel-card">
          <h3>Audit Center</h3>
          <p className="error-text">Access denied. Audit Center is available to ADMIN/CEO/VP only.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <section className="panel-card">
        <div className="line-item">
          <h2>Audit Center</h2>
          <div className="row-actions">
            <button
              className="ghost-btn tiny"
              type="button"
              disabled={loading || !token}
              onClick={() => {
                if (!token) return
                setLoading(true)
                setLoadError('')
                api<AuditCenterPayload>('/audit/center', {}, token)
                  .then((data) => setAudit(data))
                  .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not refresh audit center'))
                  .finally(() => setLoading(false))
              }}
            >
              Refresh
            </button>
          </div>
        </div>
        <p className="muted">Unified document, intake, commitment/roadmap, and movement evidence trail for executive review.</p>
        {audit && (
          <div className="stats-grid">
            <div className="stat-item">
              <p>Documents</p>
              <h2>{audit.summary.documents_total}</h2>
            </div>
            <div className="stat-item">
              <p>Intake Changes</p>
              <h2>{audit.summary.intake_changes_total}</h2>
            </div>
            <div className="stat-item">
              <p>Roadmap Changes</p>
              <h2>{audit.summary.roadmap_changes_total}</h2>
            </div>
            <div className="stat-item">
              <p>Movement Events</p>
              <h2>{audit.summary.movement_total}</h2>
            </div>
          </div>
        )}
      </section>

      <section className="panel-card">
        <div className="line-item">
          <strong>Filters</strong>
          {audit?.generated_at && <span className="muted">Generated: {fmtDateTime(audit.generated_at)}</span>}
        </div>
        <div className="row-grid">
          <label>
            Stage
            <select value={stage} onChange={(e) => setStage(e.target.value as AuditStageFilter)}>
              <option value="all">All</option>
              <option value="documents">Document Register</option>
              <option value="intake">Intake Change Log</option>
              <option value="roadmap">Commitment/Roadmap Log</option>
              <option value="movement">Movement & Approval Log</option>
            </select>
          </label>
          <label>
            Date From
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            Date To
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label>
            Role / Actor Email
            <input value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} placeholder="ceo@..." />
          </label>
          <label>
            Role
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="ADMIN">ADMIN</option>
              <option value="CEO">CEO</option>
              <option value="VP">VP</option>
              <option value="BA">BA</option>
              <option value="PM">PM</option>
              <option value="PO">PO</option>
            </select>
          </label>
          <label>
            Project Scope
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="client">Client</option>
              <option value="internal">Internal</option>
            </select>
          </label>
          <label>
            Status / Action
            <input value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="pending, approved, draft" />
          </label>
        </div>
        <label>
          Search
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="file name, title, reason, field" />
        </label>
      </section>

      {loading && (
        <section className="panel-card">
          <p className="muted">Loading audit data...</p>
        </section>
      )}
      {loadError && (
        <section className="panel-card">
          <p className="error-text">{loadError}</p>
        </section>
      )}

      {!loading && !loadError && audit && (stage === 'all' || stage === 'documents') && (
        <section className="panel-card">
          <div className="line-item">
            <h3>Document Register</h3>
            <button
              className="ghost-btn tiny"
              type="button"
              disabled={documents.length === 0}
              onClick={() =>
                downloadCsv(
                  'audit_document_register.csv',
                  documents.map((row) => ({
                    document_id: row.document_id,
                    file_name: row.file_name,
                    file_type: row.file_type,
                    file_hash: row.file_hash,
                    uploaded_by_email: row.uploaded_by_email || '',
                    uploaded_by_role: row.uploaded_by_role || '',
                    created_at: row.created_at,
                    project_context: row.project_context,
                    intake_status: row.intake_status,
                    roadmap_planning_status: row.roadmap_planning_status,
                  })),
                )
              }
            >
              Export CSV
            </button>
          </div>
          <div className="intake-table-wrap">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>File</th>
                  <th>Type</th>
                  <th>Hash</th>
                  <th>Uploaded By</th>
                  <th>Created At</th>
                  <th>Context</th>
                  <th>Intake</th>
                  <th>Roadmap</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="muted">
                      No records match current filters.
                    </td>
                  </tr>
                )}
                {documents.map((row) => (
                  <tr key={row.document_id}>
                    <td>{row.document_id}</td>
                    <td title={row.notes || row.file_name}>{row.file_name}</td>
                    <td>{(row.file_type || '').toUpperCase()}</td>
                    <td className="mono">{row.file_hash ? `${row.file_hash.slice(0, 12)}...` : '-'}</td>
                    <td>{row.uploaded_by_email || '-'}</td>
                    <td>{fmtDateTime(row.created_at)}</td>
                    <td>{row.project_context || '-'}</td>
                    <td>{row.intake_item_id ? `${row.intake_item_id} (${row.intake_status || '-'})` : '-'}</td>
                    <td>{row.roadmap_item_id ? `${row.roadmap_item_id} (${row.roadmap_planning_status || '-'})` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && !loadError && audit && (stage === 'all' || stage === 'intake') && (
        <section className="panel-card">
          <div className="line-item">
            <h3>Intake Change Log</h3>
            <button
              className="ghost-btn tiny"
              type="button"
              disabled={intakeChanges.length === 0}
              onClick={() =>
                downloadCsv(
                  'audit_intake_changes.csv',
                  intakeChanges.map((row) => ({
                    event_id: row.event_id,
                    intake_item_id: row.intake_item_id,
                    document_id: row.document_id,
                    title: row.title,
                    action: row.action,
                    status: row.status,
                    project_context: row.project_context,
                    actor_email: row.changed_by_email || '',
                    actor_role: row.changed_by_role || '',
                    changed_fields: (row.changed_fields || []).join('|'),
                    created_at: row.created_at,
                  })),
                )
              }
            >
              Export CSV
            </button>
          </div>
          <div className="intake-table-wrap">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Intake ID</th>
                  <th>Title</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Context</th>
                  <th>Actor</th>
                  <th>Fields</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {intakeChanges.length === 0 && (
                  <tr>
                    <td colSpan={9} className="muted">
                      No records match current filters.
                    </td>
                  </tr>
                )}
                {intakeChanges.map((row) => (
                  <tr key={row.event_id}>
                    <td>{row.event_id}</td>
                    <td>{row.intake_item_id}</td>
                    <td>{row.title || '-'}</td>
                    <td>{row.action || '-'}</td>
                    <td>{row.status || '-'}</td>
                    <td>{row.project_context || '-'}</td>
                    <td>{row.changed_by_email || '-'}</td>
                    <td>{(row.changed_fields || []).length ? row.changed_fields.join(', ') : '-'}</td>
                    <td>{fmtDateTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && !loadError && audit && (stage === 'all' || stage === 'roadmap') && (
        <section className="panel-card">
          <div className="line-item">
            <h3>Commitment / Roadmap Change Log</h3>
            <button
              className="ghost-btn tiny"
              type="button"
              disabled={roadmapChanges.length === 0}
              onClick={() =>
                downloadCsv(
                  'audit_roadmap_changes.csv',
                  roadmapChanges.map((row) => ({
                    event_id: row.event_id,
                    roadmap_item_id: row.roadmap_item_id,
                    title: row.title,
                    action: row.action,
                    project_context: row.project_context,
                    actor_email: row.changed_by_email || '',
                    actor_role: row.changed_by_role || '',
                    changed_fields: (row.changed_fields || []).join('|'),
                    created_at: row.created_at,
                  })),
                )
              }
            >
              Export CSV
            </button>
          </div>
          <div className="intake-table-wrap">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Roadmap ID</th>
                  <th>Title</th>
                  <th>Action</th>
                  <th>Context</th>
                  <th>Actor</th>
                  <th>Fields</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {roadmapChanges.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted">
                      No records match current filters.
                    </td>
                  </tr>
                )}
                {roadmapChanges.map((row) => (
                  <tr key={row.event_id}>
                    <td>{row.event_id}</td>
                    <td>{row.roadmap_item_id}</td>
                    <td>{row.title || '-'}</td>
                    <td>{row.action || '-'}</td>
                    <td>{row.project_context || '-'}</td>
                    <td>{row.changed_by_email || '-'}</td>
                    <td>{(row.changed_fields || []).length ? row.changed_fields.join(', ') : '-'}</td>
                    <td>{fmtDateTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && !loadError && audit && (stage === 'all' || stage === 'movement') && (
        <section className="panel-card">
          <div className="line-item">
            <h3>Movement & Approval Log</h3>
            <button
              className="ghost-btn tiny"
              type="button"
              disabled={movementEvents.length === 0}
              onClick={() =>
                downloadCsv(
                  'audit_movement_events.csv',
                  movementEvents.map((row) => ({
                    request_id: row.request_id,
                    plan_item_id: row.plan_item_id,
                    bucket_item_id: row.bucket_item_id,
                    title: row.title,
                    status: row.status,
                    request_type: row.request_type,
                    project_context: row.project_context,
                    requested_by_email: row.requested_by_email || '',
                    requested_by_role: row.requested_by_role || '',
                    requested_at: row.requested_at,
                    decided_by_email: row.decided_by_email || '',
                    decided_by_role: row.decided_by_role || '',
                    decided_at: row.decided_at || '',
                    executed_at: row.executed_at || '',
                    reason: row.reason,
                    blocker: row.blocker,
                    decision_reason: row.decision_reason,
                  })),
                )
              }
            >
              Export CSV
            </button>
          </div>
          <div className="intake-table-wrap">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Context</th>
                  <th>Requested By</th>
                  <th>Requested At</th>
                  <th>Decided By</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {movementEvents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="muted">
                      No records match current filters.
                    </td>
                  </tr>
                )}
                {movementEvents.map((row) => (
                  <tr key={row.request_id}>
                    <td>{row.request_id}</td>
                    <td title={row.reason || row.title}>{row.title || '-'}</td>
                    <td>{row.status || '-'}</td>
                    <td>{row.request_type || '-'}</td>
                    <td>{row.project_context || '-'}</td>
                    <td>{row.requested_by_email || '-'}</td>
                    <td>{fmtDateTime(row.requested_at)}</td>
                    <td>{row.decided_by_email || '-'}</td>
                    <td>{row.decision_reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}

function IntakePage({
  canEnterRndFromIntake,
  token,
  documents,
  roadmapItems,
  intakeByDocument,
  uploadFiles,
  setUploadFiles,
  uploadPickerKey,
  uploadNotes,
  setUploadNotes,
  handleUpload,
  uploadMessage,
  analyzeDocument,
  startReview,
  selectedIntakeItem,
  reviewTitle,
  setReviewTitle,
  reviewScope,
  setReviewScope,
  reviewActivities,
  setReviewActivities,
  updateReviewActivity,
  toggleReviewActivityTag,
  addReviewActivity,
  removeReviewActivity,
  submitReview,
  intakeHistory,
  selectedAnalysis,
  isCEO,
  canDeleteDocuments,
  approveUnderstanding,
  saveUnderstandingDraft,
  createManualIntake,
  selectedDocumentIds,
  setSelectedDocumentIds,
  bulkDeleteDocuments,
  busy,
  fetchDocumentBlob,
  setErrorMessage,
  requestIntakeSupport,
}: IntakeProps) {
  const navigate = useNavigate()
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [metaModalDoc, setMetaModalDoc] = useState<DocumentItem | null>(null)
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [uploadSidebarOpen, setUploadSidebarOpen] = useState(false)
  const [reviewTagFilter, setReviewTagFilter] = useState<'ALL' | ActivityTag>('ALL')
  const [reviewSortDir, setReviewSortDir] = useState<'asc' | 'desc'>('asc')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewType, setPreviewType] = useState('')
  const [previewFileType, setPreviewFileType] = useState('')
  const [previewMode, setPreviewMode] = useState<'inline_file' | 'extracted_text' | 'download_only'>('inline_file')
  const [previewText, setPreviewText] = useState('')
  const [previewUnits, setPreviewUnits] = useState<Array<{ ref: string; text: string }>>([])
  const [previewError, setPreviewError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [understandingIntent, setUnderstandingIntent] = useState('')
  const [understandingOutcomesText, setUnderstandingOutcomesText] = useState('')
  const [understandingTheme, setUnderstandingTheme] = useState('')
  const [understandingConfidence, setUnderstandingConfidence] = useState('medium')
  const [reviewActivityMode, setReviewActivityMode] = useState<'commitment' | 'implementation'>('commitment')
  const [intakeSeed, setIntakeSeed] = useState<IntakeSeedMeta>({
    priority: 'medium',
    project_context: 'client',
    initiative_type: 'new_feature',
    delivery_mode: 'standard',
    rnd_hypothesis: '',
    rnd_experiment_goal: '',
    rnd_success_criteria: '',
    rnd_timebox_weeks: null,
    rnd_decision_date: '',
    rnd_next_gate: '',
    rnd_risk_level: '',
  })
  const [manualForm, setManualForm] = useState<ManualIntakeIn>({
    title: '',
    scope: '',
    activities: [],
    priority: 'medium',
    project_context: 'client',
    initiative_type: 'new_feature',
    delivery_mode: 'standard',
    rnd_hypothesis: '',
    rnd_experiment_goal: '',
    rnd_success_criteria: '',
    rnd_timebox_weeks: null,
    rnd_decision_date: '',
    rnd_next_gate: '',
    rnd_risk_level: '',
  })

  const selectedAnalysisForItem =
    selectedIntakeItem && selectedAnalysis && selectedAnalysis.intake_item_id === selectedIntakeItem.id
      ? selectedAnalysis
      : null
  const understandingCheck = selectedAnalysisForItem?.output_json?.document_understanding_check as
    | {
        'Primary intent (1 sentence)'?: string
        'Explicit outcomes (bullet list)'?: string[]
        'Dominant capability/theme (1 phrase)'?: string
        Confidence?: string
      }
    | undefined
  const llmRuntime = selectedAnalysisForItem?.output_json?.llm_runtime as
    | { provider?: string; model?: string; attempted?: boolean; success?: boolean; error?: string }
    | undefined
  const parserCoverage = selectedAnalysisForItem?.output_json?.parser_coverage as
    | { units_processed?: number; pages_detected?: number[] }
    | undefined
  const supportResolution = selectedAnalysisForItem?.output_json?.support_resolution as
    | { applied?: boolean; applied_at?: string; next_step?: string; intent_clear?: boolean }
    | undefined
  const roadmapCandidate = selectedAnalysisForItem?.output_json?.roadmap_candidate as
    | {
        Activities?: string[]
        CommitmentActivities?: string[]
        ImplementationActivities?: string[]
        CommitmentActivityQuality?: { average_score?: number; weak_count?: number; total?: number }
        ImplementationActivityQuality?: { average_score?: number; weak_count?: number; total?: number }
      }
    | undefined
  const selectedActivityMode = ((selectedAnalysisForItem?.output_json?.activity_mode_selected as string | undefined) || '').toLowerCase()
  const candidateCommitmentActivities = useMemo(
    () =>
      normalizeActivitiesForEditor(
        (roadmapCandidate?.CommitmentActivities || roadmapCandidate?.Activities || []) as string[],
      ),
    [roadmapCandidate],
  )
  const candidateImplementationActivities = useMemo(
    () => normalizeActivitiesForEditor((roadmapCandidate?.ImplementationActivities || []) as string[]),
    [roadmapCandidate],
  )
  const activeCandidateActivities =
    reviewActivityMode === 'implementation' ? candidateImplementationActivities : candidateCommitmentActivities
  const activeQuality =
    reviewActivityMode === 'implementation'
      ? roadmapCandidate?.ImplementationActivityQuality
      : roadmapCandidate?.CommitmentActivityQuality
  const reviewRows = useMemo(() => {
    const rank: Record<ActivityTag, number> = { FE: 0, BE: 1, AI: 2 }
    const rows = reviewActivities.map((activity, index) => {
      const parsed = parseActivityEntry(activity)
      const tags = parsed.tags.length ? parsed.tags : [inferActivityTag(parsed.text || activity)]
      return { activity, index, parsed: { text: parsed.text, tags } }
    })
    const filtered =
      reviewTagFilter === 'ALL' ? rows : rows.filter((row) => row.parsed.tags.includes(reviewTagFilter))
    filtered.sort((a, b) => {
      const aTag = a.parsed.tags[0] || 'BE'
      const bTag = b.parsed.tags[0] || 'BE'
      const byTag = rank[aTag] - rank[bTag]
      if (byTag !== 0) return reviewSortDir === 'asc' ? byTag : -byTag
      const byText = (a.parsed.text || '').localeCompare(b.parsed.text || '', undefined, { sensitivity: 'base' })
      if (byText !== 0) return reviewSortDir === 'asc' ? byText : -byText
      return reviewSortDir === 'asc' ? a.index - b.index : b.index - a.index
    })
    return filtered
  }, [reviewActivities, reviewTagFilter, reviewSortDir])
  const isUnderstandingPending = selectedIntakeItem?.status === 'understanding_pending'
  const normalizedIntent = (understandingIntent || '').trim()
  const isIntentUnclear = !normalizedIntent || normalizedIntent.toLowerCase() === 'document intent is unclear.'
  const understandingOutcomes = understandingOutcomesText
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
  const docById = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents])
  const bucketDocIds = useMemo(
    () => new Set(roadmapItems.map((r) => r.source_document_id).filter((id): id is number => id !== null)),
    [roadmapItems],
  )

  const queueRows = useMemo(
    () =>
      documents
        .filter((doc) => !bucketDocIds.has(doc.id))
        .map((doc) => {
        const intake = intakeByDocument.get(doc.id)
        return {
          doc,
          intake,
          status: intake?.status || 'new',
          activitiesCount: intake?.activities.length || 0,
          title: intake?.title || '',
        }
      }),
    [documents, intakeByDocument, bucketDocIds],
  )

  const deletableDocIds = useMemo(() => {
    if (!canDeleteDocuments) return new Set<number>()
    const allowed = new Set<number>()
    for (const row of queueRows) {
      if (isCEO) {
        allowed.add(row.doc.id)
        continue
      }
      const status = (row.status || 'new').toLowerCase()
      const linkedToRoadmap = Boolean(row.intake?.roadmap_item_id)
      const isUnclearOrDraft = status === 'new' || status === 'draft' || status === 'understanding_pending'
      if (!linkedToRoadmap && isUnclearOrDraft) {
        allowed.add(row.doc.id)
      }
    }
    return allowed
  }, [queueRows, canDeleteDocuments, isCEO])

  const allDocumentsSelected =
    deletableDocIds.size > 0 && Array.from(deletableDocIds).every((docId) => selectedDocumentIds.includes(docId))

  useEffect(() => {
    if (!selectedDocumentIds.length) return
    setSelectedDocumentIds((ids) => ids.filter((id) => deletableDocIds.has(id)))
  }, [deletableDocIds, selectedDocumentIds.length, setSelectedDocumentIds])

  useEffect(() => {
    if (!selectedIntakeItem || !isUnderstandingPending) {
      setUnderstandingIntent('')
      setUnderstandingOutcomesText('')
      setUnderstandingTheme('')
      setUnderstandingConfidence('medium')
      return
    }
    const intent = understandingCheck?.['Primary intent (1 sentence)'] || ''
    const outcomes = understandingCheck?.['Explicit outcomes (bullet list)'] || []
    const theme = understandingCheck?.['Dominant capability/theme (1 phrase)'] || ''
    const rawConfidence = (understandingCheck?.Confidence || 'medium').toString().trim() || 'medium'
    const confidence = ['high', 'medium', 'low'].includes(rawConfidence.toLowerCase()) ? rawConfidence.toLowerCase() : 'medium'
    setUnderstandingIntent(intent)
    setUnderstandingOutcomesText(Array.isArray(outcomes) ? outcomes.join('\n') : '')
    setUnderstandingTheme(theme)
    setUnderstandingConfidence(confidence)
  }, [selectedIntakeItem?.id, isUnderstandingPending, understandingCheck])

  useEffect(() => {
    if (!selectedIntakeItem) {
      setReviewActivityMode('commitment')
      setReviewTagFilter('ALL')
      setReviewSortDir('asc')
      return
    }
    if (selectedActivityMode === 'implementation' || selectedActivityMode === 'commitment') {
      setReviewActivityMode(selectedActivityMode)
      if (selectedActivityMode === 'implementation' && candidateImplementationActivities.length > 0) {
        setReviewActivities(candidateImplementationActivities)
      } else if (selectedActivityMode === 'commitment' && candidateCommitmentActivities.length > 0) {
        setReviewActivities(candidateCommitmentActivities)
      }
      return
    }
    setReviewActivityMode('commitment')
  }, [
    selectedIntakeItem?.id,
    selectedActivityMode,
    candidateImplementationActivities,
    candidateCommitmentActivities,
    setReviewActivities,
  ])
  const prettyStage = (value: string) => value.replaceAll('_', ' ')
  const formatBucketType = (projectContext: string, initiativeType: string) =>
    `${projectContext === 'internal' ? 'Internal' : 'Client'} / ${initiativeType === 'new_product' ? 'New Product' : 'New Feature'}`
  const formatDeliveryMode = (mode: string) => (mode === 'rnd' ? 'R&D' : 'Standard')
  const uploadLabel =
    uploadFiles.length === 0
      ? 'Choose Documents'
      : uploadFiles.length === 1
        ? uploadFiles[0].name
        : `${uploadFiles.length} files selected`

  function seedFromIntake(item?: IntakeItem | null): IntakeSeedMeta {
    return {
      priority: item?.priority || 'medium',
      project_context: item?.project_context || 'client',
      initiative_type: item?.initiative_type || 'new_feature',
      delivery_mode: item?.delivery_mode || 'standard',
      rnd_hypothesis: item?.rnd_hypothesis || '',
      rnd_experiment_goal: item?.rnd_experiment_goal || '',
      rnd_success_criteria: item?.rnd_success_criteria || '',
      rnd_timebox_weeks: item?.rnd_timebox_weeks ?? null,
      rnd_decision_date: item?.rnd_decision_date || '',
      rnd_next_gate: item?.rnd_next_gate || '',
      rnd_risk_level: item?.rnd_risk_level || '',
    }
  }

  async function openPreview(doc: DocumentItem) {
    setPreviewError('')
    setPreviewLoading(true)
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const meta = await api<{
        mode: 'inline_file' | 'extracted_text' | 'download_only'
        file_type: string
        preview_text?: string
        preview_units?: Array<{ ref: string; text: string }>
      }>(
        `/documents/${doc.id}/preview`,
        {},
        token || undefined,
      )
      setPreviewTitle(doc.file_name)
      setPreviewMode(meta.mode)
      setPreviewText(meta.preview_text || '')
      setPreviewFileType((meta.file_type || '').toLowerCase())
      setPreviewUnits(meta.preview_units || [])
      if (meta.mode === 'inline_file' || meta.mode === 'download_only') {
        const { blob, contentType } = await fetchDocumentBlob(doc.id)
        const url = URL.createObjectURL(blob)
        setPreviewType(contentType || 'application/octet-stream')
        setPreviewUrl(url)
      } else {
        setPreviewType('')
        setPreviewUrl('')
      }
      setPreviewOpen(true)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  function closePreview() {
    setPreviewOpen(false)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setPreviewType('')
    setPreviewFileType('')
    setPreviewText('')
    setPreviewUnits([])
    setPreviewTitle('')
  }

  return (
    <>
      <main className="page-wrap">
        <section className="panel-card intake-queue-card">
        <div className="line-item">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3>Intake Queue</h3>
            <button className="ghost-btn small" type="button" onClick={() => setUploadSidebarOpen(true)}>
              + Upload Files
            </button>
          </div>
          {canDeleteDocuments && (
            <button
              className="ghost-btn tiny quiet-btn"
              type="button"
              disabled={busy || selectedDocumentIds.length === 0}
              onClick={bulkDeleteDocuments}
            >
              Delete Selected
            </button>
          )}
        </div>
        <div className="intake-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                {canDeleteDocuments && (
                  <th>
                    <input
                      type="checkbox"
                      checked={allDocumentsSelected}
                      onChange={(e) =>
                        setSelectedDocumentIds(e.target.checked ? Array.from(deletableDocIds) : [])
                      }
                    />
                  </th>
                )}
                <th className="col-file">File</th>
                <th className="col-type">Type</th>
                  <th className="col-title">Title</th>
                  <th className="col-stage">Stage</th>
                  <th className="col-bucket">Bucket Type</th>
                  <th className="col-mode">Mode</th>
                  <th className="col-priority">Priority</th>
                  <th className="col-activities">Activities</th>
                  <th className="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {queueRows.length === 0 && (
                <tr>
                    <td colSpan={canDeleteDocuments ? 10 : 9} className="muted">
                      No documents uploaded yet.
                    </td>
                  </tr>
                )}
              {queueRows.map((row) => {
                const rowDeletable = deletableDocIds.has(row.doc.id)
                return (
                <tr key={row.doc.id}>
                  {canDeleteDocuments && (
                    <td>
                      <input
                        type="checkbox"
                        disabled={!rowDeletable}
                        title={
                          rowDeletable
                            ? 'Select document'
                            : 'Only unclear/draft documents without roadmap linkage can be deleted for this role.'
                        }
                        checked={selectedDocumentIds.includes(row.doc.id)}
                        onChange={(e) =>
                          setSelectedDocumentIds((ids) =>
                            e.target.checked ? [...new Set([...ids, row.doc.id])] : ids.filter((id) => id !== row.doc.id),
                          )
                        }
                      />
                    </td>
                  )}
                  <td className="col-file" title={row.doc.file_name}>{row.doc.file_name}</td>
                  <td className="col-type"><span className="doc-chip">{row.doc.file_type.toUpperCase()}</span></td>
                  <td className="col-title" title={row.title || 'Pending'}><span className="intake-title">{row.title || <span className="muted">Pending</span>}</span></td>
                  <td className="col-stage">
                    {row.status === 'understanding_pending' ? (
                      <span className="intake-stage-text">{prettyStage(row.status)}</span>
                    ) : (
                      <span className={`status-badge ${row.status === 'approved' ? 'approved' : row.status === 'draft' ? 'draft' : 'pending'}`}>
                        {prettyStage(row.status)}
                      </span>
                    )}
                  </td>
                  <td className="col-bucket" title={row.intake ? formatBucketType(row.intake.project_context, row.intake.initiative_type) : '-'}><span className="bucket-text">{row.intake ? formatBucketType(row.intake.project_context, row.intake.initiative_type) : '-'}</span></td>
                  <td className="col-mode">{row.intake ? formatDeliveryMode(row.intake.delivery_mode) : '-'}</td>
                  <td className="col-priority">{row.intake ? row.intake.priority : '-'}</td>
                  <td className="col-activities">{row.activitiesCount > 0 ? row.activitiesCount : <span className="muted">None</span>}</td>
                  <td className="col-action">
                    <div className="doc-actions-inline">
                    <button
                      className="preview-action-btn"
                      type="button"
                      title="View document"
                      onClick={() => {
                        if (!token) {
                          setErrorMessage('Session expired. Please sign in again.')
                          return
                        }
                        void openPreview(row.doc)
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.9">
                        <path d="M1.5 12s3.8-6 10.5-6 10.5 6 10.5 6-3.8 6-10.5 6S1.5 12 1.5 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <button
                      className="ghost-btn tiny intake-action-btn"
                      type="button"
                      onClick={() => {
                        if (!token) {
                          setErrorMessage('Session expired. Please sign in again.')
                          return
                        }
                        const seed = seedFromIntake(row.intake || null)
                        setIntakeSeed(seed)
                        if (isCEO) {
                          setMetaModalDoc(row.doc)
                          return
                        }
                        void analyzeDocument(row.doc.id, seed)
                      }}
                    >
                      {row.intake ? 'Re-understand' : 'Understand'}
                    </button>
                    {row.intake && (
                      <button
                        className="intake-review-btn"
                        type="button"
                        onClick={() => {
                          if (!token) {
                            setErrorMessage('Session expired. Please sign in again.')
                            return
                          }
                          void startReview(row.intake!)
                        }}
                      >
                        Review
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel-card">
        <h3>{isUnderstandingPending ? 'Understanding Review' : 'Candidate Review'}</h3>
        {selectedIntakeItem ? (
          <div className="stack">
            {isUnderstandingPending ? (
              <>
                <div className="understanding-card">
                  <div className="understanding-row">
                    <span className="understanding-label">Primary intent</span>
                    <input
                      value={understandingIntent}
                      onChange={(e) => setUnderstandingIntent(e.target.value)}
                      placeholder="Primary intent (1 sentence)"
                    />
                  </div>
                  <div className="understanding-row">
                    <span className="understanding-label">Explicit outcomes</span>
                    <textarea
                      rows={4}
                      value={understandingOutcomesText}
                      onChange={(e) => setUnderstandingOutcomesText(e.target.value)}
                      placeholder="One outcome per line"
                    />
                  </div>
                  <div className="understanding-row">
                    <span className="understanding-label">Dominant theme</span>
                    <input
                      value={understandingTheme}
                      onChange={(e) => setUnderstandingTheme(e.target.value)}
                      placeholder="Dominant capability/theme"
                    />
                  </div>
                  <div className="understanding-row">
                    <span className="understanding-label">Confidence</span>
                    <select value={understandingConfidence} onChange={(e) => setUnderstandingConfidence(e.target.value)}>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="understanding-row">
                    <span className="understanding-label">Activity mode for generated candidate</span>
                    <div className="segmented-control">
                      <button
                        type="button"
                        className={reviewActivityMode === 'commitment' ? 'active' : ''}
                        onClick={() => setReviewActivityMode('commitment')}
                      >
                        Commitment ({candidateCommitmentActivities.length || reviewActivities.length})
                      </button>
                      <button
                        type="button"
                        className={reviewActivityMode === 'implementation' ? 'active' : ''}
                        onClick={() => setReviewActivityMode('implementation')}
                      >
                        Implementation ({candidateImplementationActivities.length || 0})
                      </button>
                    </div>
                    <p className="muted" style={{ margin: 0 }}>
                      Selected mode decides which activity list is written into Intake Draft.
                    </p>
                  </div>
                  <div className="understanding-meta">
                    <span>Outcomes captured: {understandingOutcomes.length}</span>
                    {llmRuntime && (
                      <span>
                        Model: {llmRuntime.provider || '-'} / {llmRuntime.model || '-'} ({llmRuntime.success ? 'success' : 'fallback'})
                      </span>
                    )}
                    {parserCoverage && (
                      <span>
                        Coverage: {parserCoverage.units_processed || 0} units
                        {parserCoverage.pages_detected && parserCoverage.pages_detected.length > 0
                          ? `, pages ${Math.min(...parserCoverage.pages_detected)}-${Math.max(...parserCoverage.pages_detected)}`
                          : ''}
                      </span>
                    )}
                  </div>
                  {!llmRuntime?.success && llmRuntime?.error && (
                    <p className="error-text">Provider failure reason: {llmRuntime.error}</p>
                  )}
                </div>
                {isIntentUnclear && (
                  <div className="error-text">
                    <p>Understanding intent is unclear. Edit the intent above or use intake support to regenerate.</p>
                    <ol>
                      <li>BA/PM can manually correct Primary intent, outcomes, and theme.</li>
                      <li>Save draft to keep corrected fields in Understanding Review state.</li>
                      <li>If needed, open support assistant to recreate understanding from document context.</li>
                    </ol>
                    <div className="row-actions">
                      <button
                        className="primary-btn tiny"
                        type="button"
                        onClick={() => selectedIntakeItem && requestIntakeSupport(selectedIntakeItem)}
                      >
                        Open Support Assistant
                      </button>
                      <button
                        className="ghost-btn tiny"
                        type="button"
                        onClick={() => {
                          const doc = docById.get(selectedIntakeItem.document_id)
                          if (doc) void openPreview(doc)
                        }}
                      >
                        View Document
                      </button>
                      <button className="ghost-btn tiny" type="button" onClick={() => navigate('/settings')}>
                        Open Settings
                      </button>
                      <button
                        className="ghost-btn tiny"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          analyzeDocument(selectedIntakeItem.document_id, {
                            priority: selectedIntakeItem.priority || 'medium',
                            project_context: selectedIntakeItem.project_context || 'client',
                            initiative_type: selectedIntakeItem.initiative_type || 'new_feature',
                            delivery_mode: selectedIntakeItem.delivery_mode || 'standard',
                            rnd_hypothesis: selectedIntakeItem.rnd_hypothesis || '',
                            rnd_experiment_goal: selectedIntakeItem.rnd_experiment_goal || '',
                            rnd_success_criteria: selectedIntakeItem.rnd_success_criteria || '',
                            rnd_timebox_weeks: selectedIntakeItem.rnd_timebox_weeks ?? null,
                            rnd_decision_date: selectedIntakeItem.rnd_decision_date || '',
                            rnd_next_gate: selectedIntakeItem.rnd_next_gate || '',
                            rnd_risk_level: selectedIntakeItem.rnd_risk_level || '',
                          })
                        }
                      >
                        Re-run Understanding
                      </button>
                    </div>
                  </div>
                )}
                <label>
                  Title
                  <input value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} />
                </label>
                <label>
                  Scope
                  <textarea rows={3} value={reviewScope} onChange={(e) => setReviewScope(e.target.value)} />
                </label>

                <div className="activity-editor">
                  <div className="line-item">
                    <strong>Activities (inline edit)</strong>
                    <div className="activity-filter-tools">
                      <span className="filter-label">Tag</span>
                      <select
                        value={reviewTagFilter}
                        onChange={(e) => setReviewTagFilter(e.target.value as 'ALL' | ActivityTag)}
                        title="Filter by tag"
                      >
                        <option value="ALL">All</option>
                        <option value="FE">FE</option>
                        <option value="BE">BE</option>
                        <option value="AI">AI</option>
                      </select>
                      <button
                        className="ghost-btn tiny"
                        type="button"
                        title="Toggle sort direction"
                        onClick={() => setReviewSortDir((s) => (s === 'asc' ? 'desc' : 'asc'))}
                      >
                        {reviewSortDir === 'asc' ? '↑' : '↓'}
                      </button>
                      <button className="ghost-btn tiny" type="button" onClick={addReviewActivity}>
                        + Add Activity
                      </button>
                    </div>
                  </div>
                  <table className="activity-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Tags</th>
                        <th>Activity</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewRows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="muted">
                            No activities for selected filter.
                          </td>
                        </tr>
                      )}
                      {reviewRows.map((row, rowIndex) => {
                        const activity = row.activity
                        const idx = row.index
                        const parsed = row.parsed
                        return (
                          <tr key={`${idx}-${activity}`}>
                            <td>{rowIndex + 1}</td>
                            <td>
                              <div className="activity-chip-row">
                                {ACTIVITY_TAGS.map((tag) => {
                                  const active = parsed.tags.includes(tag)
                                  return (
                                    <button
                                      key={`${idx}-${tag}`}
                                      className={`activity-tag-chip tag-${tag.toLowerCase()}${active ? ' active' : ' inactive'}`}
                                      type="button"
                                      onClick={() => toggleReviewActivityTag(idx, tag)}
                                    >
                                      {tag}
                                    </button>
                                  )
                                })}
                              </div>
                            </td>
                            <td>
                              <input
                                className="activity-input"
                                value={parsed.text}
                                onChange={(e) => updateReviewActivity(idx, e.target.value)}
                                placeholder="Enter activity"
                              />
                            </td>
                            <td>
                              <button className="ghost-btn tiny" type="button" onClick={() => removeReviewActivity(idx)}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {!isIntentUnclear && supportResolution?.applied && (
                  <p className="success-text">
                    Intake Support resolved understanding. Next step: approve understanding and generate candidate.
                  </p>
                )}
                <div className="split-2">
                  <button
                    className="ghost-btn"
                    type="button"
                    disabled={busy || !selectedIntakeItem}
                    onClick={async () => {
                      if (!selectedIntakeItem) return
                      const draft = await saveUnderstandingDraft(selectedIntakeItem.id, {
                        primary_intent: understandingIntent,
                        explicit_outcomes: understandingOutcomes,
                        dominant_theme: understandingTheme,
                        confidence: understandingConfidence,
                        activity_mode: reviewActivityMode,
                        expected_version_no: selectedIntakeItem.version_no,
                      })
                      await submitReview(
                        'understanding_pending',
                        draft.intake_item_version_no || selectedIntakeItem.version_no,
                      )
                    }}
                  >
                    Save Understanding Draft
                  </button>
                  <button
                    className="primary-btn"
                    type="button"
                    disabled={busy || isIntentUnclear}
                    onClick={() =>
                      approveUnderstanding(selectedIntakeItem.id, {
                        primary_intent: understandingIntent,
                        explicit_outcomes: understandingOutcomes,
                        dominant_theme: understandingTheme,
                        confidence: understandingConfidence,
                        activity_mode: reviewActivityMode,
                        expected_version_no: selectedIntakeItem.version_no,
                      })
                    }
                  >
                    Accept Understanding and Generate Candidate
                  </button>
                </div>
              </>
            ) : (
              <>
            <label>
              Title
              <input value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} />
            </label>
            {selectedIntakeItem.delivery_mode === 'rnd' && (
              <details className="evidence-block">
                <summary>R&D Framing</summary>
                <ul>
                  <li>Hypothesis: {selectedIntakeItem.rnd_hypothesis || '-'}</li>
                  <li>Experiment goal: {selectedIntakeItem.rnd_experiment_goal || '-'}</li>
                  <li>Success criteria: {selectedIntakeItem.rnd_success_criteria || '-'}</li>
                  <li>Timebox (weeks): {selectedIntakeItem.rnd_timebox_weeks ?? '-'}</li>
                  <li>Decision date: {selectedIntakeItem.rnd_decision_date || '-'}</li>
                  <li>Next gate: {selectedIntakeItem.rnd_next_gate || '-'}</li>
                  <li>Risk level: {selectedIntakeItem.rnd_risk_level || '-'}</li>
                </ul>
              </details>
            )}
            <label>
              Scope
              <textarea rows={3} value={reviewScope} onChange={(e) => setReviewScope(e.target.value)} />
            </label>
            {(candidateCommitmentActivities.length > 0 || candidateImplementationActivities.length > 0) && (
              <div className="candidate-activity-tabs">
                <div className="line-item">
                  <strong>Generated Activity Sets</strong>
                  <button
                    className="ghost-btn tiny"
                    type="button"
                    onClick={() => setReviewActivities(activeCandidateActivities)}
                  >
                    Load Selected List
                  </button>
                </div>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={reviewActivityMode === 'commitment' ? 'active' : ''}
                    onClick={() => {
                      setReviewActivityMode('commitment')
                      setReviewActivities(candidateCommitmentActivities)
                    }}
                  >
                    Commitment ({candidateCommitmentActivities.length})
                  </button>
                  <button
                    type="button"
                    className={reviewActivityMode === 'implementation' ? 'active' : ''}
                    onClick={() => {
                      setReviewActivityMode('implementation')
                      setReviewActivities(candidateImplementationActivities)
                    }}
                  >
                    Implementation ({candidateImplementationActivities.length})
                  </button>
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  Quality score: {activeQuality?.average_score ?? '-'} / 100, weak items: {activeQuality?.weak_count ?? '-'}.
                </p>
              </div>
            )}

            <div className="activity-editor">
              <div className="line-item">
                <strong>Activities (inline edit)</strong>
                <div className="activity-filter-tools">
                  <span className="filter-label">Tag</span>
                  <select
                    value={reviewTagFilter}
                    onChange={(e) => setReviewTagFilter(e.target.value as 'ALL' | ActivityTag)}
                    title="Filter by tag"
                  >
                    <option value="ALL">All</option>
                    <option value="FE">FE</option>
                    <option value="BE">BE</option>
                    <option value="AI">AI</option>
                  </select>
                  <button
                    className="ghost-btn tiny"
                    type="button"
                    title="Toggle sort direction"
                    onClick={() => setReviewSortDir((s) => (s === 'asc' ? 'desc' : 'asc'))}
                  >
                    {reviewSortDir === 'asc' ? '↑' : '↓'}
                  </button>
                  <button className="ghost-btn tiny" type="button" onClick={addReviewActivity}>
                    + Add Activity
                  </button>
                </div>
              </div>
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tags</th>
                    <th>Activity</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        No activities for selected filter.
                      </td>
                    </tr>
                  )}
                  {reviewRows.map((row, rowIndex) => {
                    const activity = row.activity
                    const idx = row.index
                    const parsed = row.parsed
                    return (
                    <tr key={`${idx}-${activity}`}>
                      <td>{rowIndex + 1}</td>
                      <td>
                        <div className="activity-chip-row">
                          {ACTIVITY_TAGS.map((tag) => {
                            const active = parsed.tags.includes(tag)
                            return (
                              <button
                                key={`${idx}-${tag}`}
                                className={`activity-tag-chip tag-${tag.toLowerCase()}${active ? ' active' : ' inactive'}`}
                                type="button"
                                onClick={() => toggleReviewActivityTag(idx, tag)}
                              >
                                {tag}
                              </button>
                            )
                          })}
                        </div>
                      </td>
                      <td>
                        <input
                          className="activity-input"
                          value={parsed.text}
                          onChange={(e) => updateReviewActivity(idx, e.target.value)}
                          placeholder="Enter activity"
                        />
                      </td>
                      <td>
                        <button className="ghost-btn tiny" type="button" onClick={() => removeReviewActivity(idx)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>

            <details className="evidence-block">
              <summary>
                Evidence References ({selectedIntakeItem.source_quotes.length})
              </summary>
              <p className="muted">
                Traceability links used by the agent. These are reference IDs, not copied text.
              </p>
              <ul>
                {selectedIntakeItem.source_quotes.map((quote, i) => (
                  <li key={`${quote}-${i}`}>{quote}</li>
                ))}
              </ul>
            </details>

            <div className="split-2">
              <button className="ghost-btn" type="button" onClick={() => submitReview('draft')} disabled={busy}>
                Save Draft
              </button>
              <button className="primary-btn" type="button" onClick={() => submitReview('approved')} disabled={busy}>
                Approve to Commitments
              </button>
            </div>
              </>
            )}
          </div>
        ) : (
          <p className="muted">Select a row in Intake Queue first.</p>
        )}
      </section>

      <section className="panel-card">
        <h3>Intake Version History</h3>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {intakeHistory.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No history yet.
                </td>
              </tr>
            )}
            {intakeHistory.map((v) => (
              <tr key={v.id}>
                <td>{fmtDateTime(v.created_at)}</td>
                <td>{v.action}</td>
                <td>{v.changed_by_email || (v.changed_by ? `User ${v.changed_by}` : 'Agent')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {previewOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card doc-preview-modal">
            <div className="doc-preview-head">
              <div className="doc-preview-title-wrap">
                <h3>{previewTitle}</h3>
                {previewFileType && <span className="doc-preview-type">{previewFileType.toUpperCase()}</span>}
              </div>
              <button className="ghost-btn tiny" type="button" onClick={closePreview}>
                Close
              </button>
            </div>
            <div className="doc-preview-body">
              {previewLoading && <p className="muted">Loading preview...</p>}
              {!!previewError && <p className="error-text">{previewError}</p>}
              {!previewLoading && !previewError && previewMode === 'inline_file' && previewType.startsWith('image/') && (
                <img className="doc-preview-image" src={previewUrl} alt={previewTitle} />
              )}
              {!previewLoading && !previewError && previewMode === 'inline_file' && !previewType.startsWith('image/') && (
                <iframe className="doc-preview-frame" src={previewUrl} title={previewTitle} />
              )}
              {!previewLoading &&
                !previewError &&
                previewMode === 'extracted_text' && (
                  <div className="stack">
                    <p className="muted">
                      Structured preview for {previewFileType.toUpperCase() || 'document'} (Word/PPT/Excel are shown as parsed content).
                    </p>
                    {previewUnits.length > 0 ? (
                      <div className="doc-preview-units">
                        {previewUnits.map((unit, idx) => (
                          <div key={`${unit.ref}-${idx}`} className="doc-preview-unit">
                            <div className="doc-preview-ref">{unit.ref || `item:${idx + 1}`}</div>
                            <div className="doc-preview-value">{unit.text}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <pre className="doc-preview-text">{previewText || 'No readable text found in document.'}</pre>
                    )}
                  </div>
                )}
              {!previewLoading &&
                !previewError &&
                previewMode === 'download_only' && (
                  <div className="doc-preview-fallback">
                    <p className="muted">Preview is not available for this file type.</p>
                    <a className="ghost-btn tiny" href={previewUrl} target="_blank" rel="noreferrer">
                      Open File
                    </a>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {metaModalDoc && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card metadata-modal">
            <h3>Set Bucket Metadata</h3>
            <p className="muted">{metaModalDoc.file_name}</p>
            <div className="stack">
              <label>
                Delivery Mode
                <select
                  value={intakeSeed.delivery_mode}
                  onChange={(e) =>
                    setIntakeSeed((s) => ({
                      ...s,
                      delivery_mode: e.target.value,
                      rnd_hypothesis: e.target.value === 'rnd' ? s.rnd_hypothesis : '',
                      rnd_experiment_goal: e.target.value === 'rnd' ? s.rnd_experiment_goal : '',
                      rnd_success_criteria: e.target.value === 'rnd' ? s.rnd_success_criteria : '',
                      rnd_timebox_weeks: e.target.value === 'rnd' ? s.rnd_timebox_weeks : null,
                      rnd_decision_date: e.target.value === 'rnd' ? s.rnd_decision_date : '',
                      rnd_next_gate: e.target.value === 'rnd' ? s.rnd_next_gate : '',
                      rnd_risk_level: e.target.value === 'rnd' ? s.rnd_risk_level : '',
                    }))
                  }
                >
                  <option value="standard">Standard</option>
                  <option value="rnd" disabled={!canEnterRndFromIntake}>
                    R&D
                  </option>
                </select>
              </label>
              {!canEnterRndFromIntake && (
                <p className="muted">R&D intake entry is restricted to VP role.</p>
              )}
              <label>
                Project Context
                <select
                  value={intakeSeed.project_context}
                  onChange={(e) => setIntakeSeed((s) => ({ ...s, project_context: e.target.value }))}
                >
                  <option value="client">Client Project</option>
                  <option value="internal">Internal Product Development</option>
                </select>
              </label>
              <label>
                Initiative Type
                <select
                  value={intakeSeed.initiative_type}
                  onChange={(e) => setIntakeSeed((s) => ({ ...s, initiative_type: e.target.value }))}
                >
                  <option value="new_feature">New Feature to Existing Product</option>
                  <option value="new_product">New Product</option>
                </select>
              </label>
              <label>
                Priority
                <select
                  value={intakeSeed.priority}
                  onChange={(e) => setIntakeSeed((s) => ({ ...s, priority: e.target.value }))}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              {intakeSeed.delivery_mode === 'rnd' && (
                <>
                  <label>
                    Hypothesis
                    <textarea
                      rows={2}
                      value={intakeSeed.rnd_hypothesis}
                      onChange={(e) => setIntakeSeed((s) => ({ ...s, rnd_hypothesis: e.target.value }))}
                    />
                  </label>
                  <label>
                    Experiment Goal
                    <textarea
                      rows={2}
                      value={intakeSeed.rnd_experiment_goal}
                      onChange={(e) => setIntakeSeed((s) => ({ ...s, rnd_experiment_goal: e.target.value }))}
                    />
                  </label>
                  <label>
                    Success Criteria
                    <textarea
                      rows={2}
                      value={intakeSeed.rnd_success_criteria}
                      onChange={(e) => setIntakeSeed((s) => ({ ...s, rnd_success_criteria: e.target.value }))}
                    />
                  </label>
                  <div className="split-2">
                    <label>
                      Timebox (weeks)
                      <input
                        type="number"
                        min={1}
                        value={intakeSeed.rnd_timebox_weeks ?? ''}
                        onChange={(e) =>
                          setIntakeSeed((s) => ({
                            ...s,
                            rnd_timebox_weeks: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Decision Date
                      <input
                        type="date"
                        value={intakeSeed.rnd_decision_date}
                        onChange={(e) => setIntakeSeed((s) => ({ ...s, rnd_decision_date: e.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="split-2">
                    <label>
                      Next Gate
                      <select
                        value={intakeSeed.rnd_next_gate}
                        onChange={(e) => setIntakeSeed((s) => ({ ...s, rnd_next_gate: e.target.value }))}
                      >
                        <option value="">Select</option>
                        <option value="continue">Continue</option>
                        <option value="pivot">Pivot</option>
                        <option value="stop">Stop</option>
                        <option value="productize">Productize</option>
                      </select>
                    </label>
                    <label>
                      Risk Level
                      <select
                        value={intakeSeed.rnd_risk_level}
                        onChange={(e) => setIntakeSeed((s) => ({ ...s, rnd_risk_level: e.target.value }))}
                      >
                        <option value="">Select</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </label>
                  </div>
                </>
              )}
            </div>
            <div className="row-actions">
              <button className="ghost-btn" type="button" onClick={() => setMetaModalDoc(null)}>
                Cancel
              </button>
              <button
                className="primary-btn"
                type="button"
                disabled={busy}
                onClick={async () => {
                  await analyzeDocument(metaModalDoc.id, intakeSeed)
                  setMetaModalDoc(null)
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      {manualModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>Manual Intake Entry</h3>
            <div className="stack">
              <label>
                Title
                <input
                  value={manualForm.title}
                  onChange={(e) => setManualForm((s) => ({ ...s, title: e.target.value }))}
                />
              </label>
              <label>
                Scope
                <textarea
                  rows={3}
                  value={manualForm.scope}
                  onChange={(e) => setManualForm((s) => ({ ...s, scope: e.target.value }))}
                />
              </label>
              <label>
                Activities (one per line)
                <textarea
                  rows={4}
                  value={manualForm.activities.join('\n')}
                  onChange={(e) =>
                    setManualForm((s) => ({
                      ...s,
                      activities: e.target.value
                        .split('\n')
                        .map((x) => x.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </label>
              <div className="split-2">
                <label>
                  Priority
                  <select
                    value={manualForm.priority}
                    onChange={(e) => setManualForm((s) => ({ ...s, priority: e.target.value }))}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
                <label>
                  Project Context
                  <select
                    value={manualForm.project_context}
                    onChange={(e) => setManualForm((s) => ({ ...s, project_context: e.target.value }))}
                  >
                    <option value="client">Client Project</option>
                    <option value="internal">Internal Product Development</option>
                  </select>
                </label>
              </div>
              <label>
                Initiative Type
                <select
                  value={manualForm.initiative_type}
                  onChange={(e) => setManualForm((s) => ({ ...s, initiative_type: e.target.value }))}
                >
                  <option value="new_feature">New Feature to Existing Product</option>
                  <option value="new_product">New Product</option>
                </select>
              </label>
              <label>
                Delivery Mode
                <select
                  value={manualForm.delivery_mode}
                  onChange={(e) =>
                    setManualForm((s) => ({
                      ...s,
                      delivery_mode: e.target.value,
                      rnd_hypothesis: e.target.value === 'rnd' ? s.rnd_hypothesis : '',
                      rnd_experiment_goal: e.target.value === 'rnd' ? s.rnd_experiment_goal : '',
                      rnd_success_criteria: e.target.value === 'rnd' ? s.rnd_success_criteria : '',
                      rnd_timebox_weeks: e.target.value === 'rnd' ? s.rnd_timebox_weeks : null,
                      rnd_decision_date: e.target.value === 'rnd' ? s.rnd_decision_date : '',
                      rnd_next_gate: e.target.value === 'rnd' ? s.rnd_next_gate : '',
                      rnd_risk_level: e.target.value === 'rnd' ? s.rnd_risk_level : '',
                    }))
                  }
                >
                  <option value="standard">Standard</option>
                  <option value="rnd" disabled={!canEnterRndFromIntake}>
                    R&D
                  </option>
                </select>
              </label>
              {!canEnterRndFromIntake && (
                <p className="muted">R&D intake entry is restricted to VP role.</p>
              )}
              {manualForm.delivery_mode === 'rnd' && (
                <>
                  <label>
                    Hypothesis
                    <textarea
                      rows={2}
                      value={manualForm.rnd_hypothesis}
                      onChange={(e) => setManualForm((s) => ({ ...s, rnd_hypothesis: e.target.value }))}
                    />
                  </label>
                  <label>
                    Experiment Goal
                    <textarea
                      rows={2}
                      value={manualForm.rnd_experiment_goal}
                      onChange={(e) => setManualForm((s) => ({ ...s, rnd_experiment_goal: e.target.value }))}
                    />
                  </label>
                  <label>
                    Success Criteria
                    <textarea
                      rows={2}
                      value={manualForm.rnd_success_criteria}
                      onChange={(e) => setManualForm((s) => ({ ...s, rnd_success_criteria: e.target.value }))}
                    />
                  </label>
                  <div className="split-2">
                    <label>
                      Timebox (weeks)
                      <input
                        type="number"
                        min={1}
                        value={manualForm.rnd_timebox_weeks ?? ''}
                        onChange={(e) =>
                          setManualForm((s) => ({
                            ...s,
                            rnd_timebox_weeks: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Decision Date
                      <input
                        type="date"
                        value={manualForm.rnd_decision_date}
                        onChange={(e) => setManualForm((s) => ({ ...s, rnd_decision_date: e.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="split-2">
                    <label>
                      Next Gate
                      <select
                        value={manualForm.rnd_next_gate}
                        onChange={(e) => setManualForm((s) => ({ ...s, rnd_next_gate: e.target.value }))}
                      >
                        <option value="">Select</option>
                        <option value="continue">Continue</option>
                        <option value="pivot">Pivot</option>
                        <option value="stop">Stop</option>
                        <option value="productize">Productize</option>
                      </select>
                    </label>
                    <label>
                      Risk Level
                      <select
                        value={manualForm.rnd_risk_level}
                        onChange={(e) => setManualForm((s) => ({ ...s, rnd_risk_level: e.target.value }))}
                      >
                        <option value="">Select</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </label>
                  </div>
                </>
              )}
            </div>
            <div className="row-actions">
              <button className="ghost-btn" type="button" onClick={() => setManualModalOpen(false)}>
                Cancel
              </button>
              <button
                className="primary-btn"
                type="button"
                disabled={busy || !manualForm.title.trim() || (manualForm.delivery_mode === 'rnd' && !canEnterRndFromIntake)}
                onClick={async () => {
                  await createManualIntake(manualForm)
                  setManualModalOpen(false)
                  setManualForm({
                    title: '',
                    scope: '',
                    activities: [],
                    priority: 'medium',
                    project_context: 'client',
                    initiative_type: 'new_feature',
                    delivery_mode: 'standard',
                    rnd_hypothesis: '',
                    rnd_experiment_goal: '',
                    rnd_success_criteria: '',
                    rnd_timebox_weeks: null,
                    rnd_decision_date: '',
                    rnd_next_gate: '',
                    rnd_risk_level: '',
                  })
                }}
              >
                Create Intake
              </button>
            </div>
          </div>
        </div>
      )}
      </main>

      {/* Upload Sidebar - moved outside main to fix pointer events */}
      {uploadSidebarOpen && (
        <div className="upload-sidebar-backdrop open" onClick={() => setUploadSidebarOpen(false)} />
      )}
      <div className={`upload-sidebar ${uploadSidebarOpen ? 'open' : 'closed'}`}>
        <div className="upload-sidebar-header">
          <h3>Upload Documents</h3>
          <button className="icon-only" type="button" onClick={() => setUploadSidebarOpen(false)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="upload-sidebar-content">
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: 0 }}>
            Upload BRD/PPT/Excel/CSV/RFP to classify and extract activities for project bucket placement.
          </p>

          <form className="upload-inline" onSubmit={handleUpload}>
            <input
              key={uploadPickerKey}
              ref={uploadInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.xls,.csv,.txt,.md,.json,.xml,.html"
              className="upload-file-hidden"
              onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
            />
            <button
              className="ghost-btn"
              type="button"
              onClick={() => uploadInputRef.current?.click()}
            >
              {uploadLabel}
            </button>
            <input
              className="upload-notes"
              placeholder="Notes"
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
            />
            <button
              className="primary-btn"
              disabled={uploadFiles.length === 0}
              type="submit"
            >
              Upload All
            </button>
            <button className="ghost-btn" type="button" onClick={() => setManualModalOpen(true)}>
              Manual Entry
            </button>
          </form>
          {uploadMessage && <div className="success-note">{uploadMessage}</div>}
        </div>
      </div>
    </>
  )
}

type RoadmapProps = {
  roadmapItems: RoadmapItem[]
  roadmapPlanItems: RoadmapPlanItem[]
  roadmapRedundancy: RoadmapRedundancy[]
  roadmapRedundancyError: string
  documents: DocumentItem[]
  selectedRoadmapItem: RoadmapItem | null
  startRoadmapEdit: (item: RoadmapItem) => Promise<void>
  roadmapTitle: string
  setRoadmapTitle: Dispatch<SetStateAction<string>>
  roadmapScope: string
  setRoadmapScope: Dispatch<SetStateAction<string>>
  roadmapActivities: string[]
  setRoadmapActivities: Dispatch<SetStateAction<string[]>>
  roadmapProjectContext: string
  setRoadmapProjectContext: Dispatch<SetStateAction<string>>
  roadmapInitiativeType: string
  setRoadmapInitiativeType: Dispatch<SetStateAction<string>>
  roadmapDeliveryMode: string
  setRoadmapDeliveryMode: Dispatch<SetStateAction<string>>
  roadmapRndHypothesis: string
  roadmapRndExperimentGoal: string
  roadmapRndSuccessCriteria: string
  roadmapRndTimeboxWeeks: number | null
  roadmapRndDecisionDate: string
  roadmapRndNextGate: string
  roadmapRndRiskLevel: string
  roadmapFeFte: string
  setRoadmapFeFte: Dispatch<SetStateAction<string>>
  roadmapBeFte: string
  setRoadmapBeFte: Dispatch<SetStateAction<string>>
  roadmapAiFte: string
  setRoadmapAiFte: Dispatch<SetStateAction<string>>
  roadmapPmFte: string
  setRoadmapPmFte: Dispatch<SetStateAction<string>>
  roadmapAccountablePerson: string
  setRoadmapAccountablePerson: Dispatch<SetStateAction<string>>
  setRoadmapPickedUp: Dispatch<SetStateAction<boolean>>
  isCEO: boolean
  isVP: boolean
  canManageCommitments: boolean
  setSelectedRoadmapIds: Dispatch<SetStateAction<number[]>>
  bulkDeleteRoadmap: (idsOverride?: number[]) => Promise<void>
  roadmapMove: {
    tentative_duration_weeks: string
    pickup_period: string
    completion_period: string
  }
  setRoadmapMove: Dispatch<
    SetStateAction<{
      tentative_duration_weeks: string
      pickup_period: string
      completion_period: string
    }>
  >
  validateCapacity: (payload: {
    project_context: string
    tentative_duration_weeks: number
    planned_start_date?: string
    planned_end_date?: string
    fe_fte: number
    be_fte: number
    ai_fte: number
    pm_fte: number
    exclude_bucket_item_id?: number
  }) => Promise<CapacityValidationResult>
  saveRoadmapCandidate: (itemId: number) => Promise<void>
  commitSelectedToRoadmap: (itemId: number) => Promise<void>
  unlockRoadmapCommitment: (itemId: number) => Promise<void>
  moveRoadmapCandidateToRnd: (itemId: number) => Promise<void>
  applyRedundancyDecision: (
    itemId: number,
    action: 'merge' | 'keep_both' | 'intentional_overlap',
    otherItemId: number,
  ) => Promise<void>
  busy: boolean
}

function RoadmapPage({
  roadmapItems,
  roadmapPlanItems,
  roadmapRedundancy,
  roadmapRedundancyError,
  documents,
  selectedRoadmapItem,
  startRoadmapEdit,
  roadmapTitle,
  setRoadmapTitle,
  roadmapScope,
  setRoadmapScope,
  roadmapActivities,
  setRoadmapActivities,
  roadmapProjectContext,
  setRoadmapProjectContext,
  roadmapInitiativeType,
  setRoadmapInitiativeType,
  roadmapDeliveryMode,
  setRoadmapDeliveryMode,
  roadmapRndHypothesis,
  roadmapRndExperimentGoal,
  roadmapRndSuccessCriteria,
  roadmapRndTimeboxWeeks,
  roadmapRndDecisionDate,
  roadmapRndNextGate,
  roadmapRndRiskLevel,
  roadmapFeFte,
  setRoadmapFeFte,
  roadmapBeFte,
  setRoadmapBeFte,
  roadmapAiFte,
  setRoadmapAiFte,
  roadmapPmFte,
  setRoadmapPmFte,
  roadmapAccountablePerson,
  setRoadmapAccountablePerson,
  setRoadmapPickedUp,
  isCEO,
  isVP,
  canManageCommitments,
  setSelectedRoadmapIds,
  bulkDeleteRoadmap,
  roadmapMove,
  setRoadmapMove,
  validateCapacity,
  saveRoadmapCandidate,
  commitSelectedToRoadmap,
  unlockRoadmapCommitment,
  moveRoadmapCandidateToRnd,
  applyRedundancyDecision,
  busy,
}: RoadmapProps) {
  const [readiness, setReadiness] = useState<'explore_later' | 'shape_this_quarter' | 'ready_to_commit'>('shape_this_quarter')
  const [horizon, setHorizon] = useState<'near_term' | 'mid_term' | 'long_term' | ''>('')
  const [capacityValidation, setCapacityValidation] = useState<CapacityValidationResult | null>(null)
  const [capacityValidationBusy, setCapacityValidationBusy] = useState(false)
  const [capacityValidationError, setCapacityValidationError] = useState('')

  const docMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const doc of documents) map.set(doc.id, doc.file_name)
    return map
  }, [documents])
  const planByBucketItem = useMemo(() => {
    const map = new Map<number, RoadmapPlanItem>()
    for (const item of roadmapPlanItems) {
      if (!map.has(item.bucket_item_id)) map.set(item.bucket_item_id, item)
    }
    return map
  }, [roadmapPlanItems])
  const redundancyByItem = useMemo(() => {
    const map = new Map<number, RoadmapRedundancy>()
    for (const row of roadmapRedundancy) map.set(row.item_id, row)
    return map
  }, [roadmapRedundancy])
  const selectedPlan = selectedRoadmapItem ? planByBucketItem.get(selectedRoadmapItem.id) || null : null
  const isLocked = Boolean(selectedRoadmapItem && selectedPlan)
  const canCommit = readiness === 'ready_to_commit'
  const hasDuration = Number.isFinite(Number(roadmapMove.tentative_duration_weeks))
    && Number(roadmapMove.tentative_duration_weeks) > 0
  const hasResourceFte =
    (Number(roadmapFeFte) || 0) + (Number(roadmapBeFte) || 0) + (Number(roadmapAiFte) || 0) + (Number(roadmapPmFte) || 0) > 0
  const capacityApproved = !capacityValidation || capacityValidation.status === 'APPROVED'
  const commitBlockers: string[] = []
  if (!canCommit) commitBlockers.push('Set Readiness to "Ready to commit".')
  if (!hasDuration) commitBlockers.push('Set tentative duration (weeks).')
  if (!hasResourceFte) commitBlockers.push('Set FE/BE/AI/PM FTE values.')
  if (!capacityApproved) commitBlockers.push(capacityValidation?.reason || 'Capacity is overallocated for one or more roles.')
  const knownOwners = useMemo(() => {
    const owners = roadmapItems.map((item) => item.accountable_person.trim()).filter(Boolean)
    return Array.from(new Set(owners))
  }, [roadmapItems])

  const formatInitiative = (initiativeType: string) =>
    initiativeType === 'new_product' ? 'New Product' : 'New Feature'
  const formatPriority = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : 'Medium')
  const horizonLabel = (value: string) => {
    if (value === 'near_term') return 'Near-term'
    if (value === 'mid_term') return 'Mid-term'
    if (value === 'long_term') return 'Long-term'
    return ''
  }

  useEffect(() => {
    if (!selectedRoadmapItem) return
    setSelectedRoadmapIds([selectedRoadmapItem.id])
    if (selectedPlan) {
      setReadiness('ready_to_commit')
      return
    }
    if (selectedRoadmapItem.picked_up && selectedRoadmapItem.accountable_person.trim()) {
      setReadiness('ready_to_commit')
      return
    }
    if (selectedRoadmapItem.scope.toLowerCase().includes('defer')) {
      setReadiness('explore_later')
      return
    }
    setReadiness('shape_this_quarter')
  }, [selectedRoadmapItem, selectedPlan, setSelectedRoadmapIds])

  useEffect(() => {
    const value = roadmapMove.pickup_period.toLowerCase()
    if (value.includes('near')) setHorizon('near_term')
    else if (value.includes('mid')) setHorizon('mid_term')
    else if (value.includes('long')) setHorizon('long_term')
    else setHorizon('')
  }, [roadmapMove.pickup_period])

  useEffect(() => {
    if (!selectedRoadmapItem) {
      setCapacityValidation(null)
      setCapacityValidationError('')
      return
    }
    const weeks = Number(roadmapMove.tentative_duration_weeks)
    if (!Number.isFinite(weeks) || weeks <= 0) {
      setCapacityValidation(null)
      setCapacityValidationError('')
      return
    }
    const fe = Number(roadmapFeFte) || 0
    const be = Number(roadmapBeFte) || 0
    const ai = Number(roadmapAiFte) || 0
    const pm = Number(roadmapPmFte) || 0
    if (fe + be + ai + pm <= 0) {
      setCapacityValidation(null)
      setCapacityValidationError('')
      return
    }
    const timer = setTimeout(() => {
      setCapacityValidationBusy(true)
      setCapacityValidationError('')
      validateCapacity({
        project_context: selectedRoadmapItem.project_context,
        tentative_duration_weeks: weeks,
        fe_fte: Math.max(0, fe),
        be_fte: Math.max(0, be),
        ai_fte: Math.max(0, ai),
        pm_fte: Math.max(0, pm),
        exclude_bucket_item_id: selectedRoadmapItem.id,
      })
        .then((res) => setCapacityValidation(res))
        .catch((err) => {
          setCapacityValidation(null)
          setCapacityValidationError(err instanceof Error ? err.message : 'Capacity validation failed')
        })
        .finally(() => setCapacityValidationBusy(false))
    }, 280)
    return () => clearTimeout(timer)
  }, [
    selectedRoadmapItem,
    roadmapMove.tentative_duration_weeks,
    roadmapFeFte,
    roadmapBeFte,
    roadmapAiFte,
    roadmapPmFte,
    validateCapacity,
  ])

  function candidateStatus(item: RoadmapItem): 'Unshaped' | 'Ready for Commit' | 'Deferred' | 'Committed' {
    if (planByBucketItem.get(item.id)) return 'Committed'
    if (selectedRoadmapItem?.id === item.id && readiness === 'explore_later') return 'Deferred'
    if (item.picked_up && item.accountable_person.trim()) return 'Ready for Commit'
    return 'Unshaped'
  }

  function canDeleteCandidate(item: RoadmapItem): boolean {
    if (!canManageCommitments) return false
    if (isCEO) return true
    if (isVP) return !planByBucketItem.has(item.id)
    return false
  }

  function selectCandidate(item: RoadmapItem) {
    void startRoadmapEdit(item)
    const plan = planByBucketItem.get(item.id)
    if (plan) {
      setRoadmapMove({
        tentative_duration_weeks: plan.tentative_duration_weeks ? String(plan.tentative_duration_weeks) : '',
        pickup_period: plan.pickup_period || '',
        completion_period: plan.completion_period || '',
      })
      return
    }
    setRoadmapMove({ tentative_duration_weeks: '', pickup_period: '', completion_period: '' })
  }

  function addRoadmapActivity() {
    setRoadmapActivities((items) => [...items, '[BE]'])
  }

  function updateRoadmapActivity(index: number, value: string) {
    setRoadmapActivities((items) =>
      items.map((it, i) => {
        if (i !== index) return it
        const parsed = parseActivityEntry(it)
        const tags = parsed.tags.length ? parsed.tags : [inferActivityTag(value)]
        return formatActivityEntry(value, tags)
      }),
    )
  }

  function toggleRoadmapActivityTag(index: number, tag: ActivityTag) {
    setRoadmapActivities((items) =>
      items.map((it, i) => {
        if (i !== index) return it
        const parsed = parseActivityEntry(it)
        const has = parsed.tags.includes(tag)
        let nextTags = has ? parsed.tags.filter((t) => t !== tag) : [...parsed.tags, tag]
        if (nextTags.length === 0) nextTags = ['BE']
        return formatActivityEntry(parsed.text, nextTags)
      }),
    )
  }

  function removeRoadmapActivity(index: number) {
    setRoadmapActivities((items) => items.filter((_, i) => i !== index))
  }

  return (
    <main className="commitment-workspace">
      <aside className="commitment-inbox">
        <div className="inbox-head">
          <h2>Commitment Candidates</h2>
          <p>Stage: Pre-Roadmap Planning</p>
          <p className="inbox-debug">
            Redundancy loaded: {roadmapRedundancy.length}/{roadmapItems.length}
          </p>
          {roadmapRedundancyError && <p className="inbox-warning">Redundancy check unavailable: {roadmapRedundancyError}</p>}
        </div>
        <div className="inbox-list">
          {roadmapItems.length === 0 && <p className="muted">No commitment candidates yet.</p>}
          {roadmapItems.map((item) => {
            const isActive = selectedRoadmapItem?.id === item.id
            const status = candidateStatus(item)
            const dup = redundancyByItem.get(item.id)
            return (
              <button
                key={item.id}
                type="button"
                className={`inbox-item${isActive ? ' active' : ''}`}
                onClick={() => selectCandidate(item)}
              >
                <div className="inbox-title-row">
                  <strong>{item.title}</strong>
                  <div className="inbox-actions">
                    <span className="inbox-state">{status}</span>
                    {canDeleteCandidate(item) && isActive && (
                      <button
                        className="inbox-delete"
                        type="button"
                        title="Delete candidate"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation()
                          void bulkDeleteRoadmap([item.id])
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 7h2v8h-2v-8zm4 0h2v8h-2v-8zM7 10h2v8H7v-8z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <p className="inbox-meta">
                  {`${formatPriority(item.priority)} • ${item.project_context === 'client' ? 'Client' : 'Internal'} • ${item.delivery_mode === 'rnd' ? 'R&D' : 'Standard'} • ${formatInitiative(item.initiative_type)} • ${item.activities.length} activities`}
                </p>
                {dup?.is_redundant && dup.best_match_title && (
                  <p className="inbox-dup">
                    Potential duplicate: {dup.best_match_title} ({Math.round(dup.best_score * 100)}%)
                  </p>
                )}
                {!dup?.is_redundant && dup?.resolved_by_decision && (
                  <p className="inbox-dup muted">
                    Resolved: {dup.resolved_by_decision === 'keep_both' ? 'Keep both' : 'Intentional overlap'}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </aside>

      <section className="commitment-content">
        <header className="content-head">
          <div>
            <h2>Commitment Shaping</h2>
          </div>
        </header>

        {selectedRoadmapItem ? (
          <div className="content-flow">
            {(() => {
              const dup = redundancyByItem.get(selectedRoadmapItem.id)
              if (!dup?.is_redundant || !dup.best_match_title) return null
              return (
                <div className="inline-note warning">
                  <div className="dup-warning-text">
                    <span>
                    Potential redundancy with "{dup.best_match_title}" ({Math.round(dup.best_score * 100)}% similarity).
                    </span>
                    <div className="dup-actions">
                      <button
                        className="ghost-btn tiny"
                        type="button"
                        disabled={busy || !dup.best_match_id}
                        onClick={() => dup.best_match_id && applyRedundancyDecision(selectedRoadmapItem.id, 'merge', dup.best_match_id)}
                      >
                        Merge
                      </button>
                      <button
                        className="ghost-btn tiny"
                        type="button"
                        disabled={busy || !dup.best_match_id}
                        onClick={() => dup.best_match_id && applyRedundancyDecision(selectedRoadmapItem.id, 'keep_both', dup.best_match_id)}
                      >
                        Keep both
                      </button>
                      <button
                        className="ghost-btn tiny"
                        type="button"
                        disabled={busy || !dup.best_match_id}
                        onClick={() => dup.best_match_id && applyRedundancyDecision(selectedRoadmapItem.id, 'intentional_overlap', dup.best_match_id)}
                      >
                        Mark intentional overlap
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}
            <div className="section-head">{isLocked ? 'COMMITTED ITEM (LOCKED)' : 'SELECTED COMMITMENT CANDIDATE'}</div>
            <h3 className="content-title">{roadmapTitle || '-'}</h3>
            <details className="flat-detail">
              <summary>View scope</summary>
              <p>{roadmapScope || '-'}</p>
            </details>
            <details className="flat-detail">
              <summary>View activities ({roadmapActivities.length})</summary>
              <ul className="understanding-list">
                {roadmapActivities.length > 0 ? (
                  roadmapActivities.map((a, i) => {
                    const parsed = parseActivityEntry(a)
                    const visibleTags = parsed.tags.length ? parsed.tags : [inferActivityTag(parsed.text || a)]
                    return (
                      <li key={`${i}-${a}`}>
                        <div className="activity-read-row">
                          <div className="activity-chip-row">
                            {visibleTags.map((tag) => (
                              <span key={`${i}-${tag}`} className={`activity-tag-chip tag-${tag.toLowerCase()} active`}>
                                {tag}
                              </span>
                            ))}
                          </div>
                          <span>{parsed.text || a}</span>
                        </div>
                      </li>
                    )
                  })
                ) : (
                  <li>-</li>
                )}
              </ul>
            </details>
            <p className="source-line">Source document: {selectedRoadmapItem.source_document_id ? docMap.get(selectedRoadmapItem.source_document_id) || '-' : '-'}</p>
            <div className="classification-row">
              <span className="activity-tag-chip tag-be active">{roadmapProjectContext === 'client' ? 'Client Project' : 'Internal Project'}</span>
              <span className="activity-tag-chip tag-ai active">{roadmapDeliveryMode === 'rnd' ? 'R&D' : 'Standard Delivery'}</span>
              <span className="activity-tag-chip tag-fe active">{formatInitiative(roadmapInitiativeType)}</span>
            </div>
            <p className="muted">Classification is single-state. Each commitment can exist in only one mode/context at a time.</p>
            {roadmapDeliveryMode === 'rnd' && (
              <details className="flat-detail">
                <summary>View R&D framing</summary>
                <ul className="understanding-list">
                  <li>Hypothesis: {roadmapRndHypothesis || '-'}</li>
                  <li>Experiment goal: {roadmapRndExperimentGoal || '-'}</li>
                  <li>Success criteria: {roadmapRndSuccessCriteria || '-'}</li>
                  <li>Timebox (weeks): {roadmapRndTimeboxWeeks ?? '-'}</li>
                  <li>Decision date: {roadmapRndDecisionDate || '-'}</li>
                  <li>Next gate: {roadmapRndNextGate || '-'}</li>
                  <li>Risk level: {roadmapRndRiskLevel || '-'}</li>
                </ul>
              </details>
            )}

            <div className="section-head">COMMITMENT SHAPING</div>
            {isLocked && (
              <div className="inline-note">
                <span>This item is committed and locked.</span>
                {canManageCommitments && (
                  <button
                    className="ghost-btn tiny"
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      const ok = window.confirm(
                        'Unlock this commitment for editing?\n\nIt will be removed from roadmap until recommitted.',
                      )
                      if (!ok) return
                      await unlockRoadmapCommitment(selectedRoadmapItem.id)
                    }}
                  >
                    Unlock for edit
                  </button>
                )}
              </div>
            )}

            <details className="flat-detail" open>
              <summary>Scope and activities refinement</summary>
              <div className="activity-editor">
                <div className="line-item">
                  <strong>Update details before commitment</strong>
                  <div className="activity-chip-row">
                    {!isLocked && (
                      <button
                        className="ghost-btn tiny"
                        type="button"
                        disabled={busy}
                        onClick={() => void saveRoadmapCandidate(selectedRoadmapItem.id)}
                      >
                        Save Candidate Updates
                      </button>
                    )}
                    {!isLocked && canManageCommitments && (
                      <button
                        className="ghost-btn tiny"
                        type="button"
                        disabled={busy || roadmapDeliveryMode === 'rnd'}
                        onClick={async () => {
                          const ok = window.confirm(
                            'Move this commitment to R&D Lab?\n\nThis will set Project Type to Internal and Delivery Mode to R&D.',
                          )
                          if (!ok) return
                          await moveRoadmapCandidateToRnd(selectedRoadmapItem.id)
                        }}
                      >
                        {roadmapDeliveryMode === 'rnd' ? 'Already in R&D Lab' : 'Move to R&D Lab'}
                      </button>
                    )}
                  </div>
                </div>
                <label>
                  Title
                  <input
                    value={roadmapTitle}
                    disabled={isLocked || busy}
                    onChange={(e) => setRoadmapTitle(e.target.value)}
                    placeholder="Refine commitment title"
                  />
                </label>
                <label>
                  Scope
                  <textarea
                    rows={3}
                    value={roadmapScope}
                    disabled={isLocked || busy}
                    onChange={(e) => setRoadmapScope(e.target.value)}
                    placeholder="Refine commitment scope"
                  />
                </label>
                <div className="split-3">
                  <label>
                    Project Type
                    <select
                      value={roadmapProjectContext}
                      disabled={isLocked || busy}
                      onChange={(e) => setRoadmapProjectContext(e.target.value)}
                    >
                      <option value="client">Client Project</option>
                      <option value="internal">Internal Project</option>
                    </select>
                  </label>
                  <label>
                    Delivery Mode
                    <select
                      value={roadmapDeliveryMode}
                      disabled={isLocked || busy}
                      onChange={(e) => setRoadmapDeliveryMode(e.target.value)}
                    >
                      <option value="standard">Standard</option>
                      <option value="rnd">R&amp;D</option>
                    </select>
                  </label>
                  <label>
                    Initiative
                    <select
                      value={roadmapInitiativeType}
                      disabled={isLocked || busy}
                      onChange={(e) => setRoadmapInitiativeType(e.target.value)}
                    >
                      <option value="new_feature">New Feature</option>
                      <option value="new_product">New Product</option>
                    </select>
                  </label>
                </div>
                <div className="split-4">
                  <label>
                    FE FTE
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      value={roadmapFeFte}
                      disabled={isLocked || busy}
                      onChange={(e) => setRoadmapFeFte(e.target.value)}
                      placeholder="0"
                    />
                  </label>
                  <label>
                    BE FTE
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      value={roadmapBeFte}
                      disabled={isLocked || busy}
                      onChange={(e) => setRoadmapBeFte(e.target.value)}
                      placeholder="0"
                    />
                  </label>
                  <label>
                    AI FTE
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      value={roadmapAiFte}
                      disabled={isLocked || busy}
                      onChange={(e) => setRoadmapAiFte(e.target.value)}
                      placeholder="0"
                    />
                  </label>
                  <label>
                    PM FTE
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      value={roadmapPmFte}
                      disabled={isLocked || busy}
                      onChange={(e) => setRoadmapPmFte(e.target.value)}
                      placeholder="0"
                    />
                  </label>
                </div>
                <div className="inline-note">
                  <span>
                    Capacity Validation: {capacityValidationBusy ? 'Checking...' : capacityValidation?.status || 'Not yet evaluated'}
                  </span>
                  {capacityValidation && (
                    <span className={capacityValidation.status === 'APPROVED' ? 'success-text' : 'error-text'}>
                      {capacityValidation.reason}
                    </span>
                  )}
                  {capacityValidationError && <span className="error-text">{capacityValidationError}</span>}
                </div>
                {capacityValidation && (
                  <CapacityMeters
                    title="Resource Availability Meter (After This Commitment)"
                    utilization={capacityValidation.utilization_percentage}
                  />
                )}
                <div className="line-item">
                  <strong>Activities</strong>
                  <button
                    className="ghost-btn tiny"
                    type="button"
                    disabled={isLocked || busy}
                    onClick={addRoadmapActivity}
                  >
                    + Add Activity
                  </button>
                </div>
                <table className="activity-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tags</th>
                      <th>Activity</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roadmapActivities.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted">
                          No activities added yet.
                        </td>
                      </tr>
                    )}
                    {roadmapActivities.map((activity, idx) => {
                      const parsed = parseActivityEntry(activity)
                      return (
                        <tr key={`${idx}-${activity}`}>
                          <td>{idx + 1}</td>
                          <td>
                            <div className="activity-chip-row">
                              {ACTIVITY_TAGS.map((tag) => {
                                const active = parsed.tags.includes(tag)
                                return (
                                  <button
                                    key={`${idx}-${tag}`}
                                    className={`activity-tag-chip tag-${tag.toLowerCase()}${active ? ' active' : ' inactive'}`}
                                    type="button"
                                    disabled={isLocked || busy}
                                    onClick={() => toggleRoadmapActivityTag(idx, tag)}
                                  >
                                    {tag}
                                  </button>
                                )
                              })}
                            </div>
                          </td>
                          <td>
                            <input
                              className="activity-input"
                              value={parsed.text}
                              disabled={isLocked || busy}
                              onChange={(e) => updateRoadmapActivity(idx, e.target.value)}
                              placeholder="Enter activity"
                            />
                          </td>
                          <td>
                            <button
                              className="ghost-btn tiny"
                              type="button"
                              disabled={isLocked || busy}
                              onClick={() => removeRoadmapActivity(idx)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </details>

            <div className="radio-rows">
              <span className="muted">Readiness</span>
              <label>
                <input
                  type="radio"
                  name="commitment-readiness"
                  checked={readiness === 'explore_later'}
                  disabled={isLocked || busy}
                  onChange={() => {
                    setReadiness('explore_later')
                    setRoadmapPickedUp(false)
                  }}
                />
                Explore later
              </label>
              <label>
                <input
                  type="radio"
                  name="commitment-readiness"
                  checked={readiness === 'shape_this_quarter'}
                  disabled={isLocked || busy}
                  onChange={() => {
                    setReadiness('shape_this_quarter')
                    setRoadmapPickedUp(false)
                  }}
                />
                Shape this quarter
              </label>
              <label>
                <input
                  type="radio"
                  name="commitment-readiness"
                  checked={readiness === 'ready_to_commit'}
                  disabled={isLocked || busy}
                  onChange={() => {
                    setReadiness('ready_to_commit')
                    setRoadmapPickedUp(true)
                  }}
                />
                Ready to commit
              </label>
            </div>

            <div className="horizon-row">
              <span className="muted">Horizon</span>
              <button
                className={`ghost-btn tiny${horizon === 'near_term' ? ' active-pill' : ''}`}
                type="button"
                disabled={isLocked || busy}
                onClick={() => {
                  setHorizon('near_term')
                  setRoadmapMove((s) => ({ ...s, pickup_period: 'Near-term', completion_period: '' }))
                }}
              >
                Near-term
              </button>
              <button
                className={`ghost-btn tiny${horizon === 'mid_term' ? ' active-pill' : ''}`}
                type="button"
                disabled={isLocked || busy}
                onClick={() => {
                  setHorizon('mid_term')
                  setRoadmapMove((s) => ({ ...s, pickup_period: 'Mid-term', completion_period: '' }))
                }}
              >
                Mid-term
              </button>
              <button
                className={`ghost-btn tiny${horizon === 'long_term' ? ' active-pill' : ''}`}
                type="button"
                disabled={isLocked || busy}
                onClick={() => {
                  setHorizon('long_term')
                  setRoadmapMove((s) => ({ ...s, pickup_period: 'Long-term', completion_period: '' }))
                }}
              >
                Long-term
              </button>
            </div>

            <div className="owner-row">
              <span className="muted">Tentative Duration (weeks)</span>
              <input
                type="number"
                min={1}
                step={1}
                value={roadmapMove.tentative_duration_weeks}
                disabled={isLocked || busy}
                onChange={(e) => setRoadmapMove((s) => ({ ...s, tentative_duration_weeks: e.target.value }))}
                placeholder="e.g. 8"
              />
            </div>

            <div className="owner-row">
              <span className="muted">Owner</span>
              <input
                list="owner-suggestions"
                value={roadmapAccountablePerson}
                disabled={isLocked || busy}
                onChange={(e) => setRoadmapAccountablePerson(e.target.value)}
                placeholder="Assign owner (name/email)"
              />
              <datalist id="owner-suggestions">
                {knownOwners.map((owner) => (
                  <option key={owner} value={owner} />
                ))}
              </datalist>
            </div>

            {!isLocked && (
              <button
                className="primary-btn commit-cta"
                type="button"
                disabled={busy || commitBlockers.length > 0}
                onClick={async () => {
                  const ok = window.confirm(
                    'Confirm Roadmap Commitment?\n\nThis is a public commitment and will become visible on the roadmap.',
                  )
                  if (!ok) return
                  await commitSelectedToRoadmap(selectedRoadmapItem.id)
                }}
              >
                Confirm Roadmap Commitment
              </button>
            )}
            {!isLocked && commitBlockers.map((reason) => (
              <p key={reason} className={reason.toLowerCase().includes('capacity') ? 'error-text' : 'muted'}>
                {reason}
              </p>
            ))}

            <p className="muted footer-note">
              {selectedPlan
                ? `Committed on ${fmtDate(selectedPlan.entered_roadmap_at)}.`
                : horizon
                  ? `Current horizon: ${horizonLabel(horizon)}.`
                  : 'Only roadmap items are externally visible.'}
            </p>
          </div>
        ) : (
          <p className="muted">Select a commitment candidate from the left list.</p>
        )}
      </section>
    </main>
  )
}

type RoadmapAgentProps = {
  roadmapPlanItems: RoadmapPlanItem[]
  movementRequests: RoadmapMovementRequest[]
  governanceConfig: GovernanceConfig | null
  currentUserRole: SystemRole
  updateRoadmapPlanItem: (
    itemId: number,
    payload: {
      planned_start_date: string
      planned_end_date: string
      resource_count: number | null
      effort_person_weeks: number | null
      planning_status: string
      confidence: string
      dependency_ids: number[]
      change_reason?: string
      expected_version_no: number
    },
  ) => Promise<void>
  setRoadmapGovernanceLock: (payload: { roadmap_locked: boolean; note: string }) => Promise<void>
  submitRoadmapMovementRequest: (
    planItemId: number,
    payload: {
      proposed_start_date: string
      proposed_end_date: string
      reason: string
      blocker: string
    },
  ) => Promise<void>
  decideRoadmapMovementRequest: (
    requestId: number,
    payload: {
      decision: 'approved' | 'rejected'
      decision_reason: string
    },
  ) => Promise<void>
  ceoMoveRoadmapPlanItem: (
    planItemId: number,
    payload: {
      proposed_start_date: string
      proposed_end_date: string
      reason: string
      blocker: string
    },
  ) => Promise<void>
  validateCapacity: (payload: {
    project_context: string
    tentative_duration_weeks: number
    planned_start_date?: string
    planned_end_date?: string
    fe_fte: number
    be_fte: number
    ai_fte: number
    pm_fte: number
    exclude_bucket_item_id?: number
  }) => Promise<CapacityValidationResult>
  downloadRoadmapPlanExcel: (filters: {
    year: number
    priority: string
    context: string
    mode: string
    period: string
  }) => Promise<void>
  busy: boolean
}

function RoadmapAgentPage({
  roadmapPlanItems,
  movementRequests,
  governanceConfig,
  currentUserRole,
  updateRoadmapPlanItem,
  setRoadmapGovernanceLock,
  submitRoadmapMovementRequest,
  decideRoadmapMovementRequest,
  ceoMoveRoadmapPlanItem,
  validateCapacity,
  downloadRoadmapPlanExcel,
  busy,
}: RoadmapAgentProps) {
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [contextFilter, setContextFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [planStart, setPlanStart] = useState('')
  const [planEnd, setPlanEnd] = useState('')
  const [planStatus, setPlanStatus] = useState('not_started')
  const [planConfidence, setPlanConfidence] = useState('medium')
  const [planDepsText, setPlanDepsText] = useState('')
  const [planCapacityValidation, setPlanCapacityValidation] = useState<CapacityValidationResult | null>(null)
  const [planCapacityBusy, setPlanCapacityBusy] = useState(false)
  const [planCapacityError, setPlanCapacityError] = useState('')
  const [movementReason, setMovementReason] = useState('')
  const [movementBlocker, setMovementBlocker] = useState('')
  const currentYear = new Date().getFullYear()
  const [yearView, setYearView] = useState(currentYear)
  const roadmapLocked = Boolean(governanceConfig?.roadmap_locked)
  const isCEO = currentUserRole === 'CEO'
  const canRequestMovement = currentUserRole === 'VP' || currentUserRole === 'PM' || currentUserRole === 'PO'

  const selectedPlan = useMemo(
    () => roadmapPlanItems.find((x) => x.id === selectedPlanId) || null,
    [roadmapPlanItems, selectedPlanId],
  )
  const selectedPlanMovements = useMemo(
    () => movementRequests.filter((x) => selectedPlanId != null && x.plan_item_id === selectedPlanId),
    [movementRequests, selectedPlanId],
  )
  const pendingMovementRequests = useMemo(
    () => movementRequests.filter((x) => x.status === 'pending'),
    [movementRequests],
  )

  function quarterFromItem(item: RoadmapPlanItem): 'Q1' | 'Q2' | 'Q3' | 'Q4' | '' {
    if (item.planned_start_date) {
      const d = new Date(item.planned_start_date)
      if (!Number.isNaN(d.getTime())) {
        const month = d.getMonth()
        return `Q${Math.floor(month / 3) + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4'
      }
    }
    const p = `${item.pickup_period} ${item.completion_period}`.toUpperCase()
    if (p.includes('Q1')) return 'Q1'
    if (p.includes('Q2')) return 'Q2'
    if (p.includes('Q3')) return 'Q3'
    if (p.includes('Q4')) return 'Q4'
    return ''
  }

  const filtered = useMemo(
    () =>
      roadmapPlanItems.filter((item) => {
        const pOk = priorityFilter === 'all' || item.priority === priorityFilter
        const cOk = contextFilter === 'all' || item.project_context === contextFilter
        const mOk = modeFilter === 'all' || item.delivery_mode === modeFilter
        const q = quarterFromItem(item)
        const prOk = periodFilter === 'all' || q === periodFilter
        return pOk && cOk && mOk && prOk
      }),
    [roadmapPlanItems, priorityFilter, contextFilter, modeFilter, periodFilter],
  )

  useEffect(() => {
    if (!selectedPlan) return
    setPlanStart(selectedPlan.planned_start_date || '')
    setPlanEnd(selectedPlan.planned_end_date || '')
    setPlanStatus(selectedPlan.planning_status || 'not_started')
    setPlanConfidence(selectedPlan.confidence || 'medium')
    setPlanDepsText((selectedPlan.dependency_ids || []).join(', '))
  }, [selectedPlan])

  useEffect(() => {
    setMovementReason('')
    setMovementBlocker('')
  }, [selectedPlanId])

  const computedDurationWeeks = useMemo(() => {
    if (planStart && planEnd) {
      const start = new Date(planStart)
      const end = new Date(planEnd)
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
        const msInDay = 24 * 60 * 60 * 1000
        const days = Math.floor((end.getTime() - start.getTime()) / msInDay) + 1
        return Math.max(1, Math.ceil(days / 7))
      }
    }
    return selectedPlan?.tentative_duration_weeks || 1
  }, [planStart, planEnd, selectedPlan?.tentative_duration_weeks])

  const computedTotalFte = useMemo(() => {
    if (!selectedPlan) return 0
    return Math.max(0, selectedPlan.fe_fte || 0) + Math.max(0, selectedPlan.be_fte || 0) + Math.max(0, selectedPlan.ai_fte || 0) + Math.max(0, selectedPlan.pm_fte || 0)
  }, [selectedPlan])

  const computedResourceCount = useMemo(() => {
    if (computedTotalFte <= 0) return 0
    return Math.ceil(computedTotalFte)
  }, [computedTotalFte])

  const computedEffortPw = useMemo(() => {
    if (computedTotalFte <= 0) return 0
    return Math.ceil(computedTotalFte * computedDurationWeeks)
  }, [computedTotalFte, computedDurationWeeks])

  useEffect(() => {
    if (!selectedPlan) {
      setPlanCapacityValidation(null)
      setPlanCapacityError('')
      return
    }
    if (!planStart || !planEnd) {
      setPlanCapacityValidation(null)
      setPlanCapacityError('')
      return
    }
    const start = new Date(planStart)
    const end = new Date(planEnd)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      setPlanCapacityValidation(null)
      setPlanCapacityError('Planned End must be on or after Planned Start.')
      return
    }
    const timer = window.setTimeout(() => {
      setPlanCapacityBusy(true)
      setPlanCapacityError('')
      validateCapacity({
        project_context: selectedPlan.project_context || 'internal',
        tentative_duration_weeks: computedDurationWeeks,
        planned_start_date: planStart,
        planned_end_date: planEnd,
        fe_fte: Math.max(0, selectedPlan.fe_fte || 0),
        be_fte: Math.max(0, selectedPlan.be_fte || 0),
        ai_fte: Math.max(0, selectedPlan.ai_fte || 0),
        pm_fte: Math.max(0, selectedPlan.pm_fte || 0),
        exclude_bucket_item_id: selectedPlan.bucket_item_id,
      })
        .then((res) => {
          setPlanCapacityValidation(res)
          setPlanCapacityError('')
        })
        .catch((err) => {
          setPlanCapacityValidation(null)
          setPlanCapacityError(err instanceof Error ? err.message : 'Capacity validation failed')
        })
        .finally(() => setPlanCapacityBusy(false))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [selectedPlan, planStart, planEnd, computedDurationWeeks, validateCapacity])

  const yearlyPlan = useMemo(() => {
    const totalItems = filtered.length
    const totalResources = filtered.reduce((a, i) => {
      const totalFte = Math.max(0, i.fe_fte || 0) + Math.max(0, i.be_fte || 0) + Math.max(0, i.ai_fte || 0) + Math.max(0, i.pm_fte || 0)
      return a + (totalFte > 0 ? Math.ceil(totalFte) : 0)
    }, 0)
    const totalEffort = filtered.reduce((a, i) => {
      const totalFte = Math.max(0, i.fe_fte || 0) + Math.max(0, i.be_fte || 0) + Math.max(0, i.ai_fte || 0) + Math.max(0, i.pm_fte || 0)
      const dur = i.tentative_duration_weeks && i.tentative_duration_weeks > 0 ? i.tentative_duration_weeks : 1
      return a + (totalFte > 0 ? Math.ceil(totalFte * dur) : 0)
    }, 0)
    const atRisk = filtered.filter((i) => i.planning_status === 'at_risk').length
    return { totalItems, totalResources, totalEffort, atRisk }
  }, [filtered])

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const ganttRows = useMemo(() => {
    return filtered
      .map((item) => {
        if (!item.planned_start_date || !item.planned_end_date) return { item, left: null as number | null, width: null as number | null }
        const start = new Date(item.planned_start_date)
        const end = new Date(item.planned_end_date)
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { item, left: null, width: null }
        if (start.getFullYear() !== yearView && end.getFullYear() !== yearView) return { item, left: null, width: null }
        const startMonth = Math.max(0, start.getFullYear() < yearView ? 0 : start.getMonth())
        const endMonth = Math.min(11, end.getFullYear() > yearView ? 11 : end.getMonth())
        const left = (startMonth / 12) * 100
        const width = ((endMonth - startMonth + 1) / 12) * 100
        return { item, left, width }
      })
      .sort((a, b) => a.item.title.localeCompare(b.item.title))
  }, [filtered, yearView])

  async function savePlan() {
    if (!selectedPlan) return
    if (!planStart || !planEnd) {
      window.alert('Planned Start and Planned End are required.')
      return
    }
    const start = new Date(planStart)
    const end = new Date(planEnd)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      window.alert('Planned End must be on or after Planned Start.')
      return
    }
    if (planCapacityValidation?.status === 'REJECTED') {
      window.alert(planCapacityValidation.reason || 'Capacity exceeded. Please adjust dates or commitment FTE.')
      return
    }

    if (roadmapLocked) {
      const cleanReason = movementReason.trim()
      if (cleanReason.length < 10) {
        window.alert('Movement justification must be at least 10 characters.')
        return
      }
      if (isCEO) {
        await ceoMoveRoadmapPlanItem(selectedPlan.id, {
          proposed_start_date: planStart,
          proposed_end_date: planEnd,
          reason: cleanReason,
          blocker: movementBlocker.trim(),
        })
        setMovementReason('')
        setMovementBlocker('')
        return
      }
      if (canRequestMovement) {
        await submitRoadmapMovementRequest(selectedPlan.id, {
          proposed_start_date: planStart,
          proposed_end_date: planEnd,
          reason: cleanReason,
          blocker: movementBlocker.trim(),
        })
        setMovementReason('')
        setMovementBlocker('')
        return
      }
      window.alert('Roadmap is locked. Only CEO can move dates directly.')
      return
    }

    const deps = planDepsText
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n) && n > 0 && n !== selectedPlan.id)
    await updateRoadmapPlanItem(selectedPlan.id, {
      planned_start_date: planStart,
      planned_end_date: planEnd,
      resource_count: computedResourceCount,
      effort_person_weeks: computedEffortPw,
      planning_status: planStatus,
      confidence: planConfidence,
      dependency_ids: Array.from(new Set(deps)),
      change_reason: movementReason.trim(),
      expected_version_no: selectedPlan.version_no,
    })
  }

  return (
    <main className="page-wrap planner-wrap">
      <section className="panel-card planner-section">
        <div className="planner-head-row">
          <h2>Roadmap Planner</h2>
          <button
            className="ghost-btn tiny icon-only"
            type="button"
            title="Download Gantt Excel"
            disabled={busy}
            onClick={() =>
              downloadRoadmapPlanExcel({
                year: yearView,
                priority: priorityFilter,
                context: contextFilter,
                mode: modeFilter,
                period: periodFilter,
              })
            }
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 3a1 1 0 0 1 1 1v8.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L11 12.6V4a1 1 0 0 1 1-1zM5 18a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z" />
            </svg>
          </button>
        </div>
        <p className="muted">Plan committed items with dates and dependencies. Resources and effort are auto-derived from committed FTE.</p>
        <div className="line-item">
          <span className={roadmapLocked ? 'capacity-meter-state warn' : 'muted'}>
            Governance lock: {roadmapLocked ? 'Enabled' : 'Disabled'}
            {governanceConfig?.roadmap_locked_at ? ` (${fmtDateTime(governanceConfig.roadmap_locked_at)})` : ''}
          </span>
          {isCEO && (
            <button
              className="ghost-btn tiny"
              type="button"
              disabled={busy}
              onClick={async () => {
                const lockNext = !roadmapLocked
                const note = window.prompt(
                  lockNext
                    ? 'Provide lock note (optional):'
                    : 'Provide unlock note/justification (optional):',
                  governanceConfig?.roadmap_lock_note || '',
                ) ?? ''
                await setRoadmapGovernanceLock({ roadmap_locked: lockNext, note })
              }}
            >
              {roadmapLocked ? 'Unlock Governance' : 'Lock After CEO Review'}
            </button>
          )}
        </div>
        {governanceConfig?.roadmap_lock_note && (
          <p className="muted">Lock note: {governanceConfig.roadmap_lock_note}</p>
        )}
        <div className="planner-filters">
          <label className="planner-filter">
            <span>Year</span>
            <input
              type="number"
              min={2020}
              max={2100}
              value={yearView}
              onChange={(e) => setYearView(Number(e.target.value) || currentYear)}
            />
          </label>
          <label className="planner-filter">
            <span>Period</span>
            <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
            </select>
          </label>
          <label className="planner-filter">
            <span>Priority</span>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="planner-filter">
            <span>Context</span>
            <select value={contextFilter} onChange={(e) => setContextFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="client">Client</option>
              <option value="internal">Internal</option>
            </select>
          </label>
          <label className="planner-filter">
            <span>Mode</span>
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="standard">Standard</option>
              <option value="rnd">R&D</option>
            </select>
          </label>
        </div>
        <div className="planner-metrics-strip">
          <span>Committed: {yearlyPlan.totalItems}</span>
          <span>Resources: {yearlyPlan.totalResources}</span>
          <span>Effort: {yearlyPlan.totalEffort} pw</span>
          <span>At Risk: {yearlyPlan.atRisk}</span>
        </div>
      </section>

      <section className="panel-card planner-section">
        <h3>Gantt Timeline ({yearView})</h3>
        <div className="gantt-grid">
          <div className="gantt-left-head" />
          <div className="gantt-month-head">
            {months.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
          {ganttRows.length === 0 && <p className="muted">No roadmap commitments yet.</p>}
          {ganttRows.map(({ item, left, width }) => (
            <button
              key={item.id}
              type="button"
              className={`gantt-row${selectedPlanId === item.id ? ' active' : ''}`}
              onClick={() => setSelectedPlanId(item.id)}
            >
              <span className="gantt-row-title">{item.title}</span>
              <span className="gantt-row-track">
                {left !== null && width !== null ? (
                  <span
                    className={`gantt-bar${item.planning_status === 'at_risk' ? ' at-risk' : ''}`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: getProjectTypeColor(item.project_context, item.delivery_mode)
                    }}
                  />
                ) : (
                  <span className="gantt-placeholder" />
                )}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel-card planner-section">
        <div className="planner-details-head">
          <button className="ghost-btn small" type="button">
            Details
          </button>
          <span className="muted mono">{selectedPlan ? String(selectedPlan.id).padStart(2, '0') : '--'}</span>
        </div>
        {selectedPlanId && selectedPlan ? (
          <div className="stack">
            <p>
              <strong>{selectedPlan.title}</strong> <span className="muted">({selectedPlan.delivery_mode === 'rnd' ? 'R&D' : 'Standard'})</span>
            </p>
            <div className="split-2">
              <label>
                Planned Start
                <input type="date" value={planStart} onChange={(e) => setPlanStart(e.target.value)} />
              </label>
              <label>
                Planned End
                <input type="date" value={planEnd} onChange={(e) => setPlanEnd(e.target.value)} />
              </label>
            </div>
            <div className="split-2">
              <label>
                Resources Required
                <input type="number" min={0} value={computedResourceCount} readOnly />
              </label>
              <label>
                Effort (Person-Weeks)
                <input type="number" min={0} value={computedEffortPw} readOnly />
              </label>
            </div>
            <div className="inline-note">
              <span>Calculated duration: {computedDurationWeeks} week(s)</span>
              <span>Capacity validation: {planCapacityBusy ? 'Checking...' : planCapacityValidation?.status || 'Set dates to evaluate'}</span>
              {planCapacityValidation && (
                <span className={planCapacityValidation.status === 'APPROVED' ? 'success-text' : 'error-text'}>
                  {planCapacityValidation.reason}
                </span>
              )}
              {planCapacityError && <span className="error-text">{planCapacityError}</span>}
            </div>
            {planCapacityValidation && (
              <CapacityMeters
                title="Resource Availability Meter (Selected Timeline)"
                utilization={planCapacityValidation.utilization_percentage}
              />
            )}
            <div className="split-2">
              <label>
                Status
                <select value={planStatus} onChange={(e) => setPlanStatus(e.target.value)}>
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="at_risk">At Risk</option>
                  <option value="done">Done</option>
                </select>
              </label>
              <label>
                Confidence
                <select value={planConfidence} onChange={(e) => setPlanConfidence(e.target.value)}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
            </div>
            <label>
              Dependencies (comma-separated roadmap plan IDs)
              <input value={planDepsText} onChange={(e) => setPlanDepsText(e.target.value)} placeholder="e.g. 4, 8, 12" />
            </label>
            {roadmapLocked && (
              <div className="inline-note warning">
                <span>
                  {isCEO
                    ? 'Roadmap is locked. CEO can move timeline only with justification.'
                    : canRequestMovement
                      ? 'Roadmap is locked. Submit movement request for CEO approval.'
                      : 'Roadmap is locked. Only CEO can move timeline.'}
                </span>
              </div>
            )}
            <label>
              {roadmapLocked && isCEO ? 'CEO Justification for Movement' : 'Movement Reason / Blocker Justification'}
              <textarea
                rows={3}
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                placeholder="Explain why this roadmap movement is needed (priority shift, blocker, dependency, client escalation, etc.)"
              />
            </label>
            <label>
              Blocker / Trigger (optional)
              <input
                value={movementBlocker}
                onChange={(e) => setMovementBlocker(e.target.value)}
                placeholder="e.g. high priority client escalation, dependency delay, environment blocker"
              />
            </label>
            <button
              className="primary-btn"
              type="button"
              disabled={
                busy ||
                !planStart ||
                !planEnd ||
                !!planCapacityError ||
                planCapacityBusy ||
                planCapacityValidation?.status === 'REJECTED' ||
                (roadmapLocked && movementReason.trim().length < 10) ||
                (roadmapLocked && !isCEO && !canRequestMovement)
              }
              onClick={savePlan}
            >
              {roadmapLocked
                ? isCEO
                  ? 'Apply CEO Movement'
                  : canRequestMovement
                    ? 'Submit Movement Request'
                    : 'Roadmap Locked'
                : 'Save Plan'}
            </button>
          </div>
        ) : (
          <p className="muted">Select a bar in Gantt to plan dates/resources/dependencies.</p>
        )}
      </section>

      <section className="panel-card planner-section">
        <h3>Roadmap Movement Workflow</h3>
        <p className="muted">
          VP/PM submit movement requests while roadmap lock is active. CEO approves/rejects with decision reason. All movement events are retained for audit and chatbot retrieval.
        </p>
        {isCEO && (
          <div className="stack">
            <strong>Pending CEO Approvals: {pendingMovementRequests.length}</strong>
            {pendingMovementRequests.length === 0 ? (
              <p className="muted">No pending movement requests.</p>
            ) : (
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Plan</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Reason</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingMovementRequests.map((req) => (
                    <tr key={req.id}>
                      <td>{req.id}</td>
                      <td>{req.plan_item_id}</td>
                      <td>{req.from_start_date || '-'} → {req.from_end_date || '-'}</td>
                      <td>{req.to_start_date} → {req.to_end_date}</td>
                      <td>{req.reason}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="ghost-btn tiny"
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              const note = window.prompt('Approval note (required):', 'Approved by CEO after review')
                              if (!note || note.trim().length < 3) return
                              await decideRoadmapMovementRequest(req.id, {
                                decision: 'approved',
                                decision_reason: note.trim(),
                              })
                            }}
                          >
                            Approve
                          </button>
                          <button
                            className="ghost-btn tiny"
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              const note = window.prompt('Rejection reason (required):', 'Rejected: insufficient business justification')
                              if (!note || note.trim().length < 3) return
                              await decideRoadmapMovementRequest(req.id, {
                                decision: 'rejected',
                                decision_reason: note.trim(),
                              })
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="stack">
          <strong>Selected Plan Movement History</strong>
          {!selectedPlan ? (
            <p className="muted">Select a roadmap bar to view movement history.</p>
          ) : selectedPlanMovements.length === 0 ? (
            <p className="muted">No movement history for this plan item.</p>
          ) : (
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Decision Note</th>
                  <th>Requested</th>
                </tr>
              </thead>
              <tbody>
                {selectedPlanMovements.map((req) => (
                  <tr key={req.id}>
                    <td>{req.id}</td>
                    <td>{req.request_type}</td>
                    <td>{req.status}</td>
                    <td>{req.from_start_date || '-'} → {req.from_end_date || '-'}</td>
                    <td>{req.to_start_date} → {req.to_end_date}</td>
                    <td>{req.reason}</td>
                    <td>{req.decision_reason || '-'}</td>
                    <td>{fmtDateTime(req.requested_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  )
}

type SettingsProps = {
  activeConfig: LLMConfig | null
  llmConfigs: LLMConfig[]
  governanceConfig: GovernanceConfig | null
  users: UserAdmin[]
  customRoles: CustomRole[]
  rolePolicies: RolePolicy[]
  currentUserRole: SystemRole
  providerForm: {
    provider: string
    model: string
    base_url: string
    api_key: string
  }
  setProviderForm: Dispatch<
    SetStateAction<{
      provider: string
      model: string
      base_url: string
      api_key: string
    }>
  >
  useCustomModel: boolean
  setUseCustomModel: Dispatch<SetStateAction<boolean>>
  saveLLMConfig: (e: FormEvent) => Promise<void>
  testLLMConfig: () => Promise<void>
  saveGovernanceTeamConfig: (payload: {
    team_fe: string
    team_be: string
    team_ai: string
    team_pm: string
    efficiency_fe: string
    efficiency_be: string
    efficiency_ai: string
    efficiency_pm: string
  }) => Promise<void>
  saveGovernanceQuotas: (payload: { quota_client: string; quota_internal: string }) => Promise<void>
  confirmGovernanceEfficiency: () => Promise<void>
  createPlatformUser: (payload: {
    full_name: string
    email: string
    password: string
    role: SystemRole
    custom_role_id?: number | null
  }) => Promise<void>
  createCustomRole: (payload: {
    name: string
    base_role: SystemRole
    scope: string
    responsibilities: string[]
    can_create_users: boolean
    can_configure_team_capacity: boolean
    can_allocate_portfolio_quotas: boolean
    can_submit_commitment: boolean
    can_edit_roadmap: boolean
    can_manage_settings: boolean
    is_active: boolean
  }) => Promise<void>
  updatePlatformUser: (
    userId: number,
    payload: {
      full_name?: string
      role?: SystemRole
      custom_role_id?: number | null
      password?: string
      is_active?: boolean
    },
  ) => Promise<void>
  updateCustomRole: (
    customRoleId: number,
    payload: {
      name?: string
      base_role?: SystemRole
      scope?: string
      responsibilities?: string[]
      can_create_users?: boolean
      can_configure_team_capacity?: boolean
      can_allocate_portfolio_quotas?: boolean
      can_submit_commitment?: boolean
      can_edit_roadmap?: boolean
      can_manage_settings?: boolean
      is_active?: boolean
    },
  ) => Promise<void>
  downloadProjectDocument: (payload: {
    version?: string
    prepared_by?: string
    approved_by?: string
    level?: 'l1' | 'l2'
  }) => Promise<void>
  llmTestResult: LLMTestResult | null
  busy: boolean
}

function SettingsPage({
  activeConfig,
  llmConfigs,
  governanceConfig,
  users,
  customRoles,
  rolePolicies,
  currentUserRole,
  providerForm,
  setProviderForm,
  useCustomModel,
  setUseCustomModel,
  saveLLMConfig,
  testLLMConfig,
  saveGovernanceTeamConfig,
  saveGovernanceQuotas,
  confirmGovernanceEfficiency,
  createPlatformUser,
  createCustomRole,
  updatePlatformUser,
  updateCustomRole,
  downloadProjectDocument,
  llmTestResult,
  busy,
}: SettingsProps) {
  const modelOptions = providerModelMap[providerForm.provider] ?? []
  const requiresBaseUrl = ['ollama', 'openai_compatible', 'glm', 'qwen', 'vertex_gemini'].includes(providerForm.provider)
  const canEditTeam = currentUserRole === 'CEO'
  const canEditQuotas = currentUserRole === 'CEO' || currentUserRole === 'VP'
  const isAdmin = currentUserRole === 'ADMIN'
  const [teamFe, setTeamFe] = useState('0')
  const [teamBe, setTeamBe] = useState('0')
  const [teamAi, setTeamAi] = useState('0')
  const [teamPm, setTeamPm] = useState('0')
  const [effFe, setEffFe] = useState('1')
  const [effBe, setEffBe] = useState('1')
  const [effAi, setEffAi] = useState('1')
  const [effPm, setEffPm] = useState('1')
  const [quotaClient, setQuotaClient] = useState('0.5')
  const [quotaInternal, setQuotaInternal] = useState('0.5')
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<SystemRole>('CEO')
  const [newUserCustomRoleId, setNewUserCustomRoleId] = useState('')
  const [customRoleName, setCustomRoleName] = useState('')
  const [customRoleBaseRole, setCustomRoleBaseRole] = useState<SystemRole>('PM')
  const [customRoleScope, setCustomRoleScope] = useState('')
  const [customRoleResponsibilities, setCustomRoleResponsibilities] = useState('')
  const [customRoleRights, setCustomRoleRights] = useState({
    can_create_users: false,
    can_configure_team_capacity: false,
    can_allocate_portfolio_quotas: false,
    can_submit_commitment: true,
    can_edit_roadmap: true,
    can_manage_settings: false,
  })
  const [docVersion, setDocVersion] = useState('1.0')
  const [docApprovedBy, setDocApprovedBy] = useState('CEO')
  const [docLevel, setDocLevel] = useState<'l1' | 'l2'>('l1')
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({})
  const [nowMs, setNowMs] = useState(Date.now())
  const teamFeNum = Number(teamFe)
  const teamBeNum = Number(teamBe)
  const teamAiNum = Number(teamAi)
  const teamPmNum = Number(teamPm)
  const teamSizeInvalid =
    (Number.isFinite(teamFeNum) ? teamFeNum : 0) < TEAM_SIZE_MIN ||
    (Number.isFinite(teamBeNum) ? teamBeNum : 0) < TEAM_SIZE_MIN ||
    (Number.isFinite(teamAiNum) ? teamAiNum : 0) < TEAM_SIZE_MIN ||
    (Number.isFinite(teamPmNum) ? teamPmNum : 0) < TEAM_SIZE_MIN
  const effFeNum = Number(effFe)
  const effBeNum = Number(effBe)
  const effAiNum = Number(effAi)
  const effPmNum = Number(effPm)
  const minEffNum = Math.min(
    Number.isFinite(effFeNum) ? effFeNum : 0,
    Number.isFinite(effBeNum) ? effBeNum : 0,
    Number.isFinite(effAiNum) ? effAiNum : 0,
    Number.isFinite(effPmNum) ? effPmNum : 0,
  )
  const maxEffNum = Math.max(
    Number.isFinite(effFeNum) ? effFeNum : 0,
    Number.isFinite(effBeNum) ? effBeNum : 0,
    Number.isFinite(effAiNum) ? effAiNum : 0,
    Number.isFinite(effPmNum) ? effPmNum : 0,
  )
  const efficiencyInvalid = minEffNum < EFFICIENCY_MIN || maxEffNum > EFFICIENCY_MAX
  const quotaClientNum = Number(quotaClient)
  const quotaInternalNum = Number(quotaInternal)
  const quotaTotal = (Number.isFinite(quotaClientNum) ? quotaClientNum : 0) + (Number.isFinite(quotaInternalNum) ? quotaInternalNum : 0)
  const quotaTotalInvalid = quotaTotal > 1.0 + 1e-9
  const teamLockedUntilMs = governanceConfig?.team_locked_until ? new Date(governanceConfig.team_locked_until).getTime() : 0
  const quotaLockedUntilMs = governanceConfig?.quota_locked_until ? new Date(governanceConfig.quota_locked_until).getTime() : 0
  const isTeamLockActive = Number.isFinite(teamLockedUntilMs) && teamLockedUntilMs > nowMs
  const isQuotaLockActive = Number.isFinite(quotaLockedUntilMs) && quotaLockedUntilMs > nowMs
  const isEfficiencyConfirmer = currentUserRole === 'CEO' || currentUserRole === 'VP'
  const roleConfirmationAt =
    currentUserRole === 'CEO'
      ? governanceConfig?.efficiency_confirmed_ceo_at || ''
      : currentUserRole === 'VP'
        ? governanceConfig?.efficiency_confirmed_vp_at || ''
        : ''
  const roleConfirmationMs = roleConfirmationAt ? new Date(roleConfirmationAt).getTime() : 0
  const confirmationDue = !Number.isFinite(roleConfirmationMs) || roleConfirmationMs <= 0 || nowMs - roleConfirmationMs >= EFFICIENCY_CONFIRM_INTERVAL_MS
  const assignableCreateCustomRoles = customRoles.filter((r) => r.is_active && r.base_role === newUserRole)

  useEffect(() => {
    if (!governanceConfig) return
    setTeamFe(String(governanceConfig.team_fe))
    setTeamBe(String(governanceConfig.team_be))
    setTeamAi(String(governanceConfig.team_ai))
    setTeamPm(String(governanceConfig.team_pm))
    setEffFe(String(governanceConfig.efficiency_fe))
    setEffBe(String(governanceConfig.efficiency_be))
    setEffAi(String(governanceConfig.efficiency_ai))
    setEffPm(String(governanceConfig.efficiency_pm))
    setQuotaClient(String(governanceConfig.quota_client))
    setQuotaInternal(String(governanceConfig.quota_internal))
  }, [governanceConfig])

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!newUserCustomRoleId) return
    const valid = assignableCreateCustomRoles.some((r) => String(r.id) === newUserCustomRoleId)
    if (!valid) setNewUserCustomRoleId('')
  }, [newUserRole, newUserCustomRoleId, assignableCreateCustomRoles])

  return (
    <main className="page-wrap">
      <section className="panel-card settings-section">
        <h2>Commitment Governance</h2>
        <p className="muted">
          CEO configures team size and efficiency per role. VP allocates portfolio quotas. PM commitments are blocked
          automatically if they exceed configured capacity.
        </p>
        <div className="split-2">
          <div className="stack">
            <h3>Team Capacity (CEO)</h3>
            <div className="split-4">
              <label>
                FE Team Size
                <input type="number" min={TEAM_SIZE_MIN} value={teamFe} disabled={!canEditTeam || busy || isTeamLockActive} onChange={(e) => setTeamFe(e.target.value)} />
              </label>
              <label>
                BE Team Size
                <input type="number" min={TEAM_SIZE_MIN} value={teamBe} disabled={!canEditTeam || busy || isTeamLockActive} onChange={(e) => setTeamBe(e.target.value)} />
              </label>
              <label>
                AI Team Size
                <input type="number" min={TEAM_SIZE_MIN} value={teamAi} disabled={!canEditTeam || busy || isTeamLockActive} onChange={(e) => setTeamAi(e.target.value)} />
              </label>
              <label>
                PM Team Size
                <input type="number" min={TEAM_SIZE_MIN} value={teamPm} disabled={!canEditTeam || busy || isTeamLockActive} onChange={(e) => setTeamPm(e.target.value)} />
              </label>
            </div>
            <div className="split-4">
              <label>
                FE Efficiency
                <input
                  type="number"
                  min={EFFICIENCY_MIN}
                  max={EFFICIENCY_MAX}
                  step="0.05"
                  value={effFe}
                  disabled={!canEditTeam || busy || isTeamLockActive}
                  onChange={(e) => setEffFe(e.target.value)}
                />
              </label>
              <label>
                BE Efficiency
                <input
                  type="number"
                  min={EFFICIENCY_MIN}
                  max={EFFICIENCY_MAX}
                  step="0.05"
                  value={effBe}
                  disabled={!canEditTeam || busy || isTeamLockActive}
                  onChange={(e) => setEffBe(e.target.value)}
                />
              </label>
              <label>
                AI Efficiency
                <input
                  type="number"
                  min={EFFICIENCY_MIN}
                  max={EFFICIENCY_MAX}
                  step="0.05"
                  value={effAi}
                  disabled={!canEditTeam || busy || isTeamLockActive}
                  onChange={(e) => setEffAi(e.target.value)}
                />
              </label>
              <label>
                PM Efficiency
                <input
                  type="number"
                  min={EFFICIENCY_MIN}
                  max={EFFICIENCY_MAX}
                  step="0.05"
                  value={effPm}
                  disabled={!canEditTeam || busy || isTeamLockActive}
                  onChange={(e) => setEffPm(e.target.value)}
                />
              </label>
            </div>
            <p className="muted">
              Team size minimum: {TEAM_SIZE_MIN}. Efficiency range: {EFFICIENCY_MIN.toFixed(2)} to {EFFICIENCY_MAX.toFixed(2)}.
            </p>
            {(teamSizeInvalid || efficiencyInvalid) && !isTeamLockActive && (
              <p className="error-text">
                {teamSizeInvalid
                  ? `All team sizes must be at least ${TEAM_SIZE_MIN}.`
                  : `Efficiency must be between ${EFFICIENCY_MIN.toFixed(2)} and ${EFFICIENCY_MAX.toFixed(2)}.`}
              </p>
            )}
            {isTeamLockActive && (
              <p className="error-text">
                Team capacity is locked until {fmtDateTime(governanceConfig?.team_locked_until || '')}
                {' '}({fmtDuration(teamLockedUntilMs - nowMs)} remaining).
              </p>
            )}
            <button
              className="primary-btn"
              type="button"
              disabled={!canEditTeam || busy || isTeamLockActive || teamSizeInvalid || efficiencyInvalid}
              onClick={() =>
                void saveGovernanceTeamConfig({
                  team_fe: teamFe,
                  team_be: teamBe,
                  team_ai: teamAi,
                  team_pm: teamPm,
                  efficiency_fe: effFe,
                  efficiency_be: effBe,
                  efficiency_ai: effAi,
                  efficiency_pm: effPm,
                })
              }
            >
              Save Team Capacity
            </button>
          </div>
          <div className="stack">
            <h3>Portfolio Quotas (VP/CEO)</h3>
            <div className="split-2">
              <label>
                Client Quota (0-1)
                <input
                  type="number"
                  min={0}
                  max={1}
                  step="0.01"
                  value={quotaClient}
                  disabled={!canEditQuotas || busy || isQuotaLockActive}
                  onChange={(e) => setQuotaClient(e.target.value)}
                />
              </label>
              <label>
                Internal Quota (0-1)
                <input
                  type="number"
                  min={0}
                  max={1}
                  step="0.01"
                  value={quotaInternal}
                  disabled={!canEditQuotas || busy || isQuotaLockActive}
                  onChange={(e) => setQuotaInternal(e.target.value)}
                />
              </label>
            </div>
            <p className={quotaTotalInvalid ? 'error-text' : 'muted'}>
              Total quota should be ≤ 1.00 across client and internal portfolios. Current total: {quotaTotal.toFixed(2)}
            </p>
            {isQuotaLockActive && (
              <p className="error-text">
                Portfolio quotas are locked until {fmtDateTime(governanceConfig?.quota_locked_until || '')}
                {' '}({fmtDuration(quotaLockedUntilMs - nowMs)} remaining).
              </p>
            )}
            <button
              className="primary-btn"
              type="button"
              disabled={!canEditQuotas || busy || quotaTotalInvalid || isQuotaLockActive}
              onClick={() =>
                void saveGovernanceQuotas({
                  quota_client: quotaClient,
                  quota_internal: quotaInternal,
                })
              }
            >
              Save Portfolio Quotas
            </button>
          </div>
        </div>
        {isEfficiencyConfirmer && (
          <div className="stack" style={{ marginTop: 16 }}>
            <h3>Monthly Efficiency Confirmation ({currentUserRole})</h3>
            <p className={confirmationDue ? 'error-text' : 'muted'}>
              {roleConfirmationAt
                ? `Last confirmation: ${fmtDateTime(roleConfirmationAt)}`
                : 'No confirmation recorded yet for this role.'}
            </p>
            <button className="primary-btn" type="button" disabled={busy} onClick={() => void confirmGovernanceEfficiency()}>
              Confirm Monthly Efficiency
            </button>
          </div>
        )}
      </section>

      <section className="panel-card settings-section">
        <h2>Roles, Rights, Responsibilities</h2>
        <p className="muted">Role scope and responsibilities are enforced by backend RBAC checks.</p>
        {rolePolicies.length === 0 ? (
          <p className="muted">No role policy data available.</p>
        ) : (
          <table className="docs-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Base Role</th>
                <th>User Mgmt</th>
                <th>Rights</th>
                <th>Scope</th>
                <th>Responsibilities</th>
              </tr>
            </thead>
            <tbody>
              {rolePolicies.map((policy) => (
                <tr key={policy.role}>
                  <td>{policy.role}</td>
                  <td>{policy.base_role}</td>
                  <td>{policy.can_create_users ? 'Yes' : 'No'}</td>
                  <td>
                    {[
                      policy.can_configure_team_capacity ? 'Team Capacity' : '',
                      policy.can_allocate_portfolio_quotas ? 'Portfolio Quotas' : '',
                      policy.can_submit_commitment ? 'Commitment Submit' : '',
                      policy.can_edit_roadmap ? 'Roadmap Edit' : '',
                      policy.can_manage_settings ? 'Settings' : '',
                    ]
                      .filter(Boolean)
                      .join(' | ') || 'None'}
                  </td>
                  <td>{policy.scope}</td>
                  <td>{policy.responsibilities.join(' | ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {isAdmin && (
        <section className="panel-card settings-section">
          <h2>Custom User Types (Admin)</h2>
          <p className="muted">
            Create extensible user types (for example AI Engineer, Data Scientist) with explicit rights mapped to a base role.
          </p>
          <div className="stack">
            <div className="split-4">
              <label>
                User Type Name
                <input
                  value={customRoleName}
                  disabled={busy}
                  onChange={(e) => setCustomRoleName(e.target.value)}
                  placeholder="AI Engineer"
                />
              </label>
              <label>
                Base Role
                <select value={customRoleBaseRole} disabled={busy} onChange={(e) => setCustomRoleBaseRole(e.target.value as SystemRole)}>
                  <option value="CEO">CEO</option>
                  <option value="VP">VP</option>
                  <option value="BA">BA</option>
                  <option value="PM">PM</option>
                  <option value="PO">PO</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>
              <label>
                Scope
                <input
                  value={customRoleScope}
                  disabled={busy}
                  onChange={(e) => setCustomRoleScope(e.target.value)}
                  placeholder="AI delivery and model lifecycle scope"
                />
              </label>
              <label>
                Responsibilities (one per line)
                <textarea
                  rows={3}
                  value={customRoleResponsibilities}
                  disabled={busy}
                  onChange={(e) => setCustomRoleResponsibilities(e.target.value)}
                />
              </label>
            </div>
            <div className="split-3">
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={customRoleRights.can_create_users}
                  disabled={busy}
                  onChange={(e) => setCustomRoleRights((s) => ({ ...s, can_create_users: e.target.checked }))}
                />
                <span>Can create users</span>
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={customRoleRights.can_configure_team_capacity}
                  disabled={busy}
                  onChange={(e) => setCustomRoleRights((s) => ({ ...s, can_configure_team_capacity: e.target.checked }))}
                />
                <span>Can configure team capacity</span>
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={customRoleRights.can_allocate_portfolio_quotas}
                  disabled={busy}
                  onChange={(e) => setCustomRoleRights((s) => ({ ...s, can_allocate_portfolio_quotas: e.target.checked }))}
                />
                <span>Can allocate portfolio quotas</span>
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={customRoleRights.can_submit_commitment}
                  disabled={busy}
                  onChange={(e) => setCustomRoleRights((s) => ({ ...s, can_submit_commitment: e.target.checked }))}
                />
                <span>Can submit commitment</span>
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={customRoleRights.can_edit_roadmap}
                  disabled={busy}
                  onChange={(e) => setCustomRoleRights((s) => ({ ...s, can_edit_roadmap: e.target.checked }))}
                />
                <span>Can edit roadmap</span>
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={customRoleRights.can_manage_settings}
                  disabled={busy}
                  onChange={(e) => setCustomRoleRights((s) => ({ ...s, can_manage_settings: e.target.checked }))}
                />
                <span>Can manage settings</span>
              </label>
            </div>
            <button
              className="primary-btn"
              type="button"
              disabled={busy || !customRoleName.trim()}
              onClick={async () => {
                await createCustomRole({
                  name: customRoleName.trim(),
                  base_role: customRoleBaseRole,
                  scope: customRoleScope.trim(),
                  responsibilities: customRoleResponsibilities
                    .split('\n')
                    .map((item) => item.trim())
                    .filter(Boolean),
                  can_create_users: customRoleRights.can_create_users,
                  can_configure_team_capacity: customRoleRights.can_configure_team_capacity,
                  can_allocate_portfolio_quotas: customRoleRights.can_allocate_portfolio_quotas,
                  can_submit_commitment: customRoleRights.can_submit_commitment,
                  can_edit_roadmap: customRoleRights.can_edit_roadmap,
                  can_manage_settings: customRoleRights.can_manage_settings,
                  is_active: true,
                })
                setCustomRoleName('')
                setCustomRoleScope('')
                setCustomRoleResponsibilities('')
                setCustomRoleRights({
                  can_create_users: false,
                  can_configure_team_capacity: false,
                  can_allocate_portfolio_quotas: false,
                  can_submit_commitment: true,
                  can_edit_roadmap: true,
                  can_manage_settings: false,
                })
              }}
            >
              Create Custom User Type
            </button>
          </div>
          <table className="docs-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Base Role</th>
                <th>Scope</th>
                <th>Rights</th>
                <th>Responsibilities</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {customRoles.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No custom user types defined.
                  </td>
                </tr>
              )}
              {customRoles.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td>{role.base_role}</td>
                  <td>{role.scope || '-'}</td>
                  <td>
                    {[
                      role.can_create_users ? 'User Mgmt' : '',
                      role.can_configure_team_capacity ? 'Team Capacity' : '',
                      role.can_allocate_portfolio_quotas ? 'Portfolio Quotas' : '',
                      role.can_submit_commitment ? 'Commitment' : '',
                      role.can_edit_roadmap ? 'Roadmap' : '',
                      role.can_manage_settings ? 'Settings' : '',
                    ]
                      .filter(Boolean)
                      .join(' | ') || 'None'}
                  </td>
                  <td>{role.responsibilities.join(' | ') || '-'}</td>
                  <td>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={role.is_active}
                        disabled={busy}
                        onChange={(e) => void updateCustomRole(role.id, { is_active: e.target.checked })}
                      />
                      <span>{role.is_active ? 'Active' : 'Inactive'}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {isAdmin && (
        <section className="panel-card settings-section">
          <h2>User Access Management (Admin)</h2>
          <p className="muted">Admin creates users, assigns base roles, and optionally maps users to custom user types.</p>
          <div className="stack">
            <div className="split-4">
              <label>
                Full Name
                <input value={newUserName} disabled={busy} onChange={(e) => setNewUserName(e.target.value)} placeholder="Jane Doe" />
              </label>
              <label>
                Email
                <input value={newUserEmail} disabled={busy} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="jane@company.com" />
              </label>
              <label>
                Role
                <select value={newUserRole} disabled={busy} onChange={(e) => setNewUserRole(e.target.value as SystemRole)}>
                  <option value="CEO">CEO</option>
                  <option value="VP">VP</option>
                  <option value="BA">BA</option>
                  <option value="PM">PM</option>
                  <option value="PO">PO</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>
              <label>
                Custom User Type
                <select value={newUserCustomRoleId} disabled={busy} onChange={(e) => setNewUserCustomRoleId(e.target.value)}>
                  <option value="">None</option>
                  {assignableCreateCustomRoles.map((role) => (
                    <option key={role.id} value={String(role.id)}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Temporary Password
                <input
                  type="password"
                  value={newUserPassword}
                  disabled={busy}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Strong password (12+ chars)"
                />
              </label>
            </div>
            {!isStrongPassword(newUserPassword) && newUserPassword.length > 0 && (
              <p className="muted">
                Password policy: {PASSWORD_MIN_LENGTH}-{PASSWORD_MAX_LENGTH} chars with uppercase, lowercase, number, and special character (no spaces).
              </p>
            )}
            <button
              className="primary-btn"
              type="button"
              disabled={busy || !newUserName.trim() || !newUserEmail.trim() || !isStrongPassword(newUserPassword)}
              onClick={async () => {
                await createPlatformUser({
                  full_name: newUserName.trim(),
                  email: newUserEmail.trim().toLowerCase(),
                  password: newUserPassword,
                  role: newUserRole,
                  custom_role_id: newUserCustomRoleId ? Number(newUserCustomRoleId) : null,
                })
                setNewUserName('')
                setNewUserEmail('')
                setNewUserPassword('')
                setNewUserRole('CEO')
                setNewUserCustomRoleId('')
              }}
            >
              Create User
            </button>
          </div>
          <table className="docs-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>User Type</th>
                <th>Status</th>
                <th>Password State</th>
                <th>Password Reset</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    No users found.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={busy}
                      onChange={(e) =>
                        void updatePlatformUser(u.id, {
                          role: e.target.value as SystemRole,
                          custom_role_id: null,
                        })
                      }
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="CEO">CEO</option>
                      <option value="VP">VP</option>
                      <option value="BA">BA</option>
                      <option value="PM">PM</option>
                      <option value="PO">PO</option>
                    </select>
                  </td>
                  <td>
                    <select
                      value={u.custom_role_id == null ? '' : String(u.custom_role_id)}
                      disabled={busy}
                      onChange={(e) =>
                        void updatePlatformUser(u.id, {
                          custom_role_id: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">None</option>
                      {customRoles
                        .filter((role) => role.is_active && role.base_role === u.role)
                        .map((role) => (
                          <option key={role.id} value={String(role.id)}>
                            {role.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={u.is_active}
                        disabled={busy}
                        onChange={(e) => void updatePlatformUser(u.id, { is_active: e.target.checked })}
                      />
                      <span>{u.is_active ? 'Active' : 'Inactive'}</span>
                    </label>
                  </td>
                  <td>
                    {u.force_password_change ? (
                      <span className="chip warning">Change Required</span>
                    ) : (
                      <span className="muted">Compliant</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <input
                        type="password"
                        placeholder="strong password"
                        value={resetPasswords[u.id] || ''}
                        disabled={busy}
                        onChange={(e) => setResetPasswords((s) => ({ ...s, [u.id]: e.target.value }))}
                      />
                      <button
                        className="ghost-btn tiny"
                        type="button"
                        disabled={busy || !isStrongPassword(resetPasswords[u.id] || '')}
                        onClick={async () => {
                          const pwd = (resetPasswords[u.id] || '').trim()
                          if (!isStrongPassword(pwd)) return
                          await updatePlatformUser(u.id, { password: pwd })
                          setResetPasswords((s) => ({ ...s, [u.id]: '' }))
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {isAdmin && (
        <section className="panel-card settings-section">
          <h2>Project Governance Document (Admin)</h2>
          <p className="muted">
            Download the ISO-style Resource Commitment & Capacity Governance document as a PDF generated from current system settings.
          </p>
          <div className="split-2">
            <label>
              Version
              <input value={docVersion} disabled={busy} onChange={(e) => setDocVersion(e.target.value)} placeholder="1.0" />
            </label>
            <label>
              Approved By
              <input value={docApprovedBy} disabled={busy} onChange={(e) => setDocApprovedBy(e.target.value)} placeholder="CEO" />
            </label>
          </div>
          <div className="split-2">
            <label>
              Document Level
              <select value={docLevel} disabled={busy} onChange={(e) => setDocLevel(e.target.value as 'l1' | 'l2')}>
                <option value="l1">L1 - Governance Specification</option>
                <option value="l2">L2 - Governance Doctrine (Board)</option>
              </select>
            </label>
          </div>
          <button
            className="primary-btn"
            type="button"
            disabled={busy}
            onClick={() =>
              void downloadProjectDocument({
                version: docVersion,
                approved_by: docApprovedBy,
                level: docLevel,
              })
            }
          >
            Download {docLevel.toUpperCase()} Document (PDF)
          </button>
        </section>
      )}

      <section className="panel-card">
        <h2>AI Provider Settings</h2>
        <p className="muted">
          Provider and model are logically linked. You can select a known model or switch to manual input for newer models.
          If active Gemini fails, the system will auto-try your latest saved `vertex_gemini` config as fallback.
        </p>

        <form className="stack" onSubmit={saveLLMConfig}>
          <div className="split-2">
            <label>
              Provider
              <select
                value={providerForm.provider}
                onChange={(e) => {
                  const provider = e.target.value
                  const nextModels = providerModelMap[provider] ?? []
                  setProviderForm((s) => ({
                    ...s,
                    provider,
                    model: nextModels[0] || s.model,
                    base_url: ['gemini', 'claude'].includes(provider) ? '' : s.base_url,
                  }))
                  setUseCustomModel(false)
                }}
              >
                {Object.keys(providerModelMap).map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Model (Preset)
              <select
                value={useCustomModel ? '__custom__' : providerForm.model}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '__custom__') {
                    setUseCustomModel(true)
                    return
                  }
                  setUseCustomModel(false)
                  setProviderForm((s) => ({ ...s, model: value }))
                }}
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="__custom__">Custom model...</option>
              </select>
            </label>
          </div>

          {useCustomModel && (
            <label>
              Model (Manual)
              <input
                value={providerForm.model}
                onChange={(e) => setProviderForm((s) => ({ ...s, model: e.target.value }))}
                placeholder="Type latest model name"
              />
            </label>
          )}

          {requiresBaseUrl && (
            <label>
              Base URL
              <input
                value={providerForm.base_url}
                onChange={(e) => setProviderForm((s) => ({ ...s, base_url: e.target.value }))}
                placeholder={
                  providerForm.provider === 'vertex_gemini'
                    ? 'https://us-central1-aiplatform.googleapis.com/v1/projects/<PROJECT>/locations/<LOCATION>/publishers/google/models'
                    : 'For Ollama: http://localhost:11434/v1'
                }
              />
            </label>
          )}

          <label>
            {providerForm.provider === 'vertex_gemini' ? 'Access Token' : 'API Key'}
            <input
              type="password"
              value={providerForm.api_key}
              onChange={(e) => setProviderForm((s) => ({ ...s, api_key: e.target.value }))}
              placeholder={
                providerForm.provider === 'vertex_gemini'
                  ? 'Optional: leave blank to use backend service-account credentials'
                  : 'Leave empty for local Ollama'
              }
            />
          </label>

          <div className="row-actions">
            <button className="primary-btn" disabled={busy} type="submit">
              Save as Active Provider
            </button>
            <button className="ghost-btn" disabled={busy} type="button" onClick={testLLMConfig}>
              Test Provider
            </button>
          </div>
        </form>
        {llmTestResult && (
          <div className={llmTestResult.ok ? 'success-note' : 'error-text'}>
            {llmTestResult.ok ? 'Connection successful.' : `Connection failed: ${llmTestResult.message}`}
          </div>
        )}
      </section>

      <section className="panel-card settings-section">
        <h3>LLM Configurations</h3>
        {activeConfig ? (
          <div className="settings-current">
            <span className="settings-label">Active</span>
            <div className="settings-config-inline">
              <span className="config-provider-inline">{activeConfig.provider}</span>
              <span className="config-model-inline">{activeConfig.model}</span>
            </div>
          </div>
        ) : (
          <div className="settings-current">
            <span className="settings-label">Active</span>
            <span className="settings-none">No active configuration</span>
          </div>
        )}
        {llmConfigs.length > 0 && (
          <div className="settings-saved">
            <span className="settings-label">Saved</span>
            <div className="settings-saved-list">
              {llmConfigs.map((cfg) => (
                <div key={cfg.id} className="settings-saved-item">
                  <span className="config-provider-inline">{cfg.provider}</span>
                  <span className="config-model-inline">{cfg.model}</span>
                  {cfg.is_active && <span className="active-dot" title="Active"></span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
