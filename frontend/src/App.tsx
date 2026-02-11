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
}

type CurrentUser = {
  id: number
  full_name: string
  email: string
  role: 'CEO' | 'VP' | 'BA' | 'PM'
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
  { label: 'CEO', email: 'ceo@local.test' },
  { label: 'VP', email: 'vp@local.test' },
  { label: 'BA', email: 'ba@local.test' },
  { label: 'PM', email: 'pm@local.test' },
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
  const [useCustomModel, setUseCustomModel] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<LLMTestResult | null>(null)

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

  const isCEO = currentUser?.role === 'CEO'
  const canManageCommitments = currentUser?.role === 'CEO' || currentUser?.role === 'VP'

  async function loadData(activeToken: string) {
    const [meRes, dashboardRes, docsRes, intakeRes, roadmapRes, roadmapPlanRes, redundancyRes, cfgRes] =
      await Promise.allSettled([
        api<CurrentUser>('/auth/me', {}, activeToken),
        api<Dashboard>('/dashboard/summary', {}, activeToken),
        api<DocumentItem[]>('/documents', {}, activeToken),
        api<IntakeItem[]>('/intake/items', {}, activeToken),
        api<RoadmapItem[]>('/roadmap/items', {}, activeToken),
        api<RoadmapPlanItem[]>('/roadmap/plan/items', {}, activeToken),
        api<RoadmapRedundancy[]>('/roadmap/items/redundancy', {}, activeToken),
        api<LLMConfig[]>('/settings/llm', {}, activeToken),
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
      setReviewActivities(item.activities.length ? item.activities : [''])
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
      setReviewActivities(item.activities.length ? item.activities : [''])
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
      setReviewActivities(item.activities.length ? item.activities : [''])
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
    setReviewTitle(item.title)
    setReviewScope(item.scope)
    setReviewActivities(item.activities.length ? item.activities : [''])
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
    setReviewActivities((items) => [...items, ''])
  }

  function updateReviewActivity(index: number, value: string) {
    setReviewActivities((items) => items.map((it, i) => (i === index ? value : it)))
  }

  function removeReviewActivity(index: number) {
    setReviewActivities((items) => items.filter((_, i) => i !== index))
  }

  async function startRoadmapEdit(item: RoadmapItem) {
    setSelectedRoadmapId(item.id)
    setRoadmapTitle(item.title)
    setRoadmapScope(item.scope)
    setRoadmapActivities(item.activities.length ? item.activities : [''])
    setRoadmapPriority(item.priority || 'medium')
    setRoadmapProjectContext(item.project_context || 'client')
    setRoadmapInitiativeType(item.initiative_type || 'new_feature')
    setRoadmapDeliveryMode(item.delivery_mode || 'standard')
    setRoadmapRndHypothesis(item.rnd_hypothesis || '')
    setRoadmapRndExperimentGoal(item.rnd_experiment_goal || '')
    setRoadmapRndSuccessCriteria(item.rnd_success_criteria || '')
    setRoadmapRndTimeboxWeeks(item.rnd_timebox_weeks ?? null)
    setRoadmapRndDecisionDate(item.rnd_decision_date || '')
    setRoadmapRndNextGate(item.rnd_next_gate || '')
    setRoadmapRndRiskLevel(item.rnd_risk_level || '')
    setRoadmapAccountablePerson(item.accountable_person || '')
    setRoadmapPickedUp(Boolean(item.picked_up))
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
          body: JSON.stringify({
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
            accountable_person: roadmapAccountablePerson,
            picked_up: roadmapPickedUp,
          }),
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
        <Route path="/dashboard" element={<DashboardPage dashboard={dashboard} />} />
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
              roadmapActivities={roadmapActivities}
              roadmapDeliveryMode={roadmapDeliveryMode}
              roadmapRndHypothesis={roadmapRndHypothesis}
              roadmapRndExperimentGoal={roadmapRndExperimentGoal}
              roadmapRndSuccessCriteria={roadmapRndSuccessCriteria}
              roadmapRndTimeboxWeeks={roadmapRndTimeboxWeeks}
              roadmapRndDecisionDate={roadmapRndDecisionDate}
              roadmapRndNextGate={roadmapRndNextGate}
              roadmapRndRiskLevel={roadmapRndRiskLevel}
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
              downloadRoadmapPlanExcel={downloadRoadmapPlanExcel}
              busy={busy}
            />
          }
        />
        <Route
          path="/detailed-roadmap"
          element={<DetailedRoadmap roadmapPlanItems={roadmapPlanItems} busy={busy} />}
        />
        <Route
          path="/settings"
          element={
            <SettingsPage
              activeConfig={activeConfig || null}
              llmConfigs={llmConfigs}
              providerForm={providerForm}
              setProviderForm={setProviderForm}
              useCustomModel={useCustomModel}
              setUseCustomModel={setUseCustomModel}
              saveLLMConfig={saveLLMConfig}
              testLLMConfig={testLLMConfig}
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
}

function DashboardPage({ dashboard }: DashboardProps) {
  const count = (m: Record<string, number> | undefined, key: string) => Number(m?.[key] || 0)
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
  const [previewMode, setPreviewMode] = useState<'inline_file' | 'extracted_text' | 'download_only'>('inline_file')
  const [previewText, setPreviewText] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
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
  const understandingCheck = selectedAnalysis?.output_json?.document_understanding_check as
    | {
        'Primary intent (1 sentence)'?: string
        'Explicit outcomes (bullet list)'?: string[]
        'Dominant capability/theme (1 phrase)'?: string
        Confidence?: string
      }
    | undefined
  const llmRuntime = selectedAnalysis?.output_json?.llm_runtime as
    | { provider?: string; model?: string; attempted?: boolean; success?: boolean; error?: string }
    | undefined
  const parserCoverage = selectedAnalysis?.output_json?.parser_coverage as
    | { units_processed?: number; pages_detected?: number[] }
    | undefined
  const isUnderstandingPending = selectedIntakeItem?.status === 'understanding_pending'
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

  async function openPreview(doc: DocumentItem) {
    setPreviewError('')
    setPreviewLoading(true)
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const meta = await api<{ mode: 'inline_file' | 'extracted_text' | 'download_only'; file_type: string; preview_text?: string }>(
        `/documents/${doc.id}/preview`,
        {},
        token || undefined,
      )
      setPreviewTitle(doc.file_name)
      setPreviewMode(meta.mode)
      setPreviewText(meta.preview_text || '')
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
    setPreviewText('')
    setPreviewTitle('')
  }

  return (
    <>
      <main className="page-wrap">
        <section className="panel-card">
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
                    className="ghost-btn tiny icon-only"
                    type="button"
                    title="View document"
                    disabled={busy || !token}
                    onClick={() => openPreview(row.doc)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M12 5c5.5 0 9.9 4.3 11 6.8-1.1 2.5-5.5 6.7-11 6.7S2.1 14.3 1 11.8C2.1 9.3 6.5 5 12 5zm0 2C8.2 7 4.9 9.7 3.5 11.8 4.9 14 8.2 16.5 12 16.5s7.1-2.5 8.5-4.7C19.1 9.7 15.8 7 12 7zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z" />
                    </svg>
                  </button>
                  {!row.intake && (
                    <button
                      className="ghost-btn tiny intake-action-btn"
                      type="button"
                      disabled={busy || !token}
                      onClick={() => {
                        if (isCEO) {
                          setMetaModalDoc(row.doc)
                          return
                        }
                        void analyzeDocument(row.doc.id)
                      }}
                    >
                      Understand
                    </button>
                  )}
                  {row.intake && (
                    <button className="intake-review-btn" type="button" onClick={() => startReview(row.intake!)}>
                      Review
                    </button>
                  )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
                {understandingCheck['Primary intent (1 sentence)'] === 'Document intent is unclear.' && (
                  <div className="error-text">
                    <p>Approval is blocked because intent is unclear.</p>
                    <ol>
                      <li>Use the eye icon to inspect the uploaded document content quickly.</li>
                      <li>Go to Settings, test provider/model, and switch if needed.</li>
                      <li>Re-run understanding after fixing provider or uploading a clearer BRD/RFP.</li>
                    </ol>
                    <div className="row-actions">
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
                <button
                  className="primary-btn"
                  type="button"
                  disabled={busy || understandingCheck['Primary intent (1 sentence)'] === 'Document intent is unclear.'}
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
                    <th>Activity</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewActivities.map((activity, idx) => (
                    <tr key={`${idx}-${activity}`}>
                      <td>{idx + 1}</td>
                      <td>
                        <input
                          className="activity-input"
                          value={activity}
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
                  ))}
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
            <div className="line-item">
              <h3>{previewTitle}</h3>
              <button className="ghost-btn tiny" type="button" onClick={closePreview}>
                Close
              </button>
            </div>
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
                  <p className="muted">Content preview (text extracted from uploaded file):</p>
                  <pre className="doc-preview-text">{previewText || 'No readable text found in document.'}</pre>
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
      )}

      {metaModalDoc && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
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
  roadmapActivities: string[]
  roadmapDeliveryMode: string
  roadmapRndHypothesis: string
  roadmapRndExperimentGoal: string
  roadmapRndSuccessCriteria: string
  roadmapRndTimeboxWeeks: number | null
  roadmapRndDecisionDate: string
  roadmapRndNextGate: string
  roadmapRndRiskLevel: string
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
  roadmapActivities,
  roadmapDeliveryMode,
  roadmapRndHypothesis,
  roadmapRndExperimentGoal,
  roadmapRndSuccessCriteria,
  roadmapRndTimeboxWeeks,
  roadmapRndDecisionDate,
  roadmapRndNextGate,
  roadmapRndRiskLevel,
  roadmapAccountablePerson,
  setRoadmapAccountablePerson,
  setRoadmapPickedUp,
  isCEO,
  canManageCommitments,
  setSelectedRoadmapIds,
  bulkDeleteRoadmap,
  roadmapMove,
  setRoadmapMove,
  commitSelectedToRoadmap,
  unlockRoadmapCommitment,
  applyRedundancyDecision,
  busy,
}: RoadmapProps) {
  const [readiness, setReadiness] = useState<'explore_later' | 'shape_this_quarter' | 'ready_to_commit'>('shape_this_quarter')
  const [horizon, setHorizon] = useState<'near_term' | 'mid_term' | 'long_term' | ''>('')

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
                {roadmapActivities.length > 0 ? roadmapActivities.map((a, i) => <li key={`${i}-${a}`}>{a}</li>) : <li>-</li>}
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
                disabled={busy}
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
  downloadRoadmapPlanExcel: (filters: {
    year: number
    priority: string
    context: string
    mode: string
    period: string
  }) => Promise<void>
  busy: boolean
}

function RoadmapAgentPage({ roadmapPlanItems, updateRoadmapPlanItem, downloadRoadmapPlanExcel, busy }: RoadmapAgentProps) {
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [contextFilter, setContextFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [planStart, setPlanStart] = useState('')
  const [planEnd, setPlanEnd] = useState('')
  const [planResourceCount, setPlanResourceCount] = useState('')
  const [planEffort, setPlanEffort] = useState('')
  const [planStatus, setPlanStatus] = useState('not_started')
  const [planConfidence, setPlanConfidence] = useState('medium')
  const [planDepsText, setPlanDepsText] = useState('')
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
    setPlanResourceCount(selectedPlan.resource_count === null ? '' : String(selectedPlan.resource_count))
    setPlanEffort(selectedPlan.effort_person_weeks === null ? '' : String(selectedPlan.effort_person_weeks))
    setPlanStatus(selectedPlan.planning_status || 'not_started')
    setPlanConfidence(selectedPlan.confidence || 'medium')
    setPlanDepsText((selectedPlan.dependency_ids || []).join(', '))
  }, [selectedPlan])

  const yearlyPlan = useMemo(() => {
    const totalItems = filtered.length
    const totalResources = filtered.reduce((a, i) => a + (i.resource_count || 0), 0)
    const totalEffort = filtered.reduce((a, i) => a + (i.effort_person_weeks || 0), 0)
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
    const deps = planDepsText
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n) && n > 0 && n !== selectedPlan.id)
    await updateRoadmapPlanItem(selectedPlan.id, {
      planned_start_date: planStart,
      planned_end_date: planEnd,
      resource_count: planResourceCount ? Number(planResourceCount) : null,
      effort_person_weeks: planEffort ? Number(planEffort) : null,
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
        <p className="muted">Plan committed items with dates, effort, resources, quarter views, and yearly roll-up.</p>
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
                <input type="number" min={0} value={planResourceCount} onChange={(e) => setPlanResourceCount(e.target.value)} />
              </label>
              <label>
                Effort (Person-Weeks)
                <input type="number" min={0} value={planEffort} onChange={(e) => setPlanEffort(e.target.value)} />
              </label>
            </div>
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
            <button className="primary-btn" type="button" disabled={busy} onClick={savePlan}>
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
  llmTestResult: LLMTestResult | null
  busy: boolean
}

function SettingsPage({
  activeConfig,
  llmConfigs,
  providerForm,
  setProviderForm,
  useCustomModel,
  setUseCustomModel,
  saveLLMConfig,
  testLLMConfig,
  llmTestResult,
  busy,
}: SettingsProps) {
  const modelOptions = providerModelMap[providerForm.provider] ?? []
  const requiresBaseUrl = ['ollama', 'openai_compatible', 'glm', 'qwen', 'vertex_gemini'].includes(providerForm.provider)

  return (
    <main className="page-wrap">
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
