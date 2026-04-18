import type { NextAuthConfig } from 'next-auth'

declare module 'next-auth' {
    interface Session {
        user: {
            id: string
            email: string
            name: string
            role: string
            tenantId: string
            diConfigured: boolean
        }
    }

    interface User {
        role: string
        tenantId: string
        diConfigured: boolean
    }
}

declare module '@auth/core/jwt' {
    interface JWT {
        id: string
        role: string
        tenantId: string
        diConfigured: boolean
    }
}

export const authConfig = {
    providers: [],
    trustHost: true,
    callbacks: {
        jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id!
                token.role = user.role
                token.tenantId = user.tenantId
                token.diConfigured = user.diConfigured
            }

            if (trigger === 'update' && typeof session?.diConfigured === 'boolean') {
                token.diConfigured = session.diConfigured
            }

            return token
        },
        session({ session, token }) {
            session.user.id = token.id
            session.user.role = token.role
            session.user.tenantId = token.tenantId
            session.user.diConfigured = token.diConfigured
            return session
        },
    },
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: 'jwt' as const,
    },
} satisfies NextAuthConfig
