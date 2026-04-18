// AES-256-GCM symmetric encryption for FBR API keys
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKeyBuffer(): Buffer {
    const keyHex = process.env.CREDENTIALS_ENCRYPTION_KEY
    if (!keyHex || keyHex.length !== 64) {
        throw new Error(
            'CREDENTIALS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32'
        )
    }
    return Buffer.from(keyHex, 'hex')
}

export function encryptCredential(plaintext: string): string {
    const keyBuffer = getKeyBuffer()
    const iv = randomBytes(12) // 96-bit IV for GCM
    const cipher = createCipheriv(ALGORITHM, keyBuffer, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    // Format: iv:authTag:ciphertext (all base64)
    return [
        iv.toString('base64'),
        authTag.toString('base64'),
        encrypted.toString('base64'),
    ].join(':')
}

export function decryptCredential(stored: string): string {
    const keyBuffer = getKeyBuffer()
    const parts = stored.split(':')
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted credential format')
    }

    const [ivB64, tagB64, dataB64] = parts
    const iv = Buffer.from(ivB64, 'base64')
    const authTag = Buffer.from(tagB64, 'base64')
    const data = Buffer.from(dataB64, 'base64')

    const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv)
    decipher.setAuthTag(authTag)

    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
