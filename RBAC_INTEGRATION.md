# Role-Based Access Control (RBAC) Integration Guide

## 🎯 Overview

The VigiByte application now has a complete **authentication and role-based access control** system integrated into the app workflow. Users must log in, and the app enforces different permissions based on their role.

## 🔐 Three Roles Implemented

### 1. **🔑 ADMIN** (First registered user)
- **Permissions**: Create, Read, Update, Delete, Manage Users
- **Features Available**:
  - ✅ Add new camera nodes (`+ Add New Node` button)
  - ✅ Delete camera nodes (X button on hover)
  - ✅ View threat history
  - ✅ Access criminal database (full CRUD operations)
  - ✅ Upload/merge CSV criminal records
  - ✅ Delete criminal records

### 2. **👮 OFFICER** (2nd+ registered users)
- **Permissions**: Create, Read, Update
- **Features Available**:
  - ❌ Cannot add camera nodes (button hidden)
  - ❌ Cannot delete camera nodes
  - ✅ View threat history
  - ✅ Access criminal database
  - ✅ Add new criminal records
  - ✅ Update criminal records
  - ❌ Cannot delete criminal records
  - ✅ Download/export criminal records

### 3. **👁️ VIEWER** (Future role)
- **Permissions**: Read-only
- **Features Available**:
  - ❌ Cannot add/delete cameras
  - ✅ View threat history (read-only)
  - ✅ View criminal database (read-only)
  - ✅ Download/export records
  - ❌ Cannot add/edit/delete criminal records
  - ❌ No bulk import/merge access

---

## 🛠️ Technical Implementation

### 1. **Browser-Compatible Authentication** (`src/services/browserAuth.js`)

Created a browser-friendly authentication system since Node.js JWT doesn't work in the browser:

```javascript
// Key Functions:
- generateToken(userId, email, role) // Creates simple JWT-like token
- verifyToken(token) // Validates token expiry
- hashPassword(password) // Browser SHA-256 hashing (demo)
- hasPermission(role, action) // Checks RBAC rules
- SessionManager // 24-hour session management
- AuditLogger // Tracks all actions
- loginLimiter // Rate limiting (5 attempts/15min)
```

**Note**: For production, move hashing/validation to backend for true security.

### 2. **Authentication Flow** (`src/App.jsx`)

```javascript
// App.jsx Integration:
1. Page loads → Check localStorage for valid token
2. If no valid token → Show AuthPanel (login/register)
3. User registers → First user = admin, rest = officer
4. On login → Generate token, store in localStorage
5. Pass user + onLogout props to Dashboard
6. On logout → Clear storage, return to AuthPanel
```

### 3. **Role-Based UI Control** (`src/components/Dashboard.jsx`)

```javascript
// Header Section:
- Shows user email + role emoji + profile avatar
- Logout button
- "+ Add New Node" button only for admins

// Camera Grid:
- Delete(X) buttons only shown for admins on hover
- Officers see cameras but can't delete

// Database Tab:
- Viewers see "View-only Access" message
- Officers/Admins see full database interface
- DATABASE tab hidden for viewers
```

### 4. **Database Access Control** (`src/components/CriminalDB.jsx`)

```javascript
// Restrictions by Role:
- Viewers: Can only view/download (no add/delete)
- Officers: Can add/edit/download (no delete)
- Admins: Full CRUD access

// UI Changes:
- "+ New Entry" button hidden for viewers
- Bulk import/merge hidden for viewers
- Delete buttons hidden for viewers
- Bulk import hidden for officers
```

---

## 📊 User Flow Diagram

```
┌─────────────────────────┐
│   Application Start     │
└────────────┬────────────┘
             │
             ▼
    ┌────────────────────┐
    │ Check localStorage │
    │   for JWT token    │
    └────────┬───────────┘
             │
      ┌──────┴──────┐
      │             │
   Token         Token
   Valid?        Invalid
      │             │
      ▼             ▼
  ┌────────┐  ┌──────────────┐
  │         │  │ Show AuthPanel │
  │         │  │ (Login/Register)
  │ Continue │  └────────┬────────┘
  │    to    │           │
  │ Dashboard│      ┌────┴──────┐
  │         │      │             │
  └────────┘      New      Existing
             │   Submit   │   User
             │   Form     │   Login
             ▼             ▼
        ┌────────────────────────┐
        │ Generate Token &        │
        │ Store in localStorage  │
        └────────┬───────────────┘
                 │
                 ▼
        ┌────────────────────────┐
        │ Pass user + onLogout   │
        │ to Dashboard Component │
        └────────┬───────────────┘
                 │
            ┌────┴────┐
            │          │
         Admin       Officer       Viewer
            │          │             │
            ▼          ▼             ▼
         Full      Limited       Read-Only
        Access      Access       Access
```

---

## 🔐 Password Requirements

- **Minimum Length**: 8 characters
- **Must Contain**:
  - At least 1 uppercase letter (A-Z)
  - At least 1 lowercase letter (a-z)
  - At least 1 number (0-9)
  - At least 1 special character (@$!%*?&)

**Example Valid Passwords**:
- `Admin@12345`
- `Officer@Secure99!`
- `Viewer$SecurePass123`

---

## 📝 Testing the System

### Test Case 1: Admin Features
```
1. Register: admin@vigibyte.com / Admin@12345
   → First user becomes ADMIN
   
2. Verify:
   ✅ "+ Add New Node" button visible
   ✅ Camera delete (X) buttons visible on hover
   ✅ Criminal database fully accessible
   ✅ Can delete criminal records
```

### Test Case 2: Officer Restrictions
```
1. Register: officer@vigibyte.com / Officer@12345
   → Automatically assigned OFFICER role
   
2. Verify:
   ❌ "+ Add New Node" button NOT visible
   ❌ Camera delete (X) buttons NOT visible
   ✅ Criminal database accessible
   ✅ Can add new criminal records
   ❌ Cannot delete records
```

### Test Case 3: Token Expiry
```
1. Login as any user
2. Token stored in localStorage with 24hr expiry
3. Close browser & wait past expiry
4. Reopen app → Should return to login screen
5. Can log back in (new token generated)
```

---

## 🔒 Security Notes

### Current Implementation (Demo)
- ✅ Password hashing using browser SHA-256
- ✅ JWT-like tokens with 24-hour expiry
- ✅ Session management
- ✅ Rate limiting (5 login attempts/15 min)
- ✅ Role-based access control
- ✅ Audit logging framework

### Production Considerations
- ⚠️ Move password hashing to backend (bcrypt is Node.js only)
- ⚠️ Use real cryptographic JWT signing (HS256/RS256)
- ⚠️ Implement HTTPS/TLS for all connections
- ⚠️ Use secure HTTP-only cookies for tokens (not localStorage)
- ⚠️ Implement CSRF protection
- ⚠️ Add 2FA for sensitive operations
- ⚠️ Backend API should verify permissions on every request

---

## 📂 File Changes

### New Files Created
- `src/services/browserAuth.js` - Browser-compatible auth system
- `src/components/AuthPanel.jsx` - Login/register UI

### Modified Files
- `src/App.jsx` - Authentication gate + user management
- `src/components/Dashboard.jsx` - Role-based UI + user profile header
- `src/components/CriminalDB.jsx` - Role-based database access

---

## 🎯 Next Steps

### For Development
1. **Backend Integration**: Move auth to Node.js backend
2. **Database Persistence**: Store users in Supabase `users` table
3. **Session Management**: Use real database-backed sessions
4. **2FA**: Add Google Authenticator support
5. **Audit Dashboard**: Create admin panel to view audit logs

### For Security Hardening
1. Implement HTTPS enforcement
2. Add CORS security headers
3. Rate limit API endpoints
4. Add IP-based restrictions for admin features
5. Implement data encryption at rest

---

## 🆘 Troubleshooting

### Issue: "Too many login attempts" error
**Solution**: Rate limiter active (5 attempts/15 min). Wait 15 minutes or restart browser.

### Issue: Token not persisting across page reload
**Solution**: Check browser localStorage settings. Make sure JavaScript can access localStorage.

### Issue: User logs out but sees old data
**Solution**: Clear browser cache and localStorage manually. Press Ctrl+Shift+Delete.

### Issue: Password fails validation
**Solution**: Ensure password has: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.

---

## 📞 Support

The authentication system is now fully integrated with:
- ✅ Login/Registration UI
- ✅ Token-based session management
- ✅ Role-based feature access
- ✅ Browser-compatible crypto
- ✅ Rate limiting
- ✅ User profile display
- ✅ Logout functionality

For issues or questions, check the browser console for error messages or review `src/services/browserAuth.js` for the security logic.
