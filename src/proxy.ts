import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth(async (req) => {
    const session = req.auth
    const path = req.nextUrl.pathname

    // Public routes — no auth required
    if (
        path === '/' ||
        path === '/pricing' ||
        path === '/signup' ||
        path === '/login' ||
        path.startsWith('/api/auth') ||
        path.startsWith('/api/onboarding') ||
        path.startsWith('/_next') ||
        path.startsWith('/favicon')
    ) {
        return NextResponse.next()
    }

    // Protect all tenant routes
    if (
        path.startsWith('/pos') ||
        path.startsWith('/dashboard') ||
        path.startsWith('/invoices') ||
        path.startsWith('/products') ||
        path.startsWith('/reports') ||
        path.startsWith('/settings')
    ) {
        if (!session) {
            return NextResponse.redirect(new URL('/login', req.url))
        }
    }

    // Protect super-admin routes
    if (path.startsWith('/super-admin') || path.startsWith('/api/admin')) {
        if (!session) {
            return NextResponse.redirect(new URL('/login', req.url))
        }
        if (session.user.role !== 'SUPER_ADMIN') {
            return NextResponse.redirect(new URL('/dashboard', req.url))
        }
    }

    // Protect tenant API routes
    if (path.startsWith('/api/tenant') || path.startsWith('/api/invoices') || path.startsWith('/api/products')) {
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    return NextResponse.next()
})

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
