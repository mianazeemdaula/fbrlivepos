import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import { compare } from '@/lib/crypto/password'
import { authConfig } from './auth.config'

const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            authorize: async (credentials) => {
                const parsed = loginSchema.safeParse(credentials)
                if (!parsed.success) return null

                const { email, password } = parsed.data

                // Find user across all tenants
                const user = await prisma.user.findFirst({
                    where: { email, isActive: true },
                    include: {
                        tenant: {
                            include: { diCredentials: { select: { isProductionReady: true, encryptedSandboxToken: true, encryptedProductionToken: true } } },
                        },
                    },
                })

                if (!user) return null

                const valid = await compare(password, user.password)
                if (!valid) return null

                // Check tenant is active
                if (!user.tenant.isActive) return null

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    tenantId: user.tenantId,
                    diConfigured: !!(user.tenant.diCredentials?.encryptedSandboxToken || user.tenant.diCredentials?.encryptedProductionToken),
                }
            },
        }),
    ],
})
