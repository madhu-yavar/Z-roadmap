import { useState, useEffect } from 'react'
import { api } from './api'

export interface FteRole {
  id: number
  name: string
  abbreviation: string
  description: string
  category: string
  default_efficiency_factor: number
  is_active: boolean
  display_order: number
  color_code: string
  created_by: number | null
  updated_by: number | null
  created_at: string
  updated_at: string
}

export default function FteRoleManager() {
  const [roles, setRoles] = useState<FteRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<FteRole | null>(null)
  const [showForm, setShowForm] = useState(false)
  const token = localStorage.getItem('token') || ''

  useEffect(() => {
    loadRoles()
  }, [])

  const loadRoles = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api<FteRole[]>('/fte_roles/', token)
      setRoles(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FTE roles')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (roleData: Partial<FteRole>) => {
    setError('')
    try {
      await api<FteRole>('/fte_roles/', token, {
        method: 'POST',
        body: JSON.stringify(roleData),
      })
      setShowForm(false)
      loadRoles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create FTE role')
    }
  }

  const handleUpdate = async (id: number, roleData: Partial<FteRole>) => {
    setError('')
    try {
      await api<FteRole>(`/fte_roles/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify(roleData),
      })
      setEditing(null)
      loadRoles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update FTE role')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this FTE role?')) return
    setError('')
    try {
      await api<FteRole>(`/fte_roles/${id}`, token, {
        method: 'DELETE',
      })
      loadRoles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate FTE role')
    }
  }

  if (loading) return <div className="loading">Loading FTE roles...</div>

  return (
    <div className="fte-role-manager">
      <div className="flex-between">
        <h3>FTE Role Management</h3>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add New Role
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <FteRoleForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          existingRoles={roles}
        />
      )}

      {editing && (
        <FteRoleForm
          role={editing}
          onSubmit={(data) => handleUpdate(editing.id, data)}
          onCancel={() => setEditing(null)}
          existingRoles={roles}
        />
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Abbrev</th>
            <th>Name</th>
            <th>Category</th>
            <th>Efficiency</th>
            <th>Color</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id}>
              <td>{role.display_order}</td>
              <td>
                <span className="role-badge" style={{ backgroundColor: role.color_code }}>
                  {role.abbreviation}
                </span>
              </td>
              <td>{role.name}</td>
              <td>{role.category}</td>
              <td>{role.default_efficiency_factor}</td>
              <td>
                <div
                  className="color-swatch"
                  style={{ backgroundColor: role.color_code }}
                />
              </td>
              <td>{role.is_active ? 'Active' : 'Inactive'}</td>
              <td>
                <button
                  className="btn btn-sm"
                  onClick={() => setEditing(role)}
                  disabled={!role.is_active}
                >
                  Edit
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(role.id)}
                  disabled={!role.is_active}
                >
                  Deactivate
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface FteRoleFormProps {
  role?: FteRole
  onSubmit: (data: Partial<FteRole>) => void
  onCancel: () => void
  existingRoles: FteRole[]
}

function FteRoleForm({ role, onSubmit, onCancel, existingRoles }: FteRoleFormProps) {
  const [formData, setFormData] = useState({
    name: role?.name || '',
    abbreviation: role?.abbreviation || '',
    description: role?.description || '',
    category: role?.category || 'full_time',
    default_efficiency_factor: role?.default_efficiency_factor || 1.0,
    display_order: role?.display_order || (existingRoles.length + 1),
    color_code: role?.color_code || '#3B82F6',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="form-panel">
      <h4>{role ? 'Edit FTE Role' : 'Create New FTE Role'}</h4>

      <div className="split-2">
        <label>
          Name
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="e.g., Frontend"
          />
        </label>
        <label>
          Abbreviation
          <input
            type="text"
            value={formData.abbreviation}
            onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value.toUpperCase() })}
            required
            maxLength={10}
            placeholder="e.g., FE"
          />
        </label>
      </div>

      <div className="split-2">
        <label>
          Category
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          >
            <option value="full_time">Full Time</option>
            <option value="intern">Intern</option>
            <option value="contractor">Contractor</option>
            <option value="consultant">Consultant</option>
            <option value="part_time">Part Time</option>
          </select>
        </label>
        <label>
          Display Order
          <input
            type="number"
            value={formData.display_order}
            onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
            min={0}
          />
        </label>
      </div>

      <div className="split-2">
        <label>
          Default Efficiency Factor
          <input
            type="number"
            value={formData.default_efficiency_factor}
            onChange={(e) => setFormData({ ...formData, default_efficiency_factor: Number(e.target.value) })}
            min={0.1}
            max={2.0}
            step={0.1}
          />
        </label>
        <label>
          Color Code
          <input
            type="color"
            value={formData.color_code}
            onChange={(e) => setFormData({ ...formData, color_code: e.target.value })}
          />
        </label>
      </div>

      <label>
        Description
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Role description..."
          rows={2}
        />
      </label>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          {role ? 'Update' : 'Create'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
