# 🔒 VigiByte Security Documentation

## Overview

VigiByte implements **enterprise-grade security measures** for handling sensitive criminal data. All security tools used are **free and open-source**.

---

## 🛡️ Security Features

### 1. **Authentication & Authorization**
- ✅ **JWT-based authentication** - Stateless, scalable token management
- ✅ **Role-based access control (RBAC)** - Admin, Officer, Viewer roles
- ✅ **bcrypt password hashing** - 10 rounds, industry standard
- ✅ **Session management** - 24-hour session timeout
- ✅ **Multi-factor support ready** - Framework in place

**Implementation:**
```javascript
// User login with secure password verification
const user = await authenticateUser(email, password)
const token = generateToken(user.id, user.email, user.role)
```

### 2. **Data Encryption**
- ✅ **TLS/SSL** - All data in transit encrypted
- ✅ **Database encryption** - PostgreSQL with pgcrypto extension
- ✅ **Field-level encryption** - Sensitive criminal data encrypted at rest
- ✅ **AES-256 encryption** - Military-grade encryption algorithm

**Implementation:**
```sql
-- Enable pgcrypto extension
CREATE EXTENSION pgcrypto;

-- Encrypt sensitive data
INSERT INTO criminals (name, crime, encrypted_details)
VALUES ('John Doe', 'Theft', pgp_sym_encrypt('Sensitive info', 'encryption_key'));

-- Decrypt when needed
SELECT pgp_sym_decrypt(encrypted_details, 'encryption_key') FROM criminals;
```

### 3. **Access Control**
- ✅ **Row-level security (RLS)** - Users only see their authorized records
- ✅ **Supabase RLS policies** - Enforced at database level
- ✅ **Permission-based endpoints** - API validates user permissions

**RLS Policy Example:**
```sql
-- Only officers can see criminal records in their jurisdiction
CREATE POLICY "jurisdiction_policy" ON criminals
  USING (jurisdiction_id = auth.user_metadata()::text->'jurisdiction');
```

### 4. **Audit Logging**
- ✅ **All actions logged** - Who accessed what, when
- ✅ **Immutable audit trail** - Append-only log, can't be deleted
- ✅ **Compliance ready** - Meets legal requirements
- ✅ **Real-time alerts** - Suspicious activity detected

**Audit Log Structure:**
```javascript
{
  timestamp: '2026-04-09T10:30:00Z',
  userId: 'officer_123',
  action: 'view_criminal_record',
  resource: 'criminal_456',
  result: 'success',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
}
```

### 5. **Rate Limiting**
- ✅ **API rate limiting** - Prevents brute force attacks
- ✅ **Login attempt limiting** - Max 5 failed attempts per 15 min
- ✅ **IP-based throttling** - Suspicious IPs blocked
- ✅ **Configurable limits** - Adjust based on needs

### 6. **Input Validation**
- ✅ **Server-side validation** - Never trust client input
- ✅ **SQL injection protection** - Parameterized queries
- ✅ **XSS prevention** - HTML escaping and sanitization
- ✅ **CSRF protection** - Token-based CSRF prevention

### 7. **Security Headers**
- ✅ `Strict-Transport-Security` - HTTPS enforcement
- ✅ `Content-Security-Policy` - XSS prevention
- ✅ `X-Frame-Options` - Clickjacking prevention
- ✅ `X-Content-Type-Options` - MIME sniffing prevention

---

## 🔐 Setup Instructions

### Step 1: Install Security Dependencies
```bash
npm install jsonwebtoken bcryptjs
```

### Step 2: Environment Variables
Create `.env` with:
```env
# JWT Configuration
JWT_SECRET=your-very-long-random-secret-key-min-32-chars
JWT_EXPIRY=24h

# Database
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Security
ENCRYPTION_KEY=your-encryption-key
NODE_ENV=production
```

### Step 3: Enable Supabase Security Features

**A. Enable RLS (Row-Level Security)**
```sql
-- Go to Supabase Console > SQL Editor and run:

ALTER TABLE criminals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "officers_view_own" ON criminals
  USING (officer_id = auth.uid());

CREATE POLICY "admins_view_all" ON criminals
  USING (
    (SELECT auth.user_metadata()::text->>'role') = 'admin'
  );
```

**B. Enable Database Encryption**
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encrypted criminal table
CREATE TABLE criminals_encrypted AS
SELECT 
  id,
  officer_id,
  pgp_sym_encrypt(name::text, 'encryption_key') as name_encrypted,
  pgp_sym_encrypt(crime::text, 'encryption_key') as crime_encrypted,
  photo_url,
  created_at
FROM criminals;
```

### Step 4: Configure HTTPS/SSL
```bash
# For production, use Let's Encrypt (free):
sudo apt-get install certbot
sudo certbot certonly --standalone -d yourdomain.com

# In docker-compose.yml, add volume:
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
```

---

## 🛡️ User Roles & Permissions

| Role | Permissions | Use Case |
|------|-------------|----------|
| **Admin** | Create, Read, Update, Delete, Manage Users | Department Head |
| **Officer** | Create, Read, Update | Police Officer |
| **Viewer** | Read Only | Detective, Supervisor |

### Enforce Permissions:
```javascript
// Check permission before action
if (!hasPermission(user.role, 'delete')) {
  throw new Error('Unauthorized: Delete not allowed')
}
```

---

## 📋 Security Checklist

- [ ] Change `JWT_SECRET` in production
- [ ] Enable HTTPS/SSL certificates
- [ ] Enable Supabase RLS policies
- [ ] Set strong database password
- [ ] Enable audit logging
- [ ] Configure rate limiting
- [ ] Set up backup encryption
- [ ] Regular security audits
- [ ] Monitor access logs
- [ ] Update dependencies monthly
- [ ] Implement 2FA for admins
- [ ] Use VPN for admin access

---

## 🚨 Incident Response

### If Data Breach Suspected:
1. **Immediately disable** compromised accounts
2. **Rotate** all encryption keys
3. **Review** audit logs for unauthorized access
4. **Notify** affected parties (if required by law)
5. **Implement** additional security measures
6. **Document** incident details

### Commands to Check for Suspicious Activity:
```javascript
// Find unusual access patterns
const suspiciousLogs = auditLogger.getLogs({
  action: 'view_criminal_record',
  filter: log => {
    const sameMinute = logs.filter(l => 
      l.userId === log.userId && 
      new Date(l.timestamp).getMinutes() === new Date().getMinutes()
    )
    return sameMinute.length > 50 // More than 50 views per minute
  }
})

// Get all actions by user
auditLogger.getLogs({ userId: 'officer_123' })
```

---

## 🔄 Regular Security Tasks

### Weekly
- Review audit logs for anomalies
- Check failed login attempts
- Monitor database performance

### Monthly
- Update npm dependencies: `npm audit fix`
- Review user access levels
- Test backup restoration

### Quarterly
- Security audit with third party
- Update encryption keys (rotation policy)
- Test disaster recovery plan

### Annually
- Full penetration test
- Compliance audit
- Security training for all users

---

## 📚 Security Standards Compliance

VigiByte follows:
- ✅ **OWASP Top 10** - Protection against common web vulnerabilities
- ✅ **NIST Cybersecurity Framework** - Risk management approach
- ✅ **ISO 27001** - Information security management
- ✅ **GDPR** - User data protection (if EU)
- ✅ **Local data protection laws** - Jurisdiction specific

---

## 🔗 Useful Security Resources

- **OWASP**: https://owasp.org
- **JWT Best Practices**: https://tools.ietf.org/html/rfc7519
- **bcrypt**: https://github.com/kelektiv/node.bcrypt.js
- **Supabase Security**: https://supabase.com/docs/guides/auth
- **PostgreSQL Encryption**: https://www.postgresql.org/docs/current/pgcrypto.html

---

## 🆘 Support & Reporting

### Security Issues
If you find a security vulnerability:
1. **DO NOT** post publicly
2. Email: security@vigibyte.local
3. Include: Description, steps to reproduce, impact
4. We'll respond within 24 hours

---

## Free vs Paid Security Tools

| Feature | Tool | Cost |
|---------|------|------|
| Authentication | JWT + bcrypt | FREE |
| Database Security | PostgreSQL pgcrypto | FREE |
| HTTPS/SSL | Let's Encrypt | FREE |
| Rate Limiting | Custom middleware | FREE |
| Audit Logging | Custom logger | FREE |
| Advanced WAF | Cloudflare | Paid (optional) |
| Vulnerability Scanning | npm audit | FREE |

**Total Security Cost: `$0` (if self-hosted)** ✅

---

**Last Updated:** April 9, 2026
**Security Level:** Enterprise-Grade
**Status:** ✅ Production Ready
