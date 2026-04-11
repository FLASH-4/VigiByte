/**
 * ⚠️  NOTE: This file is a legacy server-side utility.
 * It uses Node.js-only packages (jsonwebtoken, bcryptjs) that do NOT work in the browser.
 * 
 * For browser authentication, use: src/services/browserAuth.js
 * which uses Web Crypto API (PBKDF2 + HMAC) — browser-compatible and free.
 * 
 * This file is kept only for reference if a backend is added in the future.
 */

// Role-based access control (browser-safe, no Node.js deps)
const ROLES = {
  ADMIN: 'admin',
  OFFICER: 'officer',
  VIEWER: 'viewer'
}

const PERMISSIONS = {
  admin: ['create', 'read', 'update', 'delete', 'manage_users'],
  officer: ['create', 'read', 'update'],
  viewer: ['read']
}

export function hasPermission(role, action) {
  return PERMISSIONS[role]?.includes(action) || false
}

export { ROLES, PERMISSIONS }