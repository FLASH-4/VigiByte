# 🔍 VigiByte Security Verification Guide

## How to Check Your Security

---

## ✅ 1. Run Built-in Tests

### Quick Test (takes 2 minutes):
```bash
# Run security test suite
node src/utils/securityTests.js
```

**What it checks:**
- ✅ JWT token generation & verification
- ✅ Password hashing strength
- ✅ Role-based access control
- ✅ Rate limiting functionality
- ✅ Session security
- ✅ Input validation
- ✅ Security headers
- ✅ Encryption setup

**Expected Output:**
```
🎉 ALL SECURITY TESTS PASSED! System is secure.
Success Rate: 100%
```

---

## 🧪 2. Manual Security Testing

### A. Test Authentication

**Login Test:**
```bash
1. Open http://localhost:5173
2. Click on login
3. Try these:
   ✅ Valid: officer@test.com / SecureP@ss1!
   ❌ Invalid: admin@test.com / wrongpassword
   ❌ Invalid: plaintext123
4. Success = "Login successful" message
```

**Password Strength Test:**
```
Try these passwords:
❌ "password" → REJECTED (no special char)
❌ "Pass123" → REJECTED (too short)
✅ "Secure@Pass123" → ACCEPTED
```

### B. Test Role-Based Access Control
```javascript
// Open browser DevTools (F12) → Console

// Get current user
console.log(localStorage.getItem('user_token'))

// Try actions:
// Admin: create, read, update, delete ✅
// Officer: create, read, update (no delete) ⚠️
// Viewer: read only (no create/update) 🔒
```

### C. Test Rate Limiting
```bash
# Try logging in 6 times in 15 minutes
1. Login attempt 1-5: SUCCESS
2. Login attempt 6: BLOCKED "Too many attempts"
3. Wait 15 minutes, try again: SUCCESS
```

---

## 🔧 3. Use Online Security Scanning Tools

### OWASP ZAP (Free Penetration Testing)
```bash
# Install
brew install owasp-zap  # Mac
# or download from https://www.zaproxy.org

# Run scan
zaproxy -cmd -quickurl http://localhost:5173 -quickout report.html
```

### npm audit (Vulnerability Scanning)
```bash
# Check for vulnerable packages
npm audit

# Fix automatically
npm audit fix
```

### Snyk (Continuous Vulnerability Monitoring)
```bash
# Install Snyk
npm install -g snyk

# Test project
snyk test

# Monitor for future vulnerabilities
snyk monitor
```

### SSL Labs (HTTPS/TLS Testing)
```
1. Go to https://www.ssllabs.com
2. Enter your domain
3. Wait for scan
4. Check grade (should be A or A+)
```

---

## 📊 4. Check Audit Logs

### View Access Logs:
```javascript
// In browser console
// Access audit logs
fetch('/api/audit-logs')
  .then(r => r.json())
  .then(logs => console.table(logs))

// Look for:
// ✅ All logins recorded
// ✅ All data access logged
// ✅ Failed attempts blocked
// ❌ No unusual activity
```

### Check Log Details:
```json
{
  "timestamp": "2026-04-09T10:30:00Z",
  "userId": "officer_123",
  "action": "view_criminal_record",
  "resource": "criminal_456",
  "result": "success",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

---

## 🔐 5. Database Security Verification

### Check Supabase Row-Level Security:
```bash
# Login to Supabase Dashboard
# Go to SQL Editor, run:

-- Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'criminals';

-- Should show: rowsecurity = true (✅)
```

### Test RLS Policy:
```bash
# As Officer 1:
SELECT * FROM criminals 
WHERE officer_id = auth.uid();
-- Shows only their records ✅

# Try to access another officer's records:
SELECT * FROM criminals 
WHERE officer_id = '999';
-- Access denied ❌
```

---

## 🌐 6. HTTPS/TLS Verification

### Test Certificate:
```bash
# Check SSL certificate
openssl s_client -connect yourdomain.com:443

# Look for:
# ✅ Verify return code: 0 (ok)
# ✅ Subject: CN = yourdomain.com
# ✅ Not Before/After (valid dates)
```

### Browser Check:
```
1. Visit https://yourdomain.com
2. Click padlock icon 🔒
3. Check "Certificate is valid"
4. Check "Issued by: Let's Encrypt"
```

---

## 🛡️ 7. Encryption Verification

### Test Data Encryption:
```bash
# Check encrypted fields in database
SELECT 
  name_encrypted,
  crime_encrypted 
FROM criminals_encrypted 
LIMIT 1;

# Output should be random bytes like:
# \x6f3e9f2c8a1b...
# ✅ Data is encrypted (not readable)
```

### Test Decryption Access:
```bash
# Try decrypting without key (should fail):
SELECT pgp_sym_decrypt(name_encrypted, 'wrong_key')
FROM criminals_encrypted;
-- ERROR: decryption failed ❌

# Try with correct key (should succeed):
SELECT pgp_sym_decrypt(name_encrypted, 'correct_key')
FROM criminals_encrypted;
-- Returns: John Doe ✅
```

---

## 📋 8. Security Headers Verification

### Check Headers in Browser:
```javascript
// Open DevTools (F12) → Network tab
// Click any request
// Look for headers:

Strict-Transport-Security: max-age=31536000 ✅
Content-Security-Policy: default-src 'self' ✅
X-Frame-Options: DENY ✅
X-Content-Type-Options: nosniff ✅
X-XSS-Protection: 1; mode=block ✅
```

### Command Line Check:
```bash
curl -I https://yourdomain.com | grep -i 'strict\|csp\|frame\|content-type\|xss'

# Should output all security headers
```

---

## 🚨 9. Common Security Issues Checklist

| Issue | Check | Status |
|-------|-------|--------|
| **Plaintext passwords** | `grep -r "password:" src/` | ❌ Should be empty |
| **Hard-coded secrets** | `grep -r "SECRET\|KEY\|TOKEN" src/` | ❌ Should be in .env |
| **Console.log sensitive data** | Check DevTools → Console | ❌ Should show nothing |
| **Unsafe dependencies** | `npm audit` | ✅ Should show 0 vulnerabilities |
| **Unencrypted data** | Check database | ✅ Sensitive fields encrypted |
| **Missing HTTPS** | Check URL bar | ✅ Should show 🔒 |
| **Session timing out** | Wait 24 hours | ✅ Should auto-logout |
| **Rate limiting working** | Spam login 6 times | ✅ Should block after 5 |

---

## 🎯 10. Automated Security Scanning

### GitHub Actions (Free CI/CD):
Create `.github/workflows/security.yml`:
```yaml
name: Security Scan

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: npm audit
        run: npm audit
      
      - name: Run security tests
        run: node src/utils/securityTests.js
      
      - name: Snyk scan
        run: |
          npm install -g snyk
          snyk test
```

---

## 📈 11. Security Monitoring Dashboard

### Setup Real-Time Alerts:
```javascript
// Create monitoring dashboard at /admin/security

const securityMetrics = {
  failedLogins: 0,
  blockedRequests: 0,
  unusualActivity: 0,
  latestAuditLog: null
}

// Alert if:
// 🔴 >10 failed logins in 1 hour → Notify admin
// 🔴 >100 requests from single IP → Block IP
// 🔴 Data access spike → Investigate
```

---

## 🏆 12. Security Score Calculation

**Calculate Your Security Score:**
```
JWT Tokens:           ✅ 20 points
Password Security:    ✅ 20 points
Encryption:           ✅ 20 points
Access Control:       ✅ 15 points
Audit Logging:        ✅ 10 points
Rate Limiting:        ✅ 10 points
HTTPS/TLS:            ✅ 5 points
────────────────────────────────
TOTAL:                ✅ 100/100
```

**Security Grade:**
- 90-100: 🟢 EXCELLENT
- 70-89:  🟡 GOOD
- 50-69:  🟠 FAIR
- <50:    🔴 WEAK

---

## 📞 13. When to Get Help

### Contact Security Expert If:
- [ ] Failed security tests
- [ ] Vulnerabilities in npm audit
- [ ] Suspicious activity in audit logs
- [ ] Certificate expired (fix immediately!)
- [ ] Breach suspected
- [ ] Unusual database access patterns
- [ ] Performance degradation (DDoS?)

---

## 🔄 14. Regular Security Maintenance

### Weekly Task (15 min):
```bash
# Review audit logs
tail -f logs/audit.log

# Check failed login attempts
grep "failed_login" logs/audit.log | wc -l
```

### Monthly Task (1 hour):
```bash
# Update dependencies
npm update
npm audit fix

# Run full security tests
npm test -- security

# Review user permissions
# Delete inactive users
```

### Quarterly Task (2 hours):
```bash
# Full penetration test
zaproxy -cmd -quickurl https://yourdomain.com

# Review security policies
# Update password requirements
# Backup encryption keys
```

---

## ✅ Pre-Production Checklist

Before going live:
- [ ] All security tests PASS
- [ ] npm audit shows 0 vulnerabilities
- [ ] HTTPS certificate installed
- [ ] Database RLS policies enabled
- [ ] Encryption keys generated & stored safely
- [ ] Audit logging enabled
- [ ] Rate limiting configured
- [ ] Backup plan tested
- [ ] Disaster recovery plan ready
- [ ] Security documentation updated
- [ ] Team trained on security practices
- [ ] Incident response plan created

---

**Run this command to generate security report:**
```bash
npm run security:report
```

**Remember: Security is a journey, not a destination! 🔐**
