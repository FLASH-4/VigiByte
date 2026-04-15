/**
 * Organization Management Utilities
 */
import { supabase } from './supabase'

/**
 * Extract domain from email (e.g., "john@company.com" -> "company.com")
 */
export function extractDomainFromEmail(email) {
  const parts = email.split('@')
  return parts.length > 1 ? parts[1].toLowerCase() : null
}

/**
 * Get or create organization by domain
 * Returns organization with id, domain, admin_id
 */
export async function getOrCreateOrganization(domain) {
  try {
    // Try to fetch existing org
    const { data: existing, error: fetchError } = await supabase
      .from('organizations')
      .select('*')
      .eq('domain', domain)
      .single()

    if (existing) {
      return existing
    }

    // Create new organization
    if (fetchError?.code === 'PGRST116') {
      // Not found, create it
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert([{ domain }])
        .select()
        .single()

      if (createError) throw createError
      return newOrg
    }

    throw fetchError
  } catch (err) {
    console.error('Error managing organization:', err)
    throw err
  }
}

/**
 * Check if admin exists for organization
 */
export async function adminExistsForOrg(organizationId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('role', 'admin')
      .single()

    if (error?.code === 'PGRST116') {
      return false // Not found = no admin
    }

    if (error) throw error
    return !!data
  } catch (err) {
    console.error('Error checking admin:', err)
    throw err
  }
}

/**
 * Approve officer for organization (admin only)
 */
export async function approveOfficer(organizationId, userId, approvedBy) {
  try {
    const { error } = await supabase
      .from('approved_officers')
      .insert([
        {
          organization_id: organizationId,
          user_id: userId,
          approved_by: approvedBy
        }
      ])

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error approving officer:', err)
    throw err
  }
}

/**
 * Check if user is approved officer in org (for viewer/officer access)
 */
export async function isUserApprovedInOrg(organizationId, userId, role) {
  // Viewers can access all orgs they join
  if (role === 'viewer') return true

  // Officers need explicit approval
  if (role === 'officer') {
    try {
      const { data, error } = await supabase
        .from('approved_officers')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single()

      if (error?.code === 'PGRST116') return false
      if (error) throw error
      return !!data
    } catch (err) {
      console.error('Error checking officer approval:', err)
      return false
    }
  }

  return false
}
