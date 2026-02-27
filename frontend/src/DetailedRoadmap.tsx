import { useMemo, useState } from 'react'

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
  fs_fte: number | null
  accountable_person: string
  entered_roadmap_at: string
  planned_start_date: string
  planned_end_date: string
  resource_count: number | null
  effort_person_weeks: number | null
  tentative_duration_weeks: number | null
  pickup_period: string
  completion_period: string
  planning_status: string
  confidence: string
  dependency_ids: number[]
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

type DetailedRoadmapProps = {
  roadmapPlanItems: RoadmapPlanItem[]
  governanceConfig: GovernanceConfig | null
  busy: boolean
}

type ViewMode = 'quarterly' | 'project' | 'task'
type QuarterFilter = 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'
type ProjectTypeFilter = 'all' | 'client' | 'internal' | 'rnd'

type TaskDecomposition = {
  itemId: number
  title: string
  projectContext: string
  deliveryMode: string
  priority: string
  activities: ActivityTask[]
  totalEstimatedWeeks: number
  plannedStart: string
  plannedEnd: string
  resources: number
  effort: number
  durationWeeks: number
  feFte: number
  beFte: number
  aiFte: number
  pmFte: number
}

type ActivityTask = {
  name: string
  estimatedWeeks: number
  quarter: string
}

export function DetailedRoadmap({ roadmapPlanItems, governanceConfig, busy }: DetailedRoadmapProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('task')
  const [quarterFilter, setQuarterFilter] = useState<QuarterFilter>('all')
  const [projectTypeFilter, setProjectTypeFilter] = useState<ProjectTypeFilter>('all')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  // Helper function to get quarter from date (Financial Year: April-March)
  // Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar
  const getQuarter = (dateStr: string): 'Q1' | 'Q2' | 'Q3' | 'Q4' | '' => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return ''
    const month = date.getMonth()
    // Financial year: April (3) to March (2)
    // April-June = Q1, July-Sept = Q2, Oct-Dec = Q3, Jan-Mar = Q4
    if (month >= 3) {
      // April to December: months 3-11
      return `Q${Math.floor((month - 3) / 3) + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4'
    } else {
      // January to March: months 0-2 (Q4 of previous year, but displayed as Q4)
      return 'Q4'
    }
  }

  // Decompose activities into tasks with time estimates
  const taskDecompositions = useMemo(() => {
    return roadmapPlanItems
      .filter((item) => {
        // Apply filters
        const quarterMatch = quarterFilter === 'all' || getQuarter(item.planned_start_date) === quarterFilter
        const projectMatch =
          projectTypeFilter === 'all' ||
          (projectTypeFilter === 'rnd' && item.delivery_mode === 'rnd') ||
          (projectTypeFilter === 'client' && item.project_context === 'client') ||
          (projectTypeFilter === 'internal' && item.project_context === 'internal')

        // Year filter
        const yearMatch =
          !item.planned_start_date ||
          new Date(item.planned_start_date).getFullYear() === selectedYear ||
          new Date(item.planned_end_date).getFullYear() === selectedYear

        return quarterMatch && projectMatch && yearMatch
      })
      .map((item) => {
        const durationWeeks = item.tentative_duration_weeks && item.tentative_duration_weeks > 0 ? item.tentative_duration_weeks : 1
        const feFte = Math.max(0, item.fe_fte || 0)
        const beFte = Math.max(0, item.be_fte || 0)
        const aiFte = Math.max(0, item.ai_fte || 0)
        const pmFte = Math.max(0, item.pm_fte || 0)
        const fsFte = Math.max(0, item.fs_fte || 0)
        const totalFte = feFte + beFte + aiFte + pmFte + fsFte
        const resources = totalFte > 0 ? Math.ceil(totalFte) : 0
        const effort = Math.round(totalFte * durationWeeks * 10) / 10
        const totalWeeks = durationWeeks
        const activitiesCount = item.activities.length || 1
        const weeksPerActivity = Math.round((totalWeeks / activitiesCount) * 10) / 10

        const startQuarter = getQuarter(item.planned_start_date)
        const endQuarter = getQuarter(item.planned_end_date)

        const activities: ActivityTask[] = (item.activities || []).map((activity, index) => {
          // Distribute activities across quarters
          let activityQuarter = startQuarter
          if (endQuarter && endQuarter !== startQuarter) {
            const quarterProgress = index / activitiesCount
            if (quarterProgress > 0.66) activityQuarter = endQuarter
            else if (quarterProgress > 0.33) activityQuarter = startQuarter
          }

          return {
            name: activity,
            estimatedWeeks: weeksPerActivity,
            quarter: activityQuarter || 'Q1',
          }
        })

        return {
          itemId: item.id,
          title: item.title,
          projectContext: item.project_context,
          deliveryMode: item.delivery_mode,
          priority: item.priority,
          activities,
          totalEstimatedWeeks: totalWeeks,
          plannedStart: item.planned_start_date,
          plannedEnd: item.planned_end_date,
          resources,
          effort,
          durationWeeks,
          feFte,
          beFte,
          aiFte,
          pmFte,
        } as TaskDecomposition
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [roadmapPlanItems, quarterFilter, projectTypeFilter, selectedYear])

  // Group by quarter for quarterly view
  const quarterlyGroups = useMemo(() => {
    const groups: Record<string, TaskDecomposition[]> = {
      Q1: [],
      Q2: [],
      Q3: [],
      Q4: [],
    }

    taskDecompositions.forEach((decomp) => {
      const quarter = getQuarter(decomp.plannedStart)
      if (quarter && groups[quarter]) {
        groups[quarter].push(decomp)
      }
    })

    return groups
  }, [taskDecompositions])

  // Group by project type for project view
  const projectGroups = useMemo(() => {
    const groups: Record<string, TaskDecomposition[]> = {
      'R&D Projects': [],
      'Client Projects': [],
      'Internal Development': [],
    }

    taskDecompositions.forEach((decomp) => {
      if (decomp.deliveryMode === 'rnd') {
        groups['R&D Projects'].push(decomp)
      } else if (decomp.projectContext === 'client') {
        groups['Client Projects'].push(decomp)
      } else {
        groups['Internal Development'].push(decomp)
      }
    })

    return groups
  }, [taskDecompositions])

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalItems = taskDecompositions.length
    const totalActivities = taskDecompositions.reduce((sum, d) => sum + d.activities.length, 0)
    const totalEffort = taskDecompositions.reduce((sum, d) => sum + (d.effort || 0), 0)
    const totalResources = taskDecompositions.reduce((sum, d) => sum + (d.resources || 0), 0)

    return {
      totalItems,
      totalActivities,
      totalEffort: Math.round(totalEffort * 10) / 10,
      totalResources,
    }
  }, [taskDecompositions])

  const capacityInsights = useMemo(() => {
    const roleDemandPw = { FE: 0, BE: 0, AI: 0, PM: 0 }
    const contexts = new Set<'client' | 'internal'>()
    for (const item of taskDecompositions) {
      contexts.add(item.projectContext === 'client' ? 'client' : 'internal')
      roleDemandPw.FE += item.feFte * item.durationWeeks
      roleDemandPw.BE += item.beFte * item.durationWeeks
      roleDemandPw.AI += item.aiFte * item.durationWeeks
      roleDemandPw.PM += item.pmFte * item.durationWeeks
    }

    if (!governanceConfig) {
      return {
        roleDemandPw,
        roleCapacityPw: null,
        roleUtilization: null,
        contextLabel: contexts.size > 0 ? Array.from(contexts).join(' + ') : 'all',
      }
    }

    const includeClient = contexts.size === 0 || contexts.has('client')
    const includeInternal = contexts.size === 0 || contexts.has('internal')
    const clientFactor = includeClient ? governanceConfig.quota_client : 0
    const internalFactor = includeInternal ? governanceConfig.quota_internal : 0

    const roleCapacityPw = {
      FE: governanceConfig.team_fe * governanceConfig.efficiency_fe * 52 * (clientFactor + internalFactor),
      BE: governanceConfig.team_be * governanceConfig.efficiency_be * 52 * (clientFactor + internalFactor),
      AI: governanceConfig.team_ai * governanceConfig.efficiency_ai * 52 * (clientFactor + internalFactor),
      PM: governanceConfig.team_pm * governanceConfig.efficiency_pm * 52 * (clientFactor + internalFactor),
    }
    const roleUtilization = {
      FE: roleCapacityPw.FE <= 0 ? (roleDemandPw.FE <= 0 ? 0 : null) : (roleDemandPw.FE / roleCapacityPw.FE) * 100,
      BE: roleCapacityPw.BE <= 0 ? (roleDemandPw.BE <= 0 ? 0 : null) : (roleDemandPw.BE / roleCapacityPw.BE) * 100,
      AI: roleCapacityPw.AI <= 0 ? (roleDemandPw.AI <= 0 ? 0 : null) : (roleDemandPw.AI / roleCapacityPw.AI) * 100,
      PM: roleCapacityPw.PM <= 0 ? (roleDemandPw.PM <= 0 ? 0 : null) : (roleDemandPw.PM / roleCapacityPw.PM) * 100,
    }

    return {
      roleDemandPw,
      roleCapacityPw,
      roleUtilization,
      contextLabel: [
        includeClient ? 'client' : '',
        includeInternal ? 'internal' : '',
      ].filter(Boolean).join(' + ') || 'all',
    }
  }, [taskDecompositions, governanceConfig])

  const toggleExpanded = (itemId: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const formatPriority = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : 'Medium')

  const getProjectTypeLabel = (context: string, mode: string) => {
    if (mode === 'rnd') return 'R&D'
    if (context === 'client') return 'Client'
    return 'Internal'
  }

  const getProjectTypeColor = (context: string, mode: string) => {
    if (mode === 'rnd') return '#7C3AED' // Purple for R&D
    if (context === 'client') return '#059669' // Green for Client
    return '#D97706' // Orange for Internal
  }

  return (
    <main className="page-wrap detailed-roadmap-wrap">
      <section className="panel-card detailed-roadmap-header">
        <div className="detailed-roadmap-title">
          <h2>Detailed Roadmap Charts</h2>
          <p className="muted">Task-wise decomposition with quarterly and project-wise views</p>
        </div>

        <div className="detailed-roadmap-filters">
          <label className="detailed-filter">
            <span>Year</span>
            <input
              type="number"
              min={2020}
              max={2100}
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value) || new Date().getFullYear())}
              disabled={busy}
            />
          </label>

          <label className="detailed-filter">
            <span>View Mode</span>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)} disabled={busy}>
              <option value="task">Task Decomposition</option>
              <option value="quarterly">Quarterly View</option>
              <option value="project">Project Type View</option>
            </select>
          </label>

          {(viewMode === 'task' || viewMode === 'quarterly') && (
            <label className="detailed-filter">
              <span>Quarter</span>
              <select value={quarterFilter} onChange={(e) => setQuarterFilter(e.target.value as QuarterFilter)} disabled={busy}>
                <option value="all">All Quarters</option>
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>
            </label>
          )}

          {(viewMode === 'task' || viewMode === 'project') && (
            <label className="detailed-filter">
              <span>Project Type</span>
              <select
                value={projectTypeFilter}
                onChange={(e) => setProjectTypeFilter(e.target.value as ProjectTypeFilter)}
                disabled={busy}
              >
                <option value="all">All Types</option>
                <option value="rnd">R&D</option>
                <option value="client">Client</option>
                <option value="internal">Internal</option>
              </select>
            </label>
          )}
        </div>

        <div className="detailed-roadmap-metrics">
          <div className="metric-item">
            <span className="metric-value">{metrics.totalItems}</span>
            <span className="metric-label">Projects</span>
          </div>
          <div className="metric-item">
            <span className="metric-value">{metrics.totalActivities}</span>
            <span className="metric-label">Activities</span>
          </div>
          <div className="metric-item">
            <span className="metric-value">{metrics.totalEffort}</span>
            <span className="metric-label">Total Person-Weeks</span>
          </div>
          <div className="metric-item">
            <span className="metric-value">{metrics.totalResources}</span>
            <span className="metric-label">Total FTE Needed</span>
          </div>
        </div>

        <div className="analytics-capacity-summary">
          <div className="line-item">
            <strong>Capacity Utilization (Filtered {selectedYear})</strong>
            <span className="muted">Contexts: {capacityInsights.contextLabel}</span>
          </div>
          {!capacityInsights.roleCapacityPw && (
            <p className="muted">Governance config missing. Capacity utilization is unavailable.</p>
          )}
          <div className="analytics-capacity-grid">
            {(['FE', 'BE', 'AI', 'PM'] as const).map((role) => {
              const demand = capacityInsights.roleDemandPw[role]
              const capacity = capacityInsights.roleCapacityPw?.[role] || 0
              const utilization = capacityInsights.roleUtilization?.[role] ?? 0
              const tone = utilization == null ? 'error' : utilization > 100 ? 'error' : utilization >= 85 ? 'warn' : 'ok'
              return (
                <article key={role} className="analytics-capacity-card">
                  <div className="line-item">
                    <span className="mono">{role}</span>
                    <span className={`capacity-meter-state ${tone}`}>
                      {utilization == null ? 'N/A' : `${utilization.toFixed(1)}%`}
                    </span>
                  </div>
                  <p className="muted">{demand.toFixed(1)} pw demand / {capacity.toFixed(1)} pw capacity</p>
                  <div className="mini-progress-bar">
                    <div
                      className="mini-progress-fill"
                      style={{
                        width: `${utilization == null ? 100 : Math.min(100, utilization)}%`,
                        backgroundColor: tone === 'error' ? '#ef4444' : tone === 'warn' ? '#f59e0b' : '#10b981',
                      }}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* Task Decomposition View */}
      {viewMode === 'task' && (
        <section className="panel-card detailed-roadmap-content">
          <h3>Task Decomposition View</h3>
          {taskDecompositions.length === 0 ? (
            <p className="muted">No roadmap items match the current filters.</p>
          ) : (
            <div className="task-list">
              {taskDecompositions.map((decomp) => (
                <div key={decomp.itemId} className="task-card">
                  <div className="task-card-header" onClick={() => toggleExpanded(decomp.itemId)}>
                    <div className="task-card-title-row">
                      <div className="task-expand-icon">
                        {expandedItems.has(decomp.itemId) ? (
                          <svg viewBox="0 0 24 24" width="20" height="20">
                            <path d="M7 10l5 5 5-5z" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="20" height="20">
                            <path d="M10 17l5-5-5-5v10z" />
                          </svg>
                        )}
                      </div>
                      <div className="task-card-info">
                        <h4>{decomp.title}</h4>
                        <div className="task-card-meta">
                          <span
                            className="project-type-badge"
                            style={{ backgroundColor: `${getProjectTypeColor(decomp.projectContext, decomp.deliveryMode)}20`, color: getProjectTypeColor(decomp.projectContext, decomp.deliveryMode) }}
                          >
                            {getProjectTypeLabel(decomp.projectContext, decomp.deliveryMode)}
                          </span>
                          <span className="priority-badge">{formatPriority(decomp.priority)}</span>
                          <span className="duration-badge">
                            {decomp.totalEstimatedWeeks} weeks • {decomp.activities.length} activities
                          </span>
                          {decomp.resources && <span className="resource-badge">{decomp.resources} resources</span>}
                        </div>
                      </div>
                      <div className="task-card-timeline">
                        <span className="timeline-date">{decomp.plannedStart || 'Not set'}</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" className="timeline-arrow">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                        <span className="timeline-date">{decomp.plannedEnd || 'Not set'}</span>
                      </div>
                    </div>
                  </div>

                  {expandedItems.has(decomp.itemId) && (
                    <div className="task-card-activities">
                      <div className="activities-header">
                        <span>Activity</span>
                        <span>Quarter</span>
                        <span>Duration</span>
                      </div>
                      {decomp.activities.map((activity, idx) => (
                        <div key={idx} className="activity-row">
                          <span className="activity-name">{activity.name}</span>
                          <span className="activity-quarter">{activity.quarter}</span>
                          <span className="activity-duration">{activity.estimatedWeeks} weeks</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Quarterly View */}
      {viewMode === 'quarterly' && (
        <section className="panel-card detailed-roadmap-content">
          <h3>Quarterly View - {selectedYear}</h3>
          {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((quarter) => {
            const items = quarterlyGroups[quarter]
            if (quarterFilter !== 'all' && quarterFilter !== quarter) return null

            return (
              <div key={quarter} className="quarter-section">
                <div className="quarter-header">
                  <h4>{quarter} {selectedYear}</h4>
                  <span className="quarter-count">{items.length} projects</span>
                </div>

                {items.length === 0 ? (
                  <p className="muted quarter-empty">No projects planned for this quarter.</p>
                ) : (
                  <div className="quarter-gantt">
                    <div className="gantt-time-header">
                      <span className="gantt-item-label">Project</span>
                      <div className="gantt-time-scale">
                        <span>Week 1-4</span>
                        <span>Week 5-8</span>
                        <span>Week 9-12</span>
                      </div>
                    </div>
                    {items.map((decomp) => {
                      const startDate = decomp.plannedStart ? new Date(decomp.plannedStart) : null
                      const endDate = decomp.plannedEnd ? new Date(decomp.plannedEnd) : null

                      // Calculate position within quarter
                      let leftPercent = 0
                      let widthPercent = 0

                      if (startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
                        // Financial year quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
                        let quarterStart: Date
                        let quarterEnd: Date
                        const qNum = parseInt(quarter[1])

                        if (quarter === 'Q4') {
                          // Q4 is Jan-Mar, belongs to financial year starting from previous April
                          quarterStart = new Date(selectedYear, 0, 1) // January 1
                          quarterEnd = new Date(selectedYear, 2, 31) // March 31
                        } else {
                          // Q1, Q2, Q3 are in the same calendar year
                          const startMonth = (qNum - 1) * 3 + 3 // Q1 starts at April (month 3)
                          quarterStart = new Date(selectedYear, startMonth, 1)
                          quarterEnd = new Date(selectedYear, startMonth + 3, 0)
                        }

                        const effectiveStart = startDate < quarterStart ? quarterStart : startDate
                        const effectiveEnd = endDate > quarterEnd ? quarterEnd : endDate

                        const quarterWeeks = 13
                        const startWeek = Math.max(0, Math.floor((effectiveStart.getTime() - quarterStart.getTime()) / (7 * 24 * 60 * 60 * 1000)))
                        const durationWeeks = Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1

                        leftPercent = (startWeek / quarterWeeks) * 100
                        widthPercent = Math.min(100 - leftPercent, (durationWeeks / quarterWeeks) * 100)
                      }

                      return (
                        <div key={decomp.itemId} className="quarter-gantt-row">
                          <span className="gantt-item-label">{decomp.title}</span>
                          <div className="gantt-bar-container">
                            <div
                              className="gantt-bar"
                              style={{
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                                backgroundColor: getProjectTypeColor(decomp.projectContext, decomp.deliveryMode),
                              }}
                            >
                              <span className="gantt-bar-label">
                                {decomp.totalEstimatedWeeks}w • {decomp.activities.length} tasks
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}

      {/* Project Type View */}
      {viewMode === 'project' && (
        <section className="panel-card detailed-roadmap-content">
          <h3>Project Type View - {selectedYear}</h3>
          {Object.entries(projectGroups).map(([projectType, items]) => {
            if (projectTypeFilter !== 'all') {
              const filterMap: Record<ProjectTypeFilter, string> = {
                all: '',
                rnd: 'R&D Projects',
                client: 'Client Projects',
                internal: 'Internal Development',
              }
              if (projectType !== filterMap[projectTypeFilter]) return null
            }

            if (items.length === 0) return null

            const typeKey = projectType.toLowerCase().replace(' projects', '').replace(' development', '') as 'rnd' | 'client' | 'internal'
            const typeColor = typeKey === 'rnd' ? '#7C3AED' : typeKey === 'client' ? '#059669' : '#D97706'

            return (
              <div key={projectType} className="project-type-section">
                <div className="project-type-header" style={{ borderTopColor: typeColor }}>
                  <h4>{projectType}</h4>
                  <div className="project-type-stats">
                    <span>{items.length} projects</span>
                    <span>•</span>
                    <span>{items.reduce((sum, d) => sum + d.activities.length, 0)} activities</span>
                    <span>•</span>
                    <span>{items.reduce((sum, d) => sum + d.effort, 0).toFixed(0)} pw</span>
                  </div>
                </div>

                <div className="project-type-gantt">
                  <div className="project-gantt-header">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => (
                      <span key={month} className="month-label">
                        {month}
                      </span>
                    ))}
                  </div>
                  {items.map((decomp) => {
                    const startDate = decomp.plannedStart ? new Date(decomp.plannedStart) : null
                    const endDate = decomp.plannedEnd ? new Date(decomp.plannedEnd) : null

                    let leftPercent = 0
                    let widthPercent = 0

                    if (startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
                      const yearStart = new Date(selectedYear, 0, 1)
                      const yearEnd = new Date(selectedYear, 11, 31)

                      const effectiveStart = startDate.getFullYear() < selectedYear ? yearStart : startDate
                      const effectiveEnd = endDate.getFullYear() > selectedYear ? yearEnd : endDate

                      const startMonth = effectiveStart.getMonth()
                      const endMonth = effectiveEnd.getMonth()

                      leftPercent = (startMonth / 12) * 100
                      widthPercent = ((endMonth - startMonth + 1) / 12) * 100
                    }

                    return (
                      <div key={decomp.itemId} className="project-gantt-row">
                        <div className="project-gantt-info">
                          <span className="project-gantt-title">{decomp.title}</span>
                          <span className="project-gantt-meta">
                            {decomp.activities.length} tasks • {decomp.totalEstimatedWeeks}w
                          </span>
                        </div>
                        <div className="project-gantt-bar-area">
                          <div
                            className="project-gantt-bar"
                            style={{
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                              backgroundColor: typeColor,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="project-type-list">
                  {items.map((decomp) => (
                    <div key={decomp.itemId} className="project-mini-card">
                      <h5>{decomp.title}</h5>
                      <p className="muted">{decomp.activities.length} activities • {decomp.totalEstimatedWeeks} weeks</p>
                      <div className="mini-progress-bar">
                        <div
                          className="mini-progress-fill"
                          style={{
                            width: `${Math.min(100, (decomp.durationWeeks / 52) * 100)}%`,
                            backgroundColor: typeColor,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}
    </main>
  )
}
