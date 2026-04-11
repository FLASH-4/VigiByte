/**
 * SECURITY REFERENCE UTILITY (LEGACY)
 * * ⚠️ ARCHITECTURAL NOTE:
 * This file serves as a blueprint for server-side security logic. It originally 
 * depended on Node.js modules (jsonwebtoken, bcryptjs) which are incompatible 
 * with client-side environments.
 * * For active browser-based security, VigiByte utilizes: src/services/browserAuth.js
 * (Powered by Web Crypto API: PBKDF2 for hashing and HMAC for signing).
 * * This module is maintained purely for future scalability should the project 
 * migrate to a dedicated Node.js backend.
 */

/**
 * SYSTEM TIERS (RBAC)
 * Defines the standard user hierarchy within the VigiByte ecosystem.
 */
const ROLES = {
  ADMIN: 'admin',     // Full system control
  OFFICER: 'officer', // Operational access
  VIEWER: 'viewer'    // Audit-only access
}

/**
 * PERMISSION MATRIX
 * Maps specific system actions to authorized roles.
 * Governs UI visibility and data manipulation capabilities.
 */
const PERMISSIONS = {
  admin: ['create', 'read', 'update', 'delete', 'manage_users'],
  officer: ['create', 'read', 'update'],
  viewer: ['read']
}

/**
 * AUTHORIZATION GUARD
 * Validates if a specific role is permitted to perform a requested action.
 * @param {string} role - The current user's assigned role.
 * @param {string} action - The requested operation (e.g., 'delete').
 * @returns {boolean} - Returns true if access is granted.
 */
export function hasPermission(role, action) {
  return PERMISSIONS[role]?.includes(action) || false
}

export { ROLES, PERMISSIONS }