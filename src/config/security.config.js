// Security configuration file
// Update these before production deployment

const securityConfig = {
  // Authentication
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production-min-32-chars',
    expiresIn: '24h',
    refreshTokenExpiry: '7d',
    algorithm: 'HS256'
  },

  // Password Policy
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '@$!%*?&',
    expiryDays: 90, // Force password change every 90 days
    historyCount: 5 // Can't reuse last 5 passwords
  },

  // Session Management
  session: {
    timeout: 24 * 60 * 60 * 1000, // 24 hours
    absoluteTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days max
    renewThreshold: 1 * 60 * 60 * 1000, // Renew if less than 1 hour left
    simultaneousSessions: 3 // Max 3 concurrent sessions per user
  },

  // Rate Limiting
  rateLimit: {
    login: {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000 // 15 minutes
    },
    api: {
      maxRequests: 1000,
      windowMs: 15 * 60 * 1000 // 1000 requests per 15 minutes
    },
    imageUpload: {
      maxRequests: 50,
      windowMs: 60 * 60 * 1000 // 50 uploads per hour
    }
  },

  // Data Encryption
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

  // CORS (Cross-Origin Resource Sharing)
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:5173',
      'http://localhost:3000'
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
  },

  // Security Headers
  headers: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  },

  // Audit Logging
  audit: {
    enabled: true,
    logToDatabase: true,
    retentionDays: 365, // Keep logs for 1 year
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

  // File Upload Security
  fileUpload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    scanForMalware: true,
    uploadPath: './uploads/secure',
    quarantinePath: './uploads/quarantine'
  },

  // Database Security
  database: {
    enableSSL: true,
    connectionTimeout: 10000,
    statementTimeout: 30000,
    rowLevelSecurity: true,
    enableAudit: true
  },

  // 2FA (Two-Factor Authentication)
  twoFactor: {
    enabled: true,
    requiredForRoles: ['admin'],
    optionalForRoles: ['officer'],
    method: 'totp', // Time-based One-Time Password
    issuer: 'VigiByte'
  },

  // IP Whitelisting (Optional)
  ipWhitelist: {
    enabled: false, // Set to true to restrict by IP
    adminIPs: [
      // Add admin IP addresses here
    ],
    officerIPs: [
      // Add officer IP ranges here
    ]
  },

  // Backup Security
  backup: {
    enabled: true,
    frequency: 'daily', // daily, weekly, monthly
    encryption: true,
    retentionDays: 30,
    offSiteBackup: true,
    encryptionKeyRotation: 90 // days
  },

  // API Security
  api: {
    requireApiKey: true,
    apiKeyExpiration: 365 * 24 * 60 * 60 * 1000, // 1 year
    validateContentType: true,
    preventParameterPollution: true,
    noSqlInjectionProtection: true
  }
}

// Export based on environment
export default process.env.NODE_ENV === 'production' 
  ? securityConfig 
  : { ...securityConfig, /* relaxed settings for dev */ }
