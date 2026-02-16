import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChatWidget } from './ChatWidget'
import { DetailedRoadmap } from './DetailedRoadmap'

type Dashboard = {
  intake_total: number
  intake_understanding_pending: number
  intake_draft: number
  commitments_total: number
  commitments_ready: number
  commitments_locked: number
  roadmap_total: number
  intake_by_context: Record<string, number>
  commitments_by_context: Record<string, number>
  roadmap_by_context: Record<string, number>
  intake_by_mode: Record<string, number>
  commitments_by_mode: Record<string, number>
  roadmap_by_mode: Record<string, number>
  commitments_by_priority: Record<string, number>
  roadmap_by_priority: Record<string, number>
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

type IntakeAnalysisPayload = {
  intake_item_id: number
  primary_type: string
  confidence: string
  output_json: Record<string, unknown>
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

type CurrentUser = {
  id: number
  full_name: string
  email: string
  role: 'ADMIN' | 'CEO' | 'VP' | 'BA' | 'PM' | 'PO'
  is_active: boolean
}

type UserAdmin = {
  id: number
  full_name: string
  email: string
  role: CurrentUser['role']
  is_active: boolean
}

type RolePolicy = {
  role: CurrentUser['role']
  can_create_users: boolean
  scope: string
  responsibilities: string[]
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
  created_at: string
}

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

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

function parsePercent(value: string | undefined): number {
  const n = Number(String(value || '').replace('%', '').trim())
  if (!Number.isFinite(n)) return 0
  return n
}

function capacityTone(usedPercent: number): 'ok' | 'warn' | 'error' {
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
          const used = Math.max(0, parsePercent(utilization[role]))
          const available = Math.max(0, 100 - used)
          const tone = capacityTone(used)
          const overBy = used > 100 ? used - 100 : 0
          return (
            <div key={role} className="capacity-meter-card">
              <div className="capacity-meter-head">
                <span>{role}</span>
                <span className={`capacity-meter-state ${tone}`}>
                  {used.toFixed(1)}% used
                </span>
              </div>
              <div className="capacity-meter-track" aria-hidden="true">
                <div
                  className={`capacity-meter-fill ${tone}`}
                  style={{ width: `${Math.min(used, 100)}%` }}
                />
              </div>
              <div className="capacity-meter-foot">
                <span className="muted">
                  {overBy > 0 ? `Over by ${overBy.toFixed(1)}%` : `Available ${available.toFixed(1)}%`}
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
    const pct = cap <= 0 ? (used <= 0 ? 0 : 999) : (used / cap) * 100
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
  const [rolePolicies, setRolePolicies] = useState<RolePolicy[]>([])
  const [useCustomModel, setUseCustomModel] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<LLMTestResult | null>(null)
  const [chatSupportRequest, setChatSupportRequest] = useState<{
    key: string
    intakeItemId: number
    title: string
  } | null>(null)

  const isLoggedIn = Boolean(token)

  const intakeByDocument = useMemo(() => {
    const map = new Map<number, IntakeItem>()
    for (const item of intakeItems) map.set(item.document_id, item)
    return map
  }, [intakeItems])

  const activeConfig = useMemo(() => llmConfigs.find((cfg) => cfg.is_active), [llmConfigs])

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
  const canManageCommitments = currentUser?.role === 'CEO' || currentUser?.role === 'VP'

  async function loadData(activeToken: string) {
    const [meRes, dashboardRes, docsRes, intakeRes, roadmapRes, roadmapPlanRes, redundancyRes, cfgRes, governanceRes, usersRes, rolePoliciesRes] =
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
    setBusy(true)
    setError('')
    try {
      await api(
        '/roadmap/items/bulk-delete',
        { method: 'POST', body: JSON.stringify({ ids }) },
        token,
      )
      setSelectedRoadmapIds([])
      setSelectedRoadmapId(null)
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function bulkDeleteDocuments() {
    if (!token || !selectedDocumentIds.length) return
    setBusy(true)
    setError('')
    try {
      await api('/documents/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: selectedDocumentIds }) }, token)
      setSelectedDocumentIds([])
      await loadData(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
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

  async function approveUnderstanding(itemId: number) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const item = await api<IntakeItem>(`/intake/items/${itemId}/approve-understanding`, { method: 'POST' }, token)
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

  async function submitReview(status: 'draft' | 'approved') {
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
    setBusy(true)
    setError('')
    try {
      const cfg = await api<GovernanceConfig>(
        '/settings/governance/team-config',
        {
          method: 'POST',
          body: JSON.stringify({
            team_fe: Math.max(0, Math.round(toNumberOrZero(payload.team_fe))),
            team_be: Math.max(0, Math.round(toNumberOrZero(payload.team_be))),
            team_ai: Math.max(0, Math.round(toNumberOrZero(payload.team_ai))),
            team_pm: Math.max(0, Math.round(toNumberOrZero(payload.team_pm))),
            efficiency_fe: Math.max(0, toNumberOrZero(payload.efficiency_fe)),
            efficiency_be: Math.max(0, toNumberOrZero(payload.efficiency_be)),
            efficiency_ai: Math.max(0, toNumberOrZero(payload.efficiency_ai)),
            efficiency_pm: Math.max(0, toNumberOrZero(payload.efficiency_pm)),
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
    setBusy(true)
    setError('')
    try {
      const cfg = await api<GovernanceConfig>(
        '/settings/governance/portfolio-quotas',
        {
          method: 'POST',
          body: JSON.stringify({
            quota_client: Math.max(0, toNumberOrZero(payload.quota_client)),
            quota_internal: Math.max(0, toNumberOrZero(payload.quota_internal)),
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

  async function createPlatformUser(payload: {
    full_name: string
    email: string
    password: string
    role: CurrentUser['role']
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
      role?: CurrentUser['role']
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
    setRolePolicies([])
    setIntakeHistory([])
    setSelectedAnalysis(null)
    setSelectedRoadmapIds([])
    setSelectedDocumentIds([])
    setLlmTestResult(null)
  }

  useEffect(() => {
    if (!token) return
    loadData(token).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    })
  }, [token])

  useEffect(() => {
    const options = providerModelMap[providerForm.provider] ?? []
    if (!useCustomModel && options.length > 0 && !options.includes(providerForm.model)) {
      setProviderForm((s) => ({ ...s, model: options[0] }))
    }
  }, [providerForm.provider, providerForm.model, useCustomModel])

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
          <NavLink to="/detailed-roadmap" className={({ isActive }) => (isActive ? 'top-link active' : 'top-link')}>
            Analytics
          </NavLink>
        </div>
        <div className="top-right">
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

      <Routes>
        <Route
          path="/dashboard"
          element={
            <DashboardPage
              dashboard={dashboard}
              roadmapPlanItems={roadmapPlanItems}
              governanceConfig={governanceConfig}
            />
          }
        />
        <Route
          path="/intake"
          element={
            <IntakePage
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
              updateReviewActivity={updateReviewActivity}
              toggleReviewActivityTag={toggleReviewActivityTag}
              addReviewActivity={addReviewActivity}
              removeReviewActivity={removeReviewActivity}
              submitReview={submitReview}
              intakeHistory={intakeHistory}
              selectedAnalysis={selectedAnalysis}
              isCEO={isCEO}
              approveUnderstanding={approveUnderstanding}
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
              roadmapScope={roadmapScope}
              setRoadmapScope={setRoadmapScope}
              roadmapActivities={roadmapActivities}
              setRoadmapActivities={setRoadmapActivities}
              roadmapDeliveryMode={roadmapDeliveryMode}
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
              updateRoadmapPlanItem={updateRoadmapPlanItem}
              validateCapacity={validateCapacity}
              downloadRoadmapPlanExcel={downloadRoadmapPlanExcel}
              busy={busy}
            />
          }
        />
        <Route
          path="/detailed-roadmap"
          element={<DetailedRoadmap roadmapPlanItems={roadmapPlanItems} governanceConfig={governanceConfig} busy={busy} />}
        />
        <Route
          path="/settings"
          element={
            <SettingsPage
              activeConfig={activeConfig || null}
              llmConfigs={llmConfigs}
              governanceConfig={governanceConfig}
              users={users}
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
              createPlatformUser={createPlatformUser}
              updatePlatformUser={updatePlatformUser}
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
  roadmapPlanItems: RoadmapPlanItem[]
  governanceConfig: GovernanceConfig | null
}

function DashboardPage({ dashboard, roadmapPlanItems, governanceConfig }: DashboardProps) {
  const count = (m: Record<string, number> | undefined, key: string) => Number(m?.[key] || 0)
  const today = useMemo(() => new Date(), [])
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

  const stageData = [
    { stage: 'Intake', count: dashboard?.intake_total || 0 },
    { stage: 'Commitments', count: dashboard?.commitments_total || 0 },
    { stage: 'Roadmap', count: dashboard?.roadmap_total || 0 },
  ]
  const contextData = [
    {
      stage: 'Intake',
      client: count(dashboard?.intake_by_context, 'client'),
      internal: count(dashboard?.intake_by_context, 'internal'),
    },
    {
      stage: 'Commitments',
      client: count(dashboard?.commitments_by_context, 'client'),
      internal: count(dashboard?.commitments_by_context, 'internal'),
    },
    {
      stage: 'Roadmap',
      client: count(dashboard?.roadmap_by_context, 'client'),
      internal: count(dashboard?.roadmap_by_context, 'internal'),
    },
  ]
  const modeData = [
    {
      stage: 'Intake',
      standard: count(dashboard?.intake_by_mode, 'standard'),
      rnd: count(dashboard?.intake_by_mode, 'rnd'),
    },
    {
      stage: 'Commitments',
      standard: count(dashboard?.commitments_by_mode, 'standard'),
      rnd: count(dashboard?.commitments_by_mode, 'rnd'),
    },
    {
      stage: 'Roadmap',
      standard: count(dashboard?.roadmap_by_mode, 'standard'),
      rnd: count(dashboard?.roadmap_by_mode, 'rnd'),
    },
  ]
  const priorityData = [
    {
      priority: 'High',
      commitments: count(dashboard?.commitments_by_priority, 'high'),
      roadmap: count(dashboard?.roadmap_by_priority, 'high'),
    },
    {
      priority: 'Medium',
      commitments: count(dashboard?.commitments_by_priority, 'medium'),
      roadmap: count(dashboard?.roadmap_by_priority, 'medium'),
    },
    {
      priority: 'Low',
      commitments: count(dashboard?.commitments_by_priority, 'low'),
      roadmap: count(dashboard?.roadmap_by_priority, 'low'),
    },
  ]

  return (
    <main className="page-wrap">
      <section className="stats-row">
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
          <h3>Stage Volume</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceaf5" />
                <XAxis dataKey="stage" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#7c3aed" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel-card">
          <h3>Classification by Context</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={contextData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceaf5" />
                <XAxis dataKey="stage" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="client" fill="#7c3aed" />
                <Bar dataKey="internal" fill="#c4b5fd" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="card-grid two">
        <article className="panel-card">
          <h3>Classification by Mode</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={modeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceaf5" />
                <XAxis dataKey="stage" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="standard" fill="#7c3aed" />
                <Bar dataKey="rnd" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="panel-card">
          <h3>Priority Split (Commitments vs Roadmap)</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceaf5" />
                <XAxis dataKey="priority" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="commitments" fill="#7c3aed" />
                <Bar dataKey="roadmap" fill="#c4b5fd" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </main>
  )
}

type IntakeProps = {
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
  updateReviewActivity: (index: number, value: string) => void
  toggleReviewActivityTag: (index: number, tag: ActivityTag) => void
  addReviewActivity: () => void
  removeReviewActivity: (index: number) => void
  submitReview: (status: 'draft' | 'approved') => Promise<void>
  intakeHistory: VersionItem[]
  selectedAnalysis: IntakeAnalysisPayload | null
  isCEO: boolean
  approveUnderstanding: (itemId: number) => Promise<void>
  createManualIntake: (payload: ManualIntakeIn) => Promise<void>
  selectedDocumentIds: number[]
  setSelectedDocumentIds: Dispatch<SetStateAction<number[]>>
  bulkDeleteDocuments: () => Promise<void>
  busy: boolean
  fetchDocumentBlob: (documentId: number) => Promise<{ blob: Blob; contentType: string }>
  setErrorMessage: Dispatch<SetStateAction<string>>
  requestIntakeSupport: (item: IntakeItem) => void
}

function IntakePage({
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
  updateReviewActivity,
  toggleReviewActivityTag,
  addReviewActivity,
  removeReviewActivity,
  submitReview,
  intakeHistory,
  selectedAnalysis,
  isCEO,
  approveUnderstanding,
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
  const supportTriggerRef = useRef('')
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

  const allDocumentsSelected = documents.length > 0 && documents.every((doc) => selectedDocumentIds.includes(doc.id))
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
  const analysisRun = selectedAnalysisForItem?.output_json?.analysis_run as { run_id?: string } | undefined
  const isUnderstandingPending = selectedIntakeItem?.status === 'understanding_pending'
  const isIntentUnclear = understandingCheck?.['Primary intent (1 sentence)'] === 'Document intent is unclear.'
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

  useEffect(() => {
    if (!selectedIntakeItem || !selectedAnalysisForItem || !isUnderstandingPending || !isIntentUnclear) {
      supportTriggerRef.current = ''
      return
    }
    const dedupeKey = `${selectedIntakeItem.id}:${analysisRun?.run_id || 'no-run'}`
    if (supportTriggerRef.current === dedupeKey) return
    supportTriggerRef.current = dedupeKey
    requestIntakeSupport(selectedIntakeItem)
  }, [selectedIntakeItem, selectedAnalysisForItem, isUnderstandingPending, isIntentUnclear, analysisRun?.run_id, requestIntakeSupport])
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
          {isCEO && (
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
                {isCEO && (
                  <th>
                    <input
                      type="checkbox"
                      checked={allDocumentsSelected}
                      onChange={(e) =>
                        setSelectedDocumentIds(e.target.checked ? documents.map((doc) => doc.id) : [])
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
                    <td colSpan={isCEO ? 10 : 9} className="muted">
                      No documents uploaded yet.
                    </td>
                  </tr>
                )}
              {queueRows.map((row) => (
                <tr key={row.doc.id}>
                  {isCEO && (
                    <td>
                      <input
                        type="checkbox"
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
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel-card">
        <h3>{isUnderstandingPending ? 'Understanding Review' : 'Candidate Review'}</h3>
        {selectedIntakeItem ? (
          <div className="stack">
            {isUnderstandingPending && understandingCheck ? (
              <>
                <div className="understanding-card">
                  <div className="understanding-row">
                    <span className="understanding-label">Primary intent</span>
                    <span>{understandingCheck['Primary intent (1 sentence)'] || '-'}</span>
                  </div>
                  <div className="understanding-row">
                    <span className="understanding-label">Explicit outcomes</span>
                    <ul className="understanding-list">
                      {(understandingCheck['Explicit outcomes (bullet list)'] || []).map((outcome, i) => (
                        <li key={`${outcome}-${i}`}>{outcome}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="understanding-row">
                    <span className="understanding-label">Dominant theme</span>
                    <span>{understandingCheck['Dominant capability/theme (1 phrase)'] || '-'}</span>
                  </div>
                  <div className="understanding-meta">
                    <span>Confidence: {understandingCheck.Confidence || '-'}</span>
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
                    <p>Approval is blocked because intent is unclear.</p>
                    <ol>
                      <li>Use the eye icon to inspect the uploaded document content quickly.</li>
                      <li>Go to Settings, test provider/model, and switch if needed.</li>
                      <li>Re-run understanding after fixing provider or uploading a clearer BRD/RFP.</li>
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
                {!isIntentUnclear && supportResolution?.applied && (
                  <p className="success-text">
                    Intake Support resolved understanding. Next step: approve understanding and generate candidate.
                  </p>
                )}
                <button
                  className="primary-btn"
                  type="button"
                  disabled={busy || isIntentUnclear}
                  onClick={() => approveUnderstanding(selectedIntakeItem.id)}
                >
                  Approve Understanding and Generate Candidate
                </button>
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

            <div className="activity-editor">
              <div className="line-item">
                <strong>Activities (inline edit)</strong>
                <button className="ghost-btn tiny" type="button" onClick={addReviewActivity}>
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
                  {reviewActivities.map((activity, idx) => {
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
                  <option value="rnd">R&D</option>
                </select>
              </label>
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
                  <option value="rnd">R&D</option>
                </select>
              </label>
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
                disabled={busy || !manualForm.title.trim()}
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
            Upload BRD/PPT/Excel/RFP to classify and extract activities for project bucket placement.
          </p>

          <form className="upload-inline" onSubmit={handleUpload}>
            <input
              key={uploadPickerKey}
              ref={uploadInputRef}
              type="file"
              multiple
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
  roadmapScope: string
  setRoadmapScope: Dispatch<SetStateAction<string>>
  roadmapActivities: string[]
  setRoadmapActivities: Dispatch<SetStateAction<string[]>>
  roadmapDeliveryMode: string
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
  roadmapScope,
  setRoadmapScope,
  roadmapActivities,
  setRoadmapActivities,
  roadmapDeliveryMode,
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
  canManageCommitments,
  setSelectedRoadmapIds,
  bulkDeleteRoadmap,
  roadmapMove,
  setRoadmapMove,
  validateCapacity,
  saveRoadmapCandidate,
  commitSelectedToRoadmap,
  unlockRoadmapCommitment,
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
                    {isCEO && isActive && (
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
                  {`${formatPriority(item.priority)} • ${item.delivery_mode === 'rnd' ? 'R&D' : formatInitiative(item.initiative_type)} • ${item.activities.length} activities`}
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
                </div>
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

            {!isLocked && canCommit && (
              <button
                className="primary-btn commit-cta"
                type="button"
                disabled={busy || !hasDuration || !hasResourceFte || !capacityApproved}
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
            {!isLocked && canCommit && !hasDuration && (
              <p className="muted">Set tentative duration (weeks) to enable commitment confirmation.</p>
            )}
            {!isLocked && canCommit && hasDuration && !hasResourceFte && (
              <p className="muted">Set FE/BE/AI/PM FTE to enable commitment confirmation.</p>
            )}
            {!isLocked && canCommit && hasDuration && !capacityApproved && (
              <p className="error-text">Capacity is overallocated. Reduce FTE or duration before committing.</p>
            )}

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
  updateRoadmapPlanItem,
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
  const currentYear = new Date().getFullYear()
  const [yearView, setYearView] = useState(currentYear)

  const selectedPlan = useMemo(
    () => roadmapPlanItems.find((x) => x.id === selectedPlanId) || null,
    [roadmapPlanItems, selectedPlanId],
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
            <button
              className="primary-btn"
              type="button"
              disabled={
                busy ||
                !planStart ||
                !planEnd ||
                !!planCapacityError ||
                planCapacityBusy ||
                planCapacityValidation?.status === 'REJECTED'
              }
              onClick={savePlan}
            >
              Save Plan
            </button>
          </div>
        ) : (
          <p className="muted">Select a bar in Gantt to plan dates/resources/dependencies.</p>
        )}
      </section>
    </main>
  )
}

type SettingsProps = {
  activeConfig: LLMConfig | null
  llmConfigs: LLMConfig[]
  governanceConfig: GovernanceConfig | null
  users: UserAdmin[]
  rolePolicies: RolePolicy[]
  currentUserRole: CurrentUser['role']
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
  createPlatformUser: (payload: {
    full_name: string
    email: string
    password: string
    role: CurrentUser['role']
  }) => Promise<void>
  updatePlatformUser: (
    userId: number,
    payload: {
      full_name?: string
      role?: CurrentUser['role']
      password?: string
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
  createPlatformUser,
  updatePlatformUser,
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
  const [newUserRole, setNewUserRole] = useState<CurrentUser['role']>('CEO')
  const [docVersion, setDocVersion] = useState('1.0')
  const [docApprovedBy, setDocApprovedBy] = useState('CEO')
  const [docLevel, setDocLevel] = useState<'l1' | 'l2'>('l1')
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({})

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
                <input type="number" min={0} value={teamFe} disabled={!canEditTeam || busy} onChange={(e) => setTeamFe(e.target.value)} />
              </label>
              <label>
                BE Team Size
                <input type="number" min={0} value={teamBe} disabled={!canEditTeam || busy} onChange={(e) => setTeamBe(e.target.value)} />
              </label>
              <label>
                AI Team Size
                <input type="number" min={0} value={teamAi} disabled={!canEditTeam || busy} onChange={(e) => setTeamAi(e.target.value)} />
              </label>
              <label>
                PM Team Size
                <input type="number" min={0} value={teamPm} disabled={!canEditTeam || busy} onChange={(e) => setTeamPm(e.target.value)} />
              </label>
            </div>
            <div className="split-4">
              <label>
                FE Efficiency
                <input type="number" min={0} step="0.05" value={effFe} disabled={!canEditTeam || busy} onChange={(e) => setEffFe(e.target.value)} />
              </label>
              <label>
                BE Efficiency
                <input type="number" min={0} step="0.05" value={effBe} disabled={!canEditTeam || busy} onChange={(e) => setEffBe(e.target.value)} />
              </label>
              <label>
                AI Efficiency
                <input type="number" min={0} step="0.05" value={effAi} disabled={!canEditTeam || busy} onChange={(e) => setEffAi(e.target.value)} />
              </label>
              <label>
                PM Efficiency
                <input type="number" min={0} step="0.05" value={effPm} disabled={!canEditTeam || busy} onChange={(e) => setEffPm(e.target.value)} />
              </label>
            </div>
            <button
              className="primary-btn"
              type="button"
              disabled={!canEditTeam || busy}
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
                  disabled={!canEditQuotas || busy}
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
                  disabled={!canEditQuotas || busy}
                  onChange={(e) => setQuotaInternal(e.target.value)}
                />
              </label>
            </div>
            <p className="muted">Total quota should be ≤ 1.00 across client and internal portfolios.</p>
            <button
              className="primary-btn"
              type="button"
              disabled={!canEditQuotas || busy}
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
                <th>User Mgmt</th>
                <th>Scope</th>
                <th>Responsibilities</th>
              </tr>
            </thead>
            <tbody>
              {rolePolicies.map((policy) => (
                <tr key={policy.role}>
                  <td>{policy.role}</td>
                  <td>{policy.can_create_users ? 'Yes' : 'No'}</td>
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
          <h2>User Access Management (Admin)</h2>
          <p className="muted">Admin creates and maintains CEO, VP, BA, PM, and PO user accounts.</p>
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
                <select value={newUserRole} disabled={busy} onChange={(e) => setNewUserRole(e.target.value as CurrentUser['role'])}>
                  <option value="CEO">CEO</option>
                  <option value="VP">VP</option>
                  <option value="BA">BA</option>
                  <option value="PM">PM</option>
                  <option value="PO">PO</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>
              <label>
                Temporary Password
                <input
                  type="password"
                  value={newUserPassword}
                  disabled={busy}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="min 8 chars"
                />
              </label>
            </div>
            <button
              className="primary-btn"
              type="button"
              disabled={busy || !newUserName.trim() || !newUserEmail.trim() || newUserPassword.length < 8}
              onClick={async () => {
                await createPlatformUser({
                  full_name: newUserName.trim(),
                  email: newUserEmail.trim().toLowerCase(),
                  password: newUserPassword,
                  role: newUserRole,
                })
                setNewUserName('')
                setNewUserEmail('')
                setNewUserPassword('')
                setNewUserRole('CEO')
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
                <th>Status</th>
                <th>Password Reset</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
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
                      onChange={(e) => void updatePlatformUser(u.id, { role: e.target.value as CurrentUser['role'] })}
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
                    <div className="row-actions">
                      <input
                        type="password"
                        placeholder="new password"
                        value={resetPasswords[u.id] || ''}
                        disabled={busy}
                        onChange={(e) => setResetPasswords((s) => ({ ...s, [u.id]: e.target.value }))}
                      />
                      <button
                        className="ghost-btn tiny"
                        type="button"
                        disabled={busy || (resetPasswords[u.id] || '').length < 8}
                        onClick={async () => {
                          const pwd = (resetPasswords[u.id] || '').trim()
                          if (pwd.length < 8) return
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
