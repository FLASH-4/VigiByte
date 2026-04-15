/**
 * TOTP (Time-based One-Time Password) Implementation
 * For 2FA security using HMAC-SHA1
 */

/**
 * Generate a random TOTP secret (base32 encoded)
 * Used for setting up Google Authenticator, Microsoft Authenticator, etc.
 */
export function generateTOTPSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let secret = ''
  for (let i = 0; i < 32; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)]
  }
  return secret
}

/**
 * Convert base32 secret to Uint8Array for HMAC operations
 */
function base32Decode(secret) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (let i = 0; i < secret.length; i++) {
    const val = chars.indexOf(secret[i])
    if (val === -1) throw new Error('Invalid base32 character')
    bits += val.toString(2).padStart(5, '0')
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8))
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substr(i * 8, 8), 2)
  }
  return bytes
}

/**
 * Verify a TOTP code against the secret
 * Allows 30-second window before/after for clock skew
 */
export async function verifyTOTP(secret, token, window = 1) {
  try {
    const key = base32Decode(secret)
    const now = Math.floor(Date.now() / 1000)

    // Check current time and ±window timeslots
    for (let i = -window; i <= window; i++) {
      let time = Math.floor((now + i * 30) / 30)
      const timeBytes = new Uint8Array(8)

      // Convert time to big-endian bytes
      for (let j = 7; j >= 0; j--) {
        timeBytes[j] = time & 0xff
        time = time >> 8
      }

      // Calculate HMAC-SHA1
      const hmacKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      )

      const signature = await crypto.subtle.sign('HMAC', hmacKey, timeBytes)
      const signatureArray = new Uint8Array(signature)

      // Extract 4-byte code from signature
      const offset = signatureArray[19] & 0x0f
      const code = (
        ((signatureArray[offset] & 0x7f) << 24) |
        ((signatureArray[offset + 1] & 0xff) << 16) |
        ((signatureArray[offset + 2] & 0xff) << 8) |
        (signatureArray[offset + 3] & 0xff)
      ) % 1000000

      const codeStr = code.toString().padStart(6, '0')
      if (codeStr === token.toString().padStart(6, '0')) {
        return true
      }
    }
    return false
  } catch (err) {
    console.error('TOTP verification failed:', err)
    return false
  }
}

/**
 * Generate Google Authenticator QR code URL
 * User can scan this with Google Authenticator, Authy, Microsoft Authenticator, etc.
 */
export function generateQRCodeURL(secret, email, appName = 'VigiByte') {
  const label = encodeURIComponent(`${appName} (${email})`)
  const secretParam = encodeURIComponent(secret)
  return `otpauth://totp/${label}?secret=${secretParam}&issuer=${encodeURIComponent(appName)}`
}
