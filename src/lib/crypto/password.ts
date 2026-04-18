import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2'

export async function hash(password: string): Promise<string> {
    return argon2Hash(password, {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
    })
}

export async function compare(password: string, hashedPassword: string): Promise<boolean> {
    try {
        return await argon2Verify(hashedPassword, password)
    } catch {
        return false
    }
}
