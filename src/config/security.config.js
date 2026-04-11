/**
 * VIGIBYTE GLOBAL SECURITY CONFIGURATION
 * Purpose: Centralized security policy for the surveillance analytics platform.
 * This file governs authentication, data encryption, network protection, and audit protocols.
 * * NOTE: Ensure environment variables (process.env) are configured in the production environment.
 */

const securityConfig = {
  // --- AUTHENTICATION (JWT) ---
  // Controls the issuance and validation of JSON Web Tokens for user sessions.
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production-min-32-chars', // Signing key
    expiresIn: '24h',           // Access token lifespan
    refreshTokenExpiry: '7d',   // Duration before user must re-authenticate
    algorithm: 'HS256'          // Symmetric signing algorithm
  },

  // --- PASSWORD COMPLIANCE POLICY ---
  // Enforces industry-standard complexity to prevent credential-based attacks.
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '@$!%*?&',
    expiryDays: 90,             // Rotation policy to mitigate stale credential risk
    historyCount: 5             // Prevents cycling through recent passwords
  },

  // --- SESSION LIFECYCLE MANAGEMENT ---
  // Manages the state and duration of active user connections.
  session: {
    timeout: 24 * 60 * 60 * 1000,             // Sliding window timeout (24h)
    absoluteTimeout: 7 * 24 * 60 * 60 * 1000,  // Maximum session duration (7 days)
    renewThreshold: 1 * 60 * 60 * 1000,        // Automatic renewal if < 1 hour remains
    simultaneousSessions: 3                   // Restriction on concurrent logins per user
  },

  // --- BRUTE FORCE & DOS PROTECTION ---
  // Limits request frequency to prevent automated attacks on sensitive endpoints.
  rateLimit: {
    login: {
      maxAttempts: 5,           // Threshold for account lockout or cooldown
      windowMs: 15 * 60 * 1000  // 15-minute cooldown period
    },
    api: {
      maxRequests: 1000,
      windowMs: 15 * 60 * 1000  // General API traffic throttling
    },
    imageUpload: {
      maxRequests: 50,
      windowMs: 60 * 60 * 1000  // Throttling for resource-heavy upload operations
    }
  },

  // --- DATA AT REST ENCRYPTION ---
  // Standard AES-256-GCM encryption for sensitive database fields.
  encryption: {
    algorithm: 'aes-256-gcm',
    key: process.env.ENCRYPTION_KEY || 'change-me-32-character-key-here',
    fieldsToEncrypt: [
      'name',
      'crime_details',
      'personal_info',
      'notes'
    ]
  },

  // --- NETWORK ACCESS CONTROL (CORS) ---
  // Restricts cross-origin requests to trusted domains only.
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:5173',
      'http://localhost:3000'
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,          // Allows cookies/auth headers to be sent
    maxAge: 86400               // Cache duration for pre-flight requests (24h)
  },

  // --- HTTP SECURITY HEADERS ---
  // Enforces browser-level security policies like HSTS and CSP.
  headers: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload', // Enforce HTTPS
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'X-Content-Type-Options': 'nosniff',      // Prevents MIME-sniffing
    'X-Frame-Options': 'DENY',                // Clickjacking protection
    'X-XSS-Protection': '1; mode=block',      // Anti-cross-site scripting
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  },

  // --- SYSTEM AUDIT TRAIL ---
  // Logs critical system events for forensic analysis and compliance.
  audit: {
    enabled: true,
    logToDatabase: true,
    retentionDays: 365,         // Compliance-based log storage duration (1 year)
    events: [
      'login',
      'logout',
      'view_record',
      'create_record',
      'update_record',
      'delete_record',
      'export_data',
      'failed_auth',
      'role_change',
      'permission_denied'
    ]
  },

  // --- FILE UPLOAD SECURITY ---
  // Validates file integrity and type to prevent malicious payload execution.
  fileUpload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB limit
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    scanForMalware: true,         // Enable integration with scanning services
    uploadPath: './uploads/secure',
    quarantinePath: './uploads/quarantine'
  },

  // --- DATABASE SECURITY ---
  // Ensures encrypted and restricted data access at the storage layer.
  database: {
    enableSSL: true,              // Required for cloud databases like Supabase
    connectionTimeout: 10000,
    statementTimeout: 30000,
    rowLevelSecurity: true,       // Enforces RBAC at the DB level
    enableAudit: true
  },

  // --- MULTI-FACTOR AUTHENTICATION (MFA) ---
  // Adds a secondary layer of verification for privileged accounts.
  twoFactor: {
    enabled: true,
    requiredForRoles: ['admin'],  // Mandatory for high-access users
    optionalForRoles: ['officer'],
    method: 'totp',               // Time-based One-Time Password (e.g., Google Authenticator)
    issuer: 'VigiByte'
  },

  // --- NETWORK WHITELISTING ---
  // Optional IP-based restriction for command center access.
  ipWhitelist: {
    enabled: false,               // Global switch for IP filtering
    adminIPs: [],                 // Authorized administrative IPs
    officerIPs: []                // Authorized operational IP ranges
  },

  // --- BACKUP & DISASTER RECOVERY SECURITY ---
  // Manages the security of encrypted system backups.
  backup: {
    enabled: true,
    frequency: 'daily',
    encryption: true,
    retentionDays: 30,
    offSiteBackup: true,
    encryptionKeyRotation: 90     // Key rotation policy for backup archives (days)
  },

  // --- API HARDENING ---
  // Enforces data integrity and prevents common injection attacks.
  api: {
    requireApiKey: true,
    apiKeyExpiration: 365 * 24 * 60 * 60 * 1000,
    validateContentType: true,
    preventParameterPollution: true,
    noSqlInjectionProtection: true
  }
}

/**
 * ENVIRONMENT-BASED EXPORT
 * Automatically relaxes security settings in development mode for easier debugging.
 */
export default process.env.NODE_ENV === 'production' 
  ? securityConfig 
  : { ...securityConfig, /* Relaxed settings for dev can be added here */ }