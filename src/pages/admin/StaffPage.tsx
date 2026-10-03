import { useState, useEffect } from 'react'
import {
  Plus, Edit2, Trash2, Key, Copy, Check, Eye, EyeOff,
  Sparkles, Shield, UserCheck, Lock, Mail, User
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/admin/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { hasPermission } from '@/lib/permissions'
import type { StaffRole } from '@/types/database'
import { staffService, type StaffMember } from '@/services/staffService'
import toast from 'react-hot-toast'

const roleColors: Record<StaffRole, string> = {
  owner: 'bg-stone-800 text-white border-stone-800',
  admin: 'bg-orange-100 text-orange-700 border-orange-200',
  manager: 'bg-blue-100 text-blue-700 border-blue-200',
  staff: 'bg-stone-100 text-stone-700 border-stone-200',
  kitchen: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const roleLabels: Record<StaffRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  kitchen: 'Kitchen',
}

function generateRandomPassword(): string {
  const words = ['Staff', 'Chef', 'Server', 'Table', 'Kitchen', 'Order']
  const randomWord = words[Math.floor(Math.random() * words.length)]
  const randomNum = Math.floor(1000 + Math.random() * 9000)
  return `${randomWord}@${randomNum}`
}

export function StaffPage() {
  const { profile } = useAuth()
  const canManageStaff = hasPermission(profile?.role, 'manage_staff')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  // Drawer Form State
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null)
  const [deleteStaff, setDeleteStaff] = useState<StaffMember | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('staff')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  // Created Credentials Modal State
  const [credentialsModalStaff, setCredentialsModalStaff] = useState<StaffMember | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const loadStaff = async () => {
    setLoading(true)
    const list = await staffService.getStaff(profile?.restaurant_id || undefined)
    setStaff(list)
    setLoading(false)
  }

  useEffect(() => {
    loadStaff()
  }, [profile?.restaurant_id])

  const openAdd = () => {
    setEditStaff(null)
    setName('')
    setEmail('')
    setPassword(generateRandomPassword())
    setRole('staff')
    setStatus('active')
    setShowPassword(true)
    setDrawerOpen(true)
  }

  const openEdit = (member: StaffMember) => {
    setEditStaff(member)
    setName(member.name)
    setEmail(member.email)
    setPassword(member.password || '')
    setRole(member.role)
    setStatus(member.status || 'active')
    setShowPassword(false)
    setDrawerOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      toast.error('Please enter name and email address')
      return
    }

    if (!editStaff && !password.trim()) {
      toast.error('Please provide an initial password for the staff member')
      return
    }

    setSaving(true)

    if (editStaff) {
      const res = await staffService.updateStaff(editStaff.id, {
        name: name.trim(),
        role,
        status,
        ...(password.trim() ? { password: password.trim() } : {}),
      })
      setSaving(false)

      if (res.error) {
        toast.error(res.error)
        return
      }

      toast.success('Staff member updated successfully!')
      setDrawerOpen(false)
      loadStaff()
    } else {
      // Direct staff account creation with credentials
      const res = await staffService.createStaff({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        role,
        restaurant_id: profile?.restaurant_id || undefined,
      })
      setSaving(false)

      if (res.error || !res.staff) {
        toast.error(res.error || 'Failed to create staff member')
        return
      }

      toast.success('Staff account created directly!')
      setDrawerOpen(false)
      await loadStaff()
      // Open credentials confirmation modal
      setCredentialsModalStaff(res.staff)
    }
  }

  const handleDelete = async () => {
    if (!deleteStaff) return
    const res = await staffService.deleteStaff(deleteStaff.id)
    if (!res.success) {
      toast.error(res.error || 'Failed to remove staff member')
      return
    }
    toast.success('Staff member removed')
    setDeleteStaff(null)
    loadStaff()
  }

  const handleCopyCredentials = (member: StaffMember) => {
    const loginUrl = `${window.location.origin}/admin/login`
    const text = `Staff Account Credentials:
URL: ${loginUrl}
Email: ${member.email}
Password: ${member.password || 'Contact Admin'}
Role: ${roleLabels[member.role]}

Note: You can log in immediately. You can change your password anytime using "Forgot password" on the login screen.`

    navigator.clipboard.writeText(text)
    setCopiedKey(member.id)
    toast.success('Credentials copied to clipboard!')
    setTimeout(() => setCopiedKey(null), 2500)
  }

  const columns = [
    {
      header: 'Staff Member',
      cell: (member: StaffMember) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center font-bold text-stone-700 text-xs">
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-[var(--color-text-primary)] text-xs flex items-center gap-1.5">
              <span>{member.name}</span>
              {member.role === 'owner' && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-white font-semibold">
                  Owner
                </span>
              )}
            </div>
            <div className="text-[11px] text-stone-500 font-mono">{member.email}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Role',
      cell: (member: StaffMember) => (
        <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-semibold border', roleColors[member.role])}>
          {roleLabels[member.role]}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (member: StaffMember) => (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider',
            member.status === 'active'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-stone-100 text-stone-500 border border-stone-200'
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', member.status === 'active' ? 'bg-emerald-500' : 'bg-stone-400')} />
          <span>{member.status === 'active' ? 'Active' : 'Inactive'}</span>
        </span>
      ),
    },
    {
      header: 'Login Password',
      cell: (member: StaffMember) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded border border-stone-200 text-stone-700">
            {member.password ? member.password : '••••••••'}
          </span>
          <button
            type="button"
            onClick={() => handleCopyCredentials(member)}
            className="p-1 text-stone-400 hover:text-[var(--color-accent)] rounded hover:bg-stone-100 transition-colors"
            title="Copy login credentials"
          >
            {copiedKey === member.id ? (
              <Check size={13} className="text-emerald-600" />
            ) : (
              <Copy size={13} />
            )}
          </button>
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'w-[100px] text-right',
      cell: (member: StaffMember) => {
        const isSelf = profile?.id === member.id
        const isTargetOwner = member.role === 'owner'
        const isTargetAdmin = member.role === 'admin'
        
        // Role hierarchy:
        // Owner can edit/delete anyone except delete owner
        // Admin can edit/delete anyone except owner
        // Manager can only edit/delete manager, staff, and kitchen (cannot touch admin or owner)
        const canEditMember = canManageStaff && (
          profile?.role === 'owner' ||
          (profile?.role === 'admin' && (!isTargetOwner || isSelf)) ||
          (profile?.role === 'manager' && !isTargetOwner && !isTargetAdmin)
        )

        const canDeleteMember = canManageStaff && !isTargetOwner && (
          profile?.role === 'owner' ||
          (profile?.role === 'admin') ||
          (profile?.role === 'manager' && !isTargetAdmin)
        )

        return (
          <div className="flex justify-end items-center gap-1">
            {canEditMember && (
              <button
                onClick={() => openEdit(member)}
                className="p-1.5 text-stone-500 hover:text-[var(--color-accent)] hover:bg-stone-100 rounded-lg transition-colors"
                title="Edit staff & password"
              >
                <Edit2 size={15} />
              </button>
            )}
            <button
              onClick={() => setDeleteStaff(member)}
              disabled={!canDeleteMember}
              className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-stone-300"
              title={
                isTargetOwner
                  ? 'Owner cannot be removed'
                  : !canDeleteMember
                  ? 'Your role does not have permission to remove this staff tier'
                  : 'Remove staff member'
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & Permissions"
        description="Add staff members with direct login credentials. They can immediately sign in and update their password anytime using Forgot Password."
        action={
          canManageStaff ? (
            <button className="btn btn-primary" onClick={openAdd} id="btn-add-staff">
              <Plus size={16} />
              <span>Add Staff</span>
            </button>
          ) : undefined
        }
      />

      <div className="bg-white border border-[var(--color-border)] rounded-2xl shadow-xs overflow-hidden">
        <DataTable
          data={staff}
          columns={columns}
        />
      </div>

      {/* Add / Edit Staff Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editStaff ? 'Edit Staff Member' : 'Add Staff Member'}
        size="sm"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving
                ? 'Saving...'
                : editStaff
                ? 'Save Changes'
                : 'Create Staff Account'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Input
              label="Full Name *"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={<User size={16} className="text-stone-400" />}
              required
            />

            <Input
              label="Login Email Address *"
              type="email"
              placeholder="e.g. rahul@restaurant.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={16} className="text-stone-400" />}
              required
              disabled={!!editStaff}
            />

            {/* Direct Password Input (No invite links!) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-stone-700">
                  {editStaff ? 'Update Login Password' : 'Initial Login Password *'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setPassword(generateRandomPassword())
                    setShowPassword(true)
                  }}
                  className="text-[11px] font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-1"
                >
                  <Sparkles size={11} />
                  <span>Generate</span>
                </button>
              </div>

              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={editStaff ? 'Leave blank to keep unchanged' : 'Enter login password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock size={16} className="text-stone-400" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-stone-400 hover:text-stone-700 p-1"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
                required={!editStaff}
              />
              <p className="text-[10px] text-stone-500">
                Staff can immediately sign in with this password and change it anytime using &quot;Forgot password&quot;.
              </p>
            </div>

            {editStaff && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-stone-700">Account Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full h-10 px-3 text-xs bg-white border border-stone-200 rounded-xl outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="active">Active (Can log in)</option>
                  <option value="inactive">Inactive (Access suspended)</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="label mb-2 block text-xs font-semibold text-stone-700">
              Role & Permissions *
            </label>
            <div className="space-y-1.5">
              {(Object.keys(roleLabels) as StaffRole[])
                .filter((r) => {
                  // Managers cannot assign owner or admin roles
                  if (profile?.role === 'manager' && (r === 'owner' || r === 'admin')) {
                    return false
                  }
                  // Admins cannot create owners
                  if (profile?.role === 'admin' && r === 'owner' && editStaff?.role !== 'owner') {
                    return false
                  }
                  return true
                })
                .map((r) => (
                  <label
                    key={r}
                    className={cn(
                      'flex items-center gap-2.5 p-2.5 border rounded-xl cursor-pointer transition-colors text-xs',
                      role === r
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)]'
                        : 'border-stone-200 hover:bg-stone-50'
                    )}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={role === r}
                      onChange={() => setRole(r)}
                      className="w-3.5 h-3.5 accent-[var(--color-accent)]"
                      disabled={editStaff?.role === 'owner' && r !== 'owner'}
                    />
                    <div>
                      <div className="font-semibold text-stone-900">{roleLabels[r]}</div>
                      <div className="text-[10px] text-stone-500">
                        {r === 'owner' && 'Full system access & owner rights.'}
                        {r === 'admin' && 'Manage menu, billing, tables, staff, and analytics.'}
                        {r === 'manager' && 'Manage orders, billing, and floor tables.'}
                        {r === 'staff' && 'Floor service, take orders, and view tables.'}
                        {r === 'kitchen' && 'Kitchen display screen only (KOT / prep mode).'}
                      </div>
                    </div>
                  </label>
                ))}
            </div>
          </div>
        </form>
      </Drawer>

      {/* Credentials Created Confirmation Modal */}
      {credentialsModalStaff && (
        <Dialog
          open={!!credentialsModalStaff}
          onClose={() => setCredentialsModalStaff(null)}
          title="Staff Account Created ✓"
          description="Login credentials generated for the new team member."
          size="sm"
        >
          <div className="space-y-4 -mt-2">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    {credentialsModalStaff.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900">{credentialsModalStaff.name}</div>
                    <span className={cn('px-2 py-0.2 rounded-full text-[10px] font-bold border', roleColors[credentialsModalStaff.role])}>
                      {roleLabels[credentialsModalStaff.role]}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold uppercase">
                  Active
                </span>
              </div>

              <div className="pt-2 border-t border-emerald-200/80 space-y-1.5 text-xs">
                <div className="flex justify-between items-center py-1 px-2.5 bg-white rounded-lg border border-emerald-200/60 font-mono">
                  <span className="text-stone-500 text-[11px]">Email:</span>
                  <span className="font-bold text-stone-900 select-all">{credentialsModalStaff.email}</span>
                </div>
                <div className="flex justify-between items-center py-1 px-2.5 bg-white rounded-lg border border-emerald-200/60 font-mono">
                  <span className="text-stone-500 text-[11px]">Password:</span>
                  <span className="font-bold text-stone-900 select-all">{credentialsModalStaff.password}</span>
                </div>
                <div className="flex justify-between items-center py-1 px-2.5 bg-white rounded-lg border border-emerald-200/60 font-mono">
                  <span className="text-stone-500 text-[11px]">Login URL:</span>
                  <span className="font-semibold text-stone-700 text-[10px] truncate max-w-[180px]">{window.location.origin}/admin/login</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
              💡 <strong>Direct Access:</strong> Share these credentials with {credentialsModalStaff.name}. They can log in immediately without any invite link and can change their password anytime using <em>&quot;Forgot password&quot;</em>.
            </p>

            <div className="space-y-2 pt-1 border-t border-stone-200">
              <button
                type="button"
                onClick={() => handleCopyCredentials(credentialsModalStaff)}
                className="btn btn-primary w-full h-10 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                {copiedKey === credentialsModalStaff.id ? (
                  <>
                    <Check size={14} />
                    <span>Credentials Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy Login Credentials</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCredentialsModalStaff(null)}
                className="btn btn-secondary w-full h-9 text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Delete Staff Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteStaff}
        onClose={() => setDeleteStaff(null)}
        onConfirm={handleDelete}
        title="Remove Staff Member"
        description={`Are you sure you want to remove ${deleteStaff?.name}? They will immediately lose system access.`}
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  )
}
