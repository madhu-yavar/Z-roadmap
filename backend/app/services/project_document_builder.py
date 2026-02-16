from datetime import date
from io import BytesIO
import re

from app.models.governance_config import GovernanceConfig
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import PageBreak, Paragraph, Preformatted, SimpleDocTemplate, Spacer, Table, TableStyle


def _safe_int(value: int | None) -> int:
    return int(value or 0)


def _safe_float(value: float | None) -> float:
    return float(value or 0.0)


def _cfg_snapshot(cfg: GovernanceConfig | None) -> dict[str, float]:
    team_fe = _safe_int(cfg.team_fe) if cfg else 0
    team_be = _safe_int(cfg.team_be) if cfg else 0
    team_ai = _safe_int(cfg.team_ai) if cfg else 0
    team_pm = _safe_int(cfg.team_pm) if cfg else 0
    eff_fe = _safe_float(cfg.efficiency_fe) if cfg else 1.0
    eff_be = _safe_float(cfg.efficiency_be) if cfg else 1.0
    eff_ai = _safe_float(cfg.efficiency_ai) if cfg else 1.0
    eff_pm = _safe_float(cfg.efficiency_pm) if cfg else 1.0
    quota_client = _safe_float(cfg.quota_client) if cfg else 0.50
    quota_internal = _safe_float(cfg.quota_internal) if cfg else 0.50
    annual_eff_fe = team_fe * eff_fe * 52
    annual_eff_be = team_be * eff_be * 52
    annual_eff_ai = team_ai * eff_ai * 52
    annual_eff_pm = team_pm * eff_pm * 52
    return {
        "team_fe": team_fe,
        "team_be": team_be,
        "team_ai": team_ai,
        "team_pm": team_pm,
        "eff_fe": eff_fe,
        "eff_be": eff_be,
        "eff_ai": eff_ai,
        "eff_pm": eff_pm,
        "quota_client": quota_client,
        "quota_internal": quota_internal,
        "annual_eff_fe": annual_eff_fe,
        "annual_eff_be": annual_eff_be,
        "annual_eff_ai": annual_eff_ai,
        "annual_eff_pm": annual_eff_pm,
    }


def generate_enterprise_project_document(
    prepared_by: str,
    approved_by: str,
    effective_date: date,
    cfg: GovernanceConfig | None = None,
    version: str = "1.0",
) -> str:
    snapshot = _cfg_snapshot(cfg)
    team_fe = int(snapshot["team_fe"])
    team_be = int(snapshot["team_be"])
    team_ai = int(snapshot["team_ai"])
    team_pm = int(snapshot["team_pm"])
    eff_fe = snapshot["eff_fe"]
    eff_be = snapshot["eff_be"]
    eff_ai = snapshot["eff_ai"]
    eff_pm = snapshot["eff_pm"]
    quota_client = snapshot["quota_client"]
    quota_internal = snapshot["quota_internal"]
    annual_eff_fe = snapshot["annual_eff_fe"]
    annual_eff_be = snapshot["annual_eff_be"]
    annual_eff_ai = snapshot["annual_eff_ai"]
    annual_eff_pm = snapshot["annual_eff_pm"]

    client_cap_fe = annual_eff_fe * quota_client
    client_cap_be = annual_eff_be * quota_client
    client_cap_ai = annual_eff_ai * quota_client
    client_cap_pm = annual_eff_pm * quota_client

    internal_cap_fe = annual_eff_fe * quota_internal
    internal_cap_be = annual_eff_be * quota_internal
    internal_cap_ai = annual_eff_ai * quota_internal
    internal_cap_pm = annual_eff_pm * quota_internal

    effective_date_text = effective_date.isoformat()

    return f"""# 1.0 Document Control

## 1.1 Document Title
Resource Commitment & Capacity Governance Tool - Enterprise Governance Specification

## 1.2 Version
{version}

## 1.3 Prepared By
{prepared_by}

## 1.4 Approved By
{approved_by}

## 1.5 Effective Date
{effective_date_text}

## 1.6 Revision History
| Version | Date | Author | Change Summary | Approval |
|---|---|---|---|---|
| {version} | {effective_date_text} | {prepared_by} | Initial controlled release of governance model, role boundaries, validation rules, and capacity formulas. | {approved_by} |
| 1.1 | TBD | TBD | Future revision placeholder for policy calibration and audit enhancement. | TBD |
| 1.2 | TBD | TBD | Future revision placeholder for expanded portfolio and multi-entity support. | TBD |

## 1.7 Controlled Distribution
This document is a controlled artifact under the enterprise quality management system and shall be stored in the approved document repository. Any uncontrolled copy is for reference only and is not valid for audit evidence unless traceable to a controlled version identifier and effective date.

## 1.8 ISO Documentation Alignment Statement
This specification follows ISO 9001-style documentation discipline by defining purpose, scope, terms, process controls, role accountability, performance validation, and evidence retention. It is designed for executive and audit-level review and supports objective verification of capacity governance decisions.

# 2.0 Purpose

## 2.1 Purpose Statement
The purpose of the Resource Commitment & Capacity Governance Tool is to enforce realistic, role-based commitment decisions by ensuring that project allocations do not exceed available organizational delivery capacity. The tool formalizes governance hierarchy, controls resource planning behavior, and provides deterministic validation before commitments become roadmap obligations.

## 2.2 Business Objective
The tool prevents overcommitment, improves forecast reliability, and enables transparent accountability across leadership layers. It is intended to align strategic intent (CEO), portfolio balancing (VP), and execution planning (PM/PO) using quantifiable constraints and auditable approval mechanics.

## 2.3 Quality Objective
The quality objective is to ensure every accepted commitment can be traced to approved capacity assumptions, validated formulas, and role-authorized actions. Validation logic must be deterministic, reproducible, and independently auditable without dependence on probabilistic interpretation.

## 2.4 Decision Integrity Objective
The system shall block commitments that breach configured limits and log validation outcomes with sufficient granularity to support root-cause analysis, exception management, and governance escalation.

# 3.0 Scope of the System

## 3.1 In-Scope Capabilities
1. Intake-to-commitment transition with role-based controls.
2. Governance configuration of team size, efficiency coefficients, and portfolio quotas.
3. Deterministic resource validation at commitment and planning stages.
4. Timeline-aware overlap checks to prevent same-week over-allocation.
5. Utilization reporting by role and portfolio.
6. Audit-friendly evidence outputs including approval/rejection reasons.

## 3.2 Out-of-Scope Capabilities
1. Financial budgeting and cost accounting.
2. Payroll or HR attendance processing.
3. Vendor staffing and procurement lifecycle.
4. Autonomous project approval without role authorization.
5. Subjective override of hard capacity failures.

## 3.3 Boundary Conditions
The system governs planning and commitment decisions, not downstream execution performance. It assumes that role owners provide truthful effort estimates and that governance parameters are periodically reviewed by executive leadership.

## 3.4 Applicability
This specification applies to all portfolios managed under the enterprise roadmap governance model and is mandatory for client and internal workstreams that consume FE, BE, AI, and PM/PO capacity.

# 4.0 Definitions & Terminology

## 4.1 Effective Capacity
Effective Capacity is the usable planning capacity after role efficiency is applied to nominal team size. It is represented as role-specific person-weeks or FTE-equivalent throughput over a defined period.

## 4.2 Efficiency Coefficient
Efficiency Coefficient is a decimal multiplier (0.00-1.00 or higher if policy allows) representing realistic productive output for a role after accounting for non-project overhead, coordination cost, and planned organizational load.

## 4.3 Utilization Percentage
Utilization Percentage is the ratio of committed load to effective capacity, expressed as a percentage:

Utilization % = (Committed Resources / Effective Capacity) x 100

## 4.4 Commitment Stage
Commitment Stage is the governance checkpoint where candidate initiatives become approved roadmap obligations subject to deterministic capacity validation and role authorization.

## 4.5 Governance Threshold
Governance Threshold is the policy warning ceiling (for example 85%) used to flag elevated allocation risk before hard breach. Threshold exceedance may trigger escalation, but hard blocking depends on configured hard rules.

## 4.6 Hard Limit vs Soft Limit
Soft Limit is the advisory threshold used to warn about rising utilization risk. Hard Limit is the non-negotiable boundary (typically 100%) at which the system rejects commitments until resource load is reduced or capacity is formally increased.

## 4.7 Portfolio Allocation
Portfolio Allocation is the percentage split of total effective capacity assigned to portfolio categories such as client and internal programs.

## 4.8 Deterministic Validation
Deterministic Validation means every result is generated through explicit formula-based logic that yields identical output for identical input, independent of natural-language interpretation.

# 5.0 Role-Based Scope & Responsibilities

## 5.1 CEO
### 5.1.1 Scope
CEO authority covers enterprise-level capacity policy and governance baseline ownership.

### 5.1.2 Responsibilities
1. Configure total team size per role (FE, BE, AI, PM/PO).
2. Define baseline efficiency coefficients per role.
3. Set utilization guidance threshold (for example 85%) for risk monitoring.
4. Approve annual roadmap capacity assumptions and governance policy updates.
5. Sponsor corrective action when systemic overcommitment is observed.

### 5.1.3 Accountability
CEO is accountable for ensuring that strategic ambition is grounded in capacity realism and that governance settings remain aligned with enterprise operating conditions.

## 5.2 VP / Portfolio Head
### 5.2.1 Scope
VP authority covers portfolio-level distribution and utilization balancing across client and internal streams.

### 5.2.2 Responsibilities
1. Allocate capacity quotas across portfolios within enterprise policy.
2. Monitor portfolio utilization trends and pre-breach indicators.
3. Escalate breach conditions and sequence conflicts to CEO.
4. Challenge unrealistic resource requests and enforce prioritization discipline.
5. Coordinate remediation when portfolio utilization sustains unhealthy levels.

### 5.2.3 Accountability
VP is accountable for portfolio throughput integrity, preventing hidden cross-portfolio contention, and preserving delivery resilience.

## 5.3 Project Manager / Product Owner
### 5.3.1 Scope
PM/PO authority covers commitment submission, scope refinement, and execution-ready planning data.

### 5.3.2 Responsibilities
1. Submit resource commitment requests with role-wise FTE demand.
2. Validate business and delivery justification for requested resources.
3. Refine scope and activities to remove ambiguity before commitment.
4. Maintain realistic timeline data (start/end) for overlap validation.
5. Monitor project-level utilization and re-plan when constraints change.

### 5.3.3 Accountability
PM/PO is accountable for request quality, schedule realism, and preventing avoidable governance rejections caused by incomplete or inflated allocations.

## 5.4 Engineering Leads (FE, BE, AI)
### 5.4.1 Scope
Engineering Leads own technical effort realism and feasibility attestation.

### 5.4.2 Responsibilities
1. Provide realistic effort estimates and role loading assumptions.
2. Validate that planned scope can be executed with declared staffing.
3. Confirm technical feasibility for dependency-sensitive work.
4. Highlight hidden complexity and propose risk-adjusted alternatives.
5. Support corrective planning after validation rejection.

### 5.4.3 Accountability
Engineering Leads are accountable for technical estimate integrity and for reducing optimism bias in commitment planning.

# 6.0 Resource Calculation Methodology

## 6.1 Base Variables
1. Total Resources per Role (headcount/FTE baseline).
2. Efficiency Coefficient per Role.
3. Portfolio Allocation % (client/internal or other approved segments).
4. Current Committed Load by role and time window.
5. Proposed New Commitment by role and duration.

### 6.1.1 Current Governance Snapshot
| Role | Team Size | Efficiency | Annual Effective Capacity (pw) | Client Allocation (pw) | Internal Allocation (pw) |
|---|---:|---:|---:|---:|---:|
| FE | {team_fe} | {eff_fe:.2f} | {annual_eff_fe:.2f} | {client_cap_fe:.2f} | {internal_cap_fe:.2f} |
| BE | {team_be} | {eff_be:.2f} | {annual_eff_be:.2f} | {client_cap_be:.2f} | {internal_cap_be:.2f} |
| AI | {team_ai} | {eff_ai:.2f} | {annual_eff_ai:.2f} | {client_cap_ai:.2f} | {internal_cap_ai:.2f} |
| PM/PO | {team_pm} | {eff_pm:.2f} | {annual_eff_pm:.2f} | {client_cap_pm:.2f} | {internal_cap_pm:.2f} |

Portfolio quota configuration used in this snapshot:
- Client quota = {quota_client:.2f}
- Internal quota = {quota_internal:.2f}

## 6.2 Effective Capacity Formula
Effective Capacity = Total Resources x Efficiency Coefficient

Where period scaling is required:
Effective Capacity (period) = Total Resources x Efficiency Coefficient x Period Length

## 6.3 Utilization Formula
Utilization % = (Committed Resources / Effective Capacity) x 100

When overlap-based weekly checks are enabled:
Weekly Utilization % = (Weekly Committed FTE / Weekly Capacity FTE) x 100

## 6.4 Breach Validation Rules
1. If Utilization > Governance Threshold (for example 85%), flag elevated risk.
2. If Utilization > 100%, enforce hard stop and reject commitment.
3. If timeline overlap creates weekly over-allocation, reject commitment even if annual aggregate appears acceptable.
4. If required governance configuration is missing, reject with configuration error and require CEO/VP action.
5. Negative or undefined role demands are invalid and rejected before capacity computation.

## 6.5 Portfolio Allocation Formula
Allocated Capacity = Effective Capacity x Portfolio Allocation %

For deterministic planning:
Allocated Capacity(role, portfolio, period) = Effective Capacity(role, period) x Quota(portfolio)

## 6.6 Deterministic Validation Requirement
Validation must be implemented in deterministic program logic (for example Python or SQL aggregation), not delegated to probabilistic inference. The same inputs shall always produce identical outputs and breach decisions.

## 6.7 Validation Output Contract
Validation responses must include:
1. Decision status (APPROVED or REJECTED).
2. Breached roles list.
3. Utilization by role.
4. Clear rejection reason with governance context.

# 7.0 Governance Workflow

## 7.1 Workflow Overview
The governance workflow enforces hierarchical control and non-bypassable validation gates.

## 7.2 Step-by-Step Process
### 7.2.1 Step 1 - CEO Configures System
CEO defines:
1. Team capacity by role.
2. Efficiency coefficients by role.
3. Risk threshold policy.
4. Capacity review cadence and governance baseline date.

### 7.2.2 Step 2 - VP Allocates Quotas
VP allocates:
1. Client portfolio quota.
2. Internal portfolio quota.
3. Optional scenario allocations for forecast testing.

### 7.2.3 Step 3 - PM/PO Submits Commitment
PM/PO submits:
1. Scope and detailed activities.
2. Role-wise FTE requests.
3. Tentative duration and planned timeline.
4. Justification and dependencies.

### 7.2.4 Step 4 - System Validates Automatically
System computes:
1. Current committed load.
2. Proposed incremental load.
3. Utilization against role and portfolio limits.
4. Weekly overlap impact where dates exist.

### 7.2.5 Step 5 - Decision and Traceability
1. If all roles are within limits, status = APPROVED.
2. If any role breaches, status = REJECTED.
3. Decision, reasons, and utilization are logged for audit.
4. User can re-plan and re-submit without bypassing controls.

## 7.3 Escalation Path
1. PM/PO -> VP for portfolio rebalancing.
2. VP -> CEO for policy or capacity baseline revision.
3. CEO -> governance board for exceptional enterprise-level reprioritization.

# 8.0 User Manual (Operational Guide)

## 8.1 Logging In
1. Open the platform sign-in page.
2. Enter assigned enterprise credentials.
3. If login fails due to inactive account, contact Admin.
4. Confirm role in profile context before executing governed actions.

## 8.2 Configuring Team Capacity
1. Navigate to Settings > Commitment Governance.
2. CEO enters team size for FE, BE, AI, PM/PO.
3. Save configuration and verify persisted values.
4. Confirm no accidental zeroing of critical roles.

## 8.3 Setting Efficiency Levels
1. CEO enters efficiency coefficients per role.
2. Use evidence-based assumptions, not optimistic defaults.
3. Validate resulting effective capacity snapshot.
4. Recalibrate periodically based on actual delivery data.

## 8.4 Allocating Portfolio Limits
1. VP enters client/internal quota percentages.
2. Ensure combined quota respects policy.
3. Save and verify allocation impact on capacity views.
4. Record rationale for significant quota changes.

## 8.5 Submitting Project Commitment
1. PM/PO selects commitment candidate.
2. Refines scope and activities with technical owners.
3. Enters role-wise FTE demand and timeline.
4. Reviews validation status and utilization impact.
5. Submits only when deterministic status is APPROVED.

## 8.6 Reviewing Utilization Dashboard
1. Open Dashboard and Analytics views.
2. Inspect client/internal utilization by role.
3. Investigate high-risk roles near threshold.
4. Identify unscheduled commitments requiring timeline completion.

## 8.7 Handling Rejections
1. Read exact rejection reason and breached roles.
2. Reduce demand, change timeline, or request reprioritization.
3. Re-run validation after changes.
4. Escalate persistent constraints through VP to CEO with evidence.

# 9.0 Risk & Control Measures

## 9.1 Overcommitment Risk
### 9.1.1 Risk Description
Demand exceeds realistic capacity, resulting in delivery slippage, quality degradation, and team burnout.

### 9.1.2 Controls
1. Deterministic hard-stop validation.
2. Weekly overlap checking.
3. Threshold warnings prior to hard breach.
4. Executive escalation for unresolved conflicts.

## 9.2 Underutilization Risk
### 9.2.1 Risk Description
Capacity remains idle due to conservative allocation or weak pipeline planning.

### 9.2.2 Controls
1. Portfolio utilization monitoring.
2. Periodic quota recalibration.
3. Backlog shaping and pull-forward governance.
4. Role-level utilization trend review.

## 9.3 Role Escalation Matrix
| Trigger Condition | Primary Owner | Escalation Level 1 | Escalation Level 2 |
|---|---|---|---|
| Threshold breach warning | PM/PO | VP | CEO |
| Hard limit violation | PM/PO | VP | CEO |
| Repeated rejection due to quota | VP | CEO | Governance Board |
| Missing governance baseline | VP/CEO | CEO | Governance Board |

## 9.4 Audit Logging
Every validation outcome should capture:
1. Input payload summary.
2. Role utilization snapshot.
3. Status outcome.
4. Breach roles.
5. Actor identity and timestamp.

# 10.0 Compliance & Audit

## 10.1 Traceability
All commitment decisions must be traceable from intake source to validation outcome and final roadmap state. Evidence linkage shall include user identity, dates, and change history.

## 10.2 Role-Based Access Control
Access rights are constrained by role and enforced server-side. Client-side visibility is supportive but not authoritative. System APIs shall reject unauthorized actions regardless of UI state.

## 10.3 Audit History
Version history, approval/rejection logs, and data-change trails shall be retained according to enterprise retention policy and made available for governance and external audits.

## 10.4 Capacity Breach Logging
All threshold and hard-limit breaches must be recorded with sufficient diagnostic context to support trend analysis, risk reviews, and control effectiveness assessment.

## 10.5 Compliance Assurance Statement
This governance model is intended to provide objective evidence of planned resource feasibility and to reduce discretionary commitment behavior. It supports compliance with internal quality controls and externally auditable process discipline.

# 11.0 Appendices

## 11.1 Appendix A - Sample Calculation Table
| Role | Total Resources | Efficiency | Effective Capacity (pw) | Current Committed (pw) | Proposed (pw) | Utilization % |
|---|---:|---:|---:|---:|---:|---:|
| FE | 10 | 0.85 | 442.00 | 360.00 | 40.00 | 90.50 |
| BE | 8 | 0.80 | 332.80 | 250.00 | 45.00 | 88.64 |
| AI | 4 | 0.75 | 156.00 | 120.00 | 20.00 | 89.74 |
| PM/PO | 5 | 0.80 | 208.00 | 140.00 | 30.00 | 81.73 |

Interpretation:
1. FE, BE, AI are within hard limit but above typical warning thresholds.
2. PM/PO has headroom and may be used as pacing control.
3. If any role crosses 100%, commitment must be rejected.

## 11.2 Appendix B - Example Commitment Scenario
Scenario:
1. A PM proposes a client project requiring FE 2.0, BE 1.5, AI 0.5, PM/PO 0.5 for 12 weeks.
2. Existing client portfolio has concurrent high FE demand from two active roadmap items.
3. Weekly overlap validation shows FE weekly utilization at 108.0% in ISO week W37.
4. System response status = REJECTED with FE breach role and week reference.
5. PM and VP rebalance by moving one lower-priority initiative start date by four weeks.
6. Re-validation returns FE peak at 94.0%; status becomes APPROVED.

Scenario Governance Outcome:
1. No manual override of hard limit was allowed.
2. Decision is traceable and reproducible.
3. Portfolio balance was achieved through schedule correction, not hidden overcommitment.

## 11.3 Appendix C - JSON Validation Output Format
```json
{{
  "status": "APPROVED or REJECTED",
  "breach_roles": [],
  "utilization_percentage": {{
    "FE": "",
    "BE": "",
    "AI": "",
    "PM": ""
  }},
  "reason": "Short explanation"
}}
```

## 11.4 Appendix D - Governance Review Checklist
1. Are team size and efficiency settings current and approved?
2. Are quota splits aligned with current strategic priorities?
3. Are rejected commitments accompanied by clear remediation actions?
4. Are repeated breaches concentrated in specific roles or portfolios?
5. Is timeline overlap validation producing expected preventive controls?
6. Is the warning threshold producing early and actionable signals?
7. Are inactive accounts reviewed and deprovisioned under admin control?
8. Is audit evidence retained with version and timestamp integrity?

## 11.5 Appendix E - Operational Control Notes
1. Deterministic validation logic must be versioned and change-controlled.
2. Formula changes require governance approval before production release.
3. Admin account lifecycle shall be controlled with least privilege principles.
4. Emergency access shall be time-bound and logged.
5. Documentation updates shall include revision rationale and approval evidence.
6. KPI trends (utilization, rejection rate, breach density) should be reviewed monthly.

---

End of controlled document.
"""


def generate_master_governance_doctrine(
    prepared_by: str,
    approved_by: str,
    effective_date: date,
    cfg: GovernanceConfig | None = None,
    version: str = "2.0",
) -> str:
    snapshot = _cfg_snapshot(cfg)
    effective_date_text = effective_date.isoformat()
    team_fe = int(snapshot["team_fe"])
    team_be = int(snapshot["team_be"])
    team_ai = int(snapshot["team_ai"])
    team_pm = int(snapshot["team_pm"])
    eff_fe = snapshot["eff_fe"]
    eff_be = snapshot["eff_be"]
    eff_ai = snapshot["eff_ai"]
    eff_pm = snapshot["eff_pm"]
    quota_client = snapshot["quota_client"]
    quota_internal = snapshot["quota_internal"]
    annual_eff_fe = snapshot["annual_eff_fe"]
    annual_eff_be = snapshot["annual_eff_be"]
    annual_eff_ai = snapshot["annual_eff_ai"]
    annual_eff_pm = snapshot["annual_eff_pm"]

    return f"""# MASTER CONTROL CHARTER
## Resource Commitment and Capacity Governance Doctrine (L2)

# 0.0 Document Control
## 0.1 Classification
Controlled Governance Instrument - Board and Executive Authority

## 0.2 Version
{version}

## 0.3 Prepared By
{prepared_by}

## 0.4 Approved By
{approved_by}

## 0.5 Effective Date
{effective_date_text}

## 0.6 Statement of Legal and Operational Intent
This doctrine establishes binding enterprise control over resource commitments and planning feasibility. It is not a process suggestion. It is a governance instrument designed to prevent overcommitment, preserve execution credibility, and create enforceable accountability from executive intent through portfolio balancing and project-level commitments.

The doctrine is operative across all initiatives that consume Frontend, Backend, AI, and Project Management capacity. No role, including executive role, is exempt from the mathematical control rules defined herein. The governance engine is deterministic by design and non-bypassable by policy. This doctrine is valid for audit, management review, and board-level risk governance.

## 0.7 Current Configuration Snapshot
| Role | Team Size | Efficiency Coefficient | Effective Annual Capacity (person-weeks) |
|---|---:|---:|---:|
| FE | {team_fe} | {eff_fe:.2f} | {annual_eff_fe:.2f} |
| BE | {team_be} | {eff_be:.2f} | {annual_eff_be:.2f} |
| AI | {team_ai} | {eff_ai:.2f} | {annual_eff_ai:.2f} |
| PM | {team_pm} | {eff_pm:.2f} | {annual_eff_pm:.2f} |

| Portfolio | Allocation Ratio |
|---|---:|
| Client | {quota_client:.2f} |
| Internal | {quota_internal:.2f} |

# 1.0 Governance Philosophy
## 1.1 Overcommitment as a Governable Failure Mode
Overcommitment is not an operational inconvenience. It is an enterprise failure mode that creates structural distortion in delivery forecasting, quality outcomes, staff health, and executive decision validity. When commitments exceed realizable capacity, every downstream control degrades. Timeline reliability becomes fictional. Budget consumption accelerates without commensurate value realization. Quality gates are compressed. Defect containment shifts from prevention to recovery. Team morale erodes because expectations are mathematically unattainable and therefore politically negotiated rather than operationally executable.

This doctrine treats overcommitment as a control failure that must be prevented upstream, not explained downstream. The governance engine therefore enforces commitment discipline before work is admitted into roadmap obligation. The policy premise is explicit: commitments are admitted only when capacity is demonstrably available under configured efficiency assumptions, portfolio allocation constraints, and overlap-aware timeline checks. If these conditions are not met, rejection is mandatory, not discretionary.

## 1.2 Commitment Discipline as a Control System
Commitment discipline is implemented as a closed-loop control architecture composed of authority assignment, deterministic computation, non-bypassable decision gates, and audit trace persistence. Inputs are role-level capacity baselines, efficiency coefficients, portfolio quotas, and incremental project demand. The controller is deterministic validation logic. The output is a binary governance decision: APPROVED or REJECTED.

Feedback is provided through utilization telemetry, breach roles, and remediation pathways. Control quality is measured by reduction in late-stage resource conflicts, reduction in replan volatility, and alignment between approved commitments and actual throughput. Because this is a control system rather than a planning preference, any attempt to bypass the gate is categorized as governance nonconformance and must be logged, escalated, and corrected.

## 1.3 Behavioral Governance Intent
The doctrine is intentionally designed to constrain cognitive and organizational bias. It suppresses optimism bias by forcing estimations into role-resolved utilization formulas. It suppresses ambition inflation by binding strategic intent to measurable throughput. It suppresses silent contention by evaluating shared-role demand across portfolios and overlapping time windows. Governance discipline is therefore not merely procedural compliance; it is risk containment through deterministic structure.

# 2.0 Authority Architecture
## 2.1 Principle of Non-Overlapping Authority
Authority domains are intentionally disjoint. Strategic capacity ownership, allocation ownership, and commitment submission ownership are separated to prevent self-approval loops and hidden assumption drift. The engine enforces this separation in role-based access control and validation pathways. No domain can absorb another domain's authority without explicit governance revision approved at board or executive committee level.

## 2.2 CEO Domain - Capacity Baseline Authority
The CEO owns enterprise capacity baseline authority. This includes the approved team size per role, baseline efficiency coefficients per role, target utilization threshold policy, and annual capacity posture accepted by the enterprise.

The CEO does not approve individual commitments through narrative discretion. The CEO governs the baseline envelope from which deterministic decisions are derived. Any change to baseline authority is a policy change and must be versioned, dated, and attributable.

## 2.3 VP Domain - Allocation Authority
The VP owns allocation authority within the CEO-approved capacity envelope. The VP allocates effective capacity across portfolio classes, manages contention between internal and client obligations, and escalates structural imbalance to the CEO when allocation pressure indicates baseline insufficiency.

VP authority cannot override hard-stop breaches. VP authority can rebalance sequence, defer lower-value demand, and adjust allocation percentages within approved guardrails. VP authority cannot redefine formulas or bypass deterministic outcomes.

## 2.4 PM Domain - Commitment Submission Authority
The PM owns commitment submission authority for project demand. This includes scope statement, activity decomposition, role-specific FTE demand, and planned timeline envelope. The PM cannot self-authorize acceptance. PM authority ends at submission quality and remediation of rejected submissions.

PM responsibility includes ensuring that submitted demand reflects engineering-validated effort and that no hidden work is excluded to force artificial approval. Submission quality is an auditable obligation.

## 2.5 Engineering Leads Domain - Estimation Authority
Engineering Leads own estimation authority for FE, BE, and AI loading assumptions and technical feasibility constraints. Their authority is not cosmetic. The governance engine depends on role-level effort realism for deterministic integrity.

Engineering Leads do not own portfolio allocation and do not own commitment admission decision. They own effort realism and feasibility attestation. Inflated compression or omitted dependency effort constitutes governance nonconformance.

## 2.6 Hierarchy and Non-Bypassability
Authority is hierarchical and non-bypassable: CEO -> VP -> PM -> Engineering Leads. Escalation follows the same direction. No lower layer can supersede a higher-layer policy artifact. No higher layer can bypass deterministic hard-stop logic without formally changing baseline governance parameters and recording the policy revision as a controlled change event.

# 3.0 Capacity Mathematics Embedded in Governance Logic
## 3.1 Definitions Used for Enforcement
Effective Capacity is the calculable productive throughput available for a role after application of role efficiency coefficient.
Efficiency Coefficient is the controlled productivity multiplier for each role.
Utilization is the ratio of committed demand to effective capacity.
Threshold is the governance warning boundary indicating elevated risk.
Hard Stop is the absolute admission boundary at which commitments are rejected.

## 3.2 Formula Set
Effective Capacity(role, period) = Total Resources(role) x Efficiency Coefficient(role) x Period Length

Utilization(role, period) = Committed Demand(role, period) / Effective Capacity(role, period)

Utilization Percent(role, period) = Utilization(role, period) x 100

Allocated Capacity(role, portfolio, period) = Effective Capacity(role, period) x Portfolio Allocation(portfolio)

Post-Commit Utilization(role, period) = (Current Commitments(role, period) + Proposed Commitment(role, period)) / Effective Capacity(role, period)

## 3.3 Enforcement Narrative
Formulas are not advisory analytics; they are enforcement primitives. Every commitment decision is derived from these equations under role and timeline resolution. If post-commit utilization exceeds configured threshold, warning and escalation paths are triggered. If post-commit utilization exceeds hard-stop boundary, admission is rejected immediately. The decision is binary, deterministic, and recorded with role-level breach evidence.

## 3.4 Weekly Overlap as Primary Conflict Surface
Annual aggregates can conceal local overload. Therefore, enforcement must include overlap-aware weekly checks. Weekly effective capacity per role is computed from role baseline and efficiency assumptions. All commitments intersecting a week are aggregated. If aggregate demand in any week exceeds weekly effective capacity, hard-stop rejection is mandatory even when annual totals appear acceptable.

## 3.5 Parameter Governance
Team size, efficiency coefficients, and portfolio allocation are controlled parameters. Parameter values must be current, approved, and versioned. Any stale or missing parameter invalidates validation integrity and therefore blocks commitment processing until corrected.

# 4.0 Deterministic Validation Doctrine
## 4.1 Programmatic Determinism Requirement
Validation must execute in deterministic program logic implemented in code or deterministic database aggregation. The engine shall not delegate arithmetic, threshold comparison, or breach adjudication to generative AI reasoning. AI may support narrative assistance but shall not produce authoritative commitment calculations.

## 4.2 Input Identity and Output Identity
Identical input must produce identical output. This is a non-negotiable property. Input identity includes capacity parameters, portfolio allocation, current committed load, proposed demand, and timeline boundaries. Output identity includes status, breach roles, utilization percentages, and reason code. Any observed inconsistency under identical input is treated as a control defect requiring incident response.

## 4.3 No Hard-Limit Override
Manual override at hard stop is prohibited. No role can force APPROVED status when any role utilization exceeds 100 percent under the active policy envelope. The only lawful path to admission under breach condition is parameter correction, portfolio reprioritization, demand reduction, or timeline re-sequencing followed by deterministic revalidation.

## 4.4 Validation Contract
The minimum machine contract for validation output is:
- `status`: APPROVED or REJECTED
- `breach_roles`: role keys exceeding allowed utilization
- `utilization_percentage`: per-role utilization percentages
- `reason`: deterministic explanation suitable for audit

Contract stability is mandatory. Schema changes require version control and controlled deployment.

## 4.5 Failure-State Doctrine
If governance baseline is absent, malformed, or stale beyond policy tolerance, validation returns configuration failure and commitment admission is denied. Incomplete governance data is treated as control unavailability, not as permission to proceed.

# 5.0 Behavioral Risk Control
## 5.1 Control of Optimism Bias
Optimism bias appears when schedule confidence is decoupled from role-specific loading. The doctrine suppresses this by requiring explicit FE, BE, AI, and PM demand values and enforcing utilization checks against configured effective capacity. Narrative confidence cannot substitute for quantified demand.

## 5.2 Control of Hidden Cross-Portfolio Contention
Cross-portfolio contention emerges when independently approved work streams consume the same role pool in overlapping periods. The doctrine controls this by binding VP allocation policy to a shared capacity base and requiring timeline overlap validation during commitment admission.

## 5.3 Control of Inflated or Distorted Estimates
Inflated estimates can be used tactically to reserve capacity; compressed estimates can be used tactically to force admission. Both are governance risks. Engineering estimation authority, PM submission accountability, and audit traceability collectively reduce estimate manipulation by making deviations attributable and reviewable.

## 5.4 Control of Executive Ambition Misalignment
Strategic ambition without capacity realism causes systemic execution debt. The doctrine requires CEO baseline authority to remain mathematically coherent with portfolio demand and delivery realities. If ambition expands while baseline remains unchanged, rejection rates and threshold saturation become governance signals that mandate executive recalibration.

## 5.5 Behavioral Locking Mechanisms
Behavioral locking is achieved through:
1. Non-bypassable hard-stop logic.
2. Mandatory role separation.
3. Structured rejection reasons.
4. Immutable decision logs.
5. Escalation that cannot be silently cleared without authorized action.

These mechanisms convert governance intent into operational behavior.

# 6.0 Operational Manual with Decision Ownership
## 6.1 Step 1 - CEO Configuration (Owner: CEO)
1. Set total team size per role: FE, BE, AI, PM.
2. Set efficiency coefficient per role based on observed enterprise throughput.
3. Set warning threshold policy.
4. Confirm annual capacity baseline.
5. Publish parameter set with version and effective date.

CEO decision ownership: baseline integrity and policy legitimacy.

## 6.2 Step 2 - VP Quota Allocation (Owner: VP)
1. Assign portfolio allocation ratios within CEO baseline.
2. Validate that allocation total remains policy-compliant.
3. Publish quota rationale for traceability.
4. Monitor portfolio saturation by role.
5. Escalate persistent structural imbalance to CEO.

VP decision ownership: allocation coherence and portfolio contention management.

## 6.3 Step 3 - PM Commitment Submission (Owner: PM)
1. Define commitment scope and activities at execution-ready granularity.
2. Capture role-level FTE demand.
3. Capture planned start and end dates.
4. Attach justification and dependency context.
5. Submit for deterministic validation.

PM decision ownership: demand quality and schedule realism.

## 6.4 Step 4 - Engineering Feasibility Attestation (Owner: Engineering Leads)
1. Review role loading assumptions.
2. Validate dependency-driven effort.
3. Flag infeasible compression assumptions.
4. Confirm estimation basis.
5. Return validated effort profile to PM.

Engineering decision ownership: estimation realism and technical feasibility.

## 6.5 Step 5 - System Validation (Owner: System Control Layer)
1. Retrieve active baseline parameters.
2. Aggregate current commitments.
3. Add proposed demand.
4. Compute utilization by role and period.
5. Evaluate threshold and hard-stop rules.
6. Emit deterministic decision contract.

System decision ownership: mathematical enforcement and evidence emission.

## 6.6 Step 6 - Rejection Remediation (Owner: PM with VP Oversight)
1. Read role-level breach evidence.
2. Modify demand, timeline, or sequence.
3. Request allocation rebalance if justified.
4. Re-submit for validation.
5. Escalate unresolved structural constraints through hierarchy.

Remediation ownership: PM executes correction; VP governs reprioritization; CEO governs baseline change.

# 7.0 Escalation Physics
## 7.1 Threshold Breach Dynamics
When utilization exceeds threshold but remains at or below hard-stop limit, the engine issues warning state. Warning state mandates risk acknowledgment and portfolio review. Warning state cannot be ignored in downstream approvals; it requires documented owner action by PM and VP.

## 7.2 Hard-Stop Trigger Dynamics
When any role exceeds hard-stop boundary, commitment is rejected instantly. The rejection event is non-reversible in-line. The submission must be changed and revalidated. No executive annotation or verbal instruction can convert the rejected event into approved status without a new deterministic evaluation run.

## 7.3 Repeated Rejection Dynamics
Repeated rejection of materially similar demand indicates structural mismatch between demand pipeline and approved capacity envelope. Repeated rejection events trigger mandatory escalation:
1. PM to VP after first repeated conflict pattern.
2. VP to CEO when allocation tuning fails to restore feasibility.
3. CEO to governance board when baseline revision materially impacts strategic roadmap posture.

## 7.4 Missing Baseline Dynamics
If baseline parameters are incomplete, stale, or absent, the engine enters governance-fail-safe mode and blocks commitment admission. This condition escalates directly to CEO and cannot be closed by PM or VP action alone.

## 7.5 Irreversibility Requirement
Escalation states are irreversible once triggered. They may only be closed through explicit corrective action recorded in governance history. Silent state reset is prohibited. This ensures that risk signal integrity is preserved for audit and leadership review.

# 8.0 Audit Doctrine
## 8.1 Mandatory Logging Envelope
The following must be logged for every validation event:
1. Submission identifier and actor.
2. Timestamp and policy version.
3. Baseline parameter snapshot.
4. Proposed demand payload.
5. Current commitment aggregation basis.
6. Role-wise utilization output.
7. Decision status and reason.
8. Breach roles and escalation state.

## 8.2 Evidence Retention
Retention must preserve full decision trace from submission through final roadmap disposition. Evidence includes parameter revisions, quota changes, validation outputs, rejection remediation actions, and escalation closure records. Retention duration follows enterprise compliance policy and cannot be shortened for convenience.

## 8.3 Decision Traceability
Each approved roadmap commitment must be traceable to:
1. Source submission.
2. Deterministic validation output.
3. Active governance baseline version.
4. Allocation context at approval time.
5. Responsible role identities.

Traceability must support audit replay of the decision context.

## 8.4 Formula Version Control
Any formula change is a controlled governance change. Formula revisions must include:
1. Change rationale.
2. Risk impact statement.
3. Approval record.
4. Effective date.
5. Regression test evidence.

Unversioned formula changes are prohibited.

## 8.5 Audit Defensibility Standard
A decision is audit-defensible only if an independent reviewer can reproduce outcome and rationale from persisted evidence without reliance on oral explanation. If reproducibility fails, governance quality is nonconforming.

# 9.0 Appendices
## 9.1 Appendix A - Calculation Scenario
Scenario parameters:
1. FE total resources: 10.
2. FE efficiency coefficient: 0.85.
3. Client quota: 0.60.
4. Current committed FE for client portfolio over 12-week horizon: 48.0 FTE-weeks.
5. Proposed FE commitment over same horizon: 18.0 FTE-weeks.

Deterministic computation:
1. FE effective annual capacity = 10 x 0.85 x 52 = 442.0 person-weeks.
2. FE client allocated annual capacity = 442.0 x 0.60 = 265.2 person-weeks.
3. Post-commit FE load = 48.0 + 18.0 = 66.0 FTE-weeks.
4. Post-commit utilization = 66.0 / 265.2 = 0.2489.
5. Post-commit utilization percent = 24.89%.

Result:
No breach if threshold is 85% and hard stop is 100%. Status remains APPROVED for FE role on annual envelope basis, subject to weekly overlap validation.

## 9.2 Appendix B - Weekly Overlap Breach Example
Weekly baseline:
1. FE team size = 6.
2. FE efficiency = 0.80.
3. Client quota = 0.70.

Weekly FE client effective capacity:
6 x 0.80 x 0.70 = 3.36 FTE per week.

Existing commitments in ISO week W37:
1. Program Alpha FE load = 1.40 FTE.
2. Program Beta FE load = 1.10 FTE.
3. Program Gamma FE load = 0.95 FTE.
Current total = 3.45 FTE.

Proposed new commitment FE load in week W37:
0.40 FTE.

Post-commit FE weekly load:
3.45 + 0.40 = 3.85 FTE.

Utilization:
3.85 / 3.36 = 1.1458.
Utilization percent = 114.58%.

Doctrine outcome:
1. Hard stop triggered.
2. Submission rejected.
3. Breach role recorded as FE.
4. Escalation state activated.
5. Remediation requires schedule shift, demand reduction, or allocation/baseline change and revalidation.

## 9.3 Appendix C - JSON Validation Output Contract
```json
{{
  "status": "APPROVED or REJECTED",
  "breach_roles": [],
  "utilization_percentage": {{
    "FE": "",
    "BE": "",
    "AI": "",
    "PM": ""
  }},
  "reason": "Short explanation"
}}
```

## 9.4 Appendix D - Controlled Statements
1. Validation arithmetic is deterministic and machine-executed.
2. Hard-limit override is prohibited.
3. Escalation state is irreversible until explicit closure action is logged.
4. Authority domains are non-overlapping and non-bypassable.
5. Every approved commitment must be reproducible from persisted evidence.

## 9.5 Appendix E - Enforcement Clauses
Clause 1: Any attempt to bypass hard-stop validation is a governance breach.
Clause 2: Any unlogged parameter change invalidates downstream decision defensibility.
Clause 3: Any role-based action outside authority domain is unauthorized and must be rejected.
Clause 4: Any commitment approved without deterministic validation output is noncompliant and subject to corrective review.
Clause 5: Any unresolved repeated rejection pattern beyond governance SLA requires executive escalation.

## 9.6 Appendix F - Governance Effectiveness Review Protocol
The doctrine is only credible if control outcomes are measured with the same rigor used for admission control. Governance effectiveness review shall be performed on a fixed cadence and shall evaluate both control strictness and business consequence. Strictness without throughput viability is misgovernance. Throughput without control integrity is unmanaged risk. The review protocol therefore requires dual validation of control quality and operational practicality.

Minimum monthly review metrics shall include:
1. Rejection ratio by role and portfolio.
2. Threshold warning density by week and by role.
3. Average remediation cycle time from rejection to resubmission.
4. Share of commitments approved on first deterministic pass.
5. Frequency of baseline parameter changes and associated rationale quality.
6. Concentration of breaches by portfolio to detect structural allocation distortion.

Quarterly governance review shall include executive attestation:
1. CEO attests baseline realism and policy relevance.
2. VP attests allocation balance and contention management adequacy.
3. PM leadership attests submission quality discipline.
4. Engineering leadership attests estimate realism and technical feasibility integrity.

Where sustained warning saturation is observed, the doctrine requires corrective action planning, not dashboard acknowledgment. Corrective action options include demand sequencing, allocation rebalance, baseline recalibration, and explicit strategic scope reduction. If no action is taken, unresolved saturation shall be escalated as governance negligence.

## 9.7 Appendix G - Nonconformance and Corrective Action Doctrine
Governance nonconformance exists when defined controls are bypassed, falsified, or applied inconsistently. Nonconformance categories are:
1. Computational nonconformance: deterministic logic altered without controlled change.
2. Process nonconformance: commitment admitted without valid deterministic output.
3. Authority nonconformance: decision executed by role outside designated authority.
4. Evidence nonconformance: missing or incomplete trace required for audit reproduction.

Corrective action requirements:
1. Detect and classify nonconformance severity.
2. Contain impact by suspending affected admission path if needed.
3. Perform root-cause analysis with accountable owner assignment.
4. Deploy corrective action with completion date and verification plan.
5. Validate correction by replaying representative decision scenarios.
6. Record closure evidence and review residual risk at governance forum.

Repeated nonconformance in the same control domain escalates automatically to executive review, and unresolved material nonconformance escalates to board-level risk committee review. Governance integrity is preserved only when violations produce visible, enforceable consequence.

End of L2 governance doctrine.
"""


def _escape_html(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _paragraph_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "DocTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#102A43"),
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "DocSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#243B53"),
            spaceAfter=18,
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#0B1F33"),
            spaceBefore=14,
            spaceAfter=6,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=15,
            textColor=colors.HexColor("#102A43"),
            spaceBefore=10,
            spaceAfter=5,
        ),
        "h3": ParagraphStyle(
            "H3",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=14,
            textColor=colors.HexColor("#243B53"),
            spaceBefore=8,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.4,
            leading=13.2,
            textColor=colors.HexColor("#102A43"),
            spaceAfter=5,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.3,
            leading=13.0,
            leftIndent=15,
            firstLineIndent=-10,
            textColor=colors.HexColor("#102A43"),
            spaceAfter=3,
        ),
        "code": ParagraphStyle(
            "Code",
            parent=base["Code"],
            fontName="Courier",
            fontSize=8.4,
            leading=11,
            leftIndent=8,
            rightIndent=8,
            backColor=colors.HexColor("#F5F7FA"),
            borderColor=colors.HexColor("#D9E2EC"),
            borderWidth=0.6,
            borderPadding=6,
            spaceBefore=4,
            spaceAfter=8,
        ),
        "meta": ParagraphStyle(
            "Meta",
            parent=base["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=8.2,
            leading=10.5,
            textColor=colors.HexColor("#486581"),
        ),
    }


def _parse_markdown_table(table_lines: list[str], styles: dict[str, ParagraphStyle]) -> Table | None:
    rows: list[list[str]] = []
    for raw in table_lines:
        line = raw.strip()
        if not line.startswith("|"):
            continue
        parts = [cell.strip() for cell in line.strip("|").split("|")]
        if all(re.fullmatch(r"[:\- ]+", part or "-") for part in parts):
            continue
        if any(parts):
            rows.append(parts)
    if not rows:
        return None

    width = max(len(r) for r in rows)
    normalized: list[list[Paragraph]] = []
    for row in rows:
        padded = row + [""] * (width - len(row))
        normalized.append([Paragraph(_escape_html(cell), styles["body"]) for cell in padded])

    table = Table(normalized, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D9E2EC")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#102A43")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.8),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9FB3C8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def _markdown_to_story(document_text: str, styles: dict[str, ParagraphStyle]) -> list:
    story: list = []
    lines = document_text.splitlines()
    i = 0
    code_mode = False
    code_lines: list[str] = []

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()

        if stripped.startswith("```"):
            if code_mode:
                story.append(Preformatted("\n".join(code_lines), styles["code"]))
                code_lines = []
                code_mode = False
            else:
                code_mode = True
            i += 1
            continue

        if code_mode:
            code_lines.append(line)
            i += 1
            continue

        if not stripped:
            story.append(Spacer(1, 5))
            i += 1
            continue

        if stripped.startswith("|"):
            block: list[str] = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                block.append(lines[i].rstrip())
                i += 1
            table = _parse_markdown_table(block, styles)
            if table:
                story.append(table)
                story.append(Spacer(1, 8))
            continue

        if line.startswith("# "):
            if story:
                story.append(PageBreak())
            story.append(Paragraph(_escape_html(line[2:].strip()), styles["h1"]))
            i += 1
            continue

        if line.startswith("## "):
            story.append(Paragraph(_escape_html(line[3:].strip()), styles["h2"]))
            i += 1
            continue

        if line.startswith("### "):
            story.append(Paragraph(_escape_html(line[4:].strip()), styles["h3"]))
            i += 1
            continue

        if re.match(r"^\d+\.\s", stripped) or stripped.startswith("- "):
            bullet_text = stripped
            story.append(Paragraph(_escape_html(bullet_text), styles["bullet"]))
            i += 1
            continue

        story.append(Paragraph(_escape_html(stripped), styles["body"]))
        i += 1

    if code_lines:
        story.append(Preformatted("\n".join(code_lines), styles["code"]))
    return story


def _draw_page_decor(pdf: canvas.Canvas, doc, title: str) -> None:
    pdf.saveState()
    width, height = A4
    pdf.setStrokeColor(colors.HexColor("#BCCCDC"))
    pdf.setLineWidth(0.4)
    pdf.line(18 * mm, height - 14 * mm, width - 18 * mm, height - 14 * mm)
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(colors.HexColor("#486581"))
    pdf.drawString(18 * mm, height - 10.5 * mm, title[:90])
    pdf.drawRightString(width - 18 * mm, 10 * mm, f"Page {doc.page}")
    pdf.restoreState()


def render_project_document_pdf(
    document_text: str,
    title: str = "Resource Commitment Capacity Governance",
    subtitle: str | None = None,
) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=16 * mm,
        title=title,
    )
    styles = _paragraph_styles()
    story: list = [
        Paragraph(_escape_html(title), styles["title"]),
    ]
    if subtitle:
        story.append(Paragraph(_escape_html(subtitle), styles["subtitle"]))
    story.append(Spacer(1, 8))
    story.extend(_markdown_to_story(document_text, styles))

    doc.build(
        story,
        onFirstPage=lambda pdf, d: _draw_page_decor(pdf, d, title),
        onLaterPages=lambda pdf, d: _draw_page_decor(pdf, d, title),
    )
    return buffer.getvalue()
