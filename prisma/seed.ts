import { PrismaClient, BillingCycle, SubStatus } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from '@node-rs/argon2'
import 'dotenv/config'
import { syncAllReferenceData } from '../workers/di-reference-sync.worker'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function feat(key: string, value: string, label: string) {
    return { key, value, label }
}

async function main() {
    console.log('🌱 Seeding database...')

    if (process.env.PRAL_PLATFORM_TOKEN) {
        console.log('🔄 Syncing FBR DI reference data...')
        await syncAllReferenceData()
        console.log('✅ FBR DI reference data synced')
    } else {
        console.warn('⚠️ PRAL_PLATFORM_TOKEN not set. Skipping FBR DI reference-data sync during seed.')
    }

    // --- Subscription Plans ---
    const freePlan = await prisma.subscriptionPlan.upsert({
        where: { slug: 'free' },
        update: {},
        create: {
            name: 'Free',
            slug: 'free',
            description: 'For small businesses getting started',
            priceMonthly: 0,
            priceYearly: 0,
            isActive: true,
            maxPosTerminals: 1,
            maxUsers: 2,
            maxProducts: 100,
            maxInvoicesMonth: 500,
            features: {
                create: [
                    feat('advancedReports', 'false', 'Advanced Reports'),
                    feat('apiAccess', 'false', 'API Access'),
                    feat('customBranding', 'false', 'Custom Branding'),
                    feat('emailInvoices', 'false', 'Email Invoices'),
                    feat('csvImport', 'false', 'CSV Import'),
                    feat('whiteLabel', 'false', 'White Label'),
                ],
            },
        },
    })

    const starterPlan = await prisma.subscriptionPlan.upsert({
        where: { slug: 'starter' },
        update: {},
        create: {
            name: 'Starter',
            slug: 'starter',
            description: 'Growing businesses with moderate volume',
            priceMonthly: 2500,
            priceYearly: 25000,
            isActive: true,
            maxPosTerminals: 3,
            maxUsers: 10,
            maxProducts: 1000,
            maxInvoicesMonth: 2500,
            features: {
                create: [
                    feat('advancedReports', 'false', 'Advanced Reports'),
                    feat('apiAccess', 'false', 'API Access'),
                    feat('customBranding', 'true', 'Custom Branding'),
                    feat('emailInvoices', 'false', 'Email Invoices'),
                    feat('csvImport', 'true', 'CSV Import'),
                    feat('whiteLabel', 'false', 'White Label'),
                ],
            },
        },
    })

    await prisma.subscriptionPlan.upsert({
        where: { slug: 'pro' },
        update: {},
        create: {
            name: 'Pro',
            slug: 'pro',
            description: 'High-volume businesses with advanced needs',
            priceMonthly: 6500,
            priceYearly: 65000,
            isActive: true,
            maxPosTerminals: 5,
            maxUsers: 20,
            features: {
                create: [
                    feat('advancedReports', 'true', 'Advanced Reports'),
                    feat('apiAccess', 'true', 'API Access'),
                    feat('customBranding', 'true', 'Custom Branding'),
                    feat('emailInvoices', 'true', 'Email Invoices'),
                    feat('csvImport', 'true', 'CSV Import'),
                    feat('whiteLabel', 'false', 'White Label'),
                ],
            },
        },
    })

    await prisma.subscriptionPlan.upsert({
        where: { slug: 'enterprise' },
        update: {},
        create: {
            name: 'Enterprise',
            slug: 'enterprise',
            description: 'Large operations with multiple locations',
            priceMonthly: 15000,
            priceYearly: 150000,
            isActive: true,
            features: {
                create: [
                    feat('advancedReports', 'true', 'Advanced Reports'),
                    feat('apiAccess', 'true', 'API Access'),
                    feat('customBranding', 'true', 'Custom Branding'),
                    feat('emailInvoices', 'true', 'Email Invoices'),
                    feat('csvImport', 'true', 'CSV Import'),
                    feat('whiteLabel', 'true', 'White Label'),
                ],
            },
        },
    })

    console.log('✅ Plans created')

    // --- Super Admin Tenant ---
    const adminTenant = await prisma.tenant.upsert({
        where: { email: 'admin@fbrpos.pk' },
        update: {},
        create: {
            name: 'FBR POS Platform',
            slug: 'fbrpos-platform',
            email: 'admin@fbrpos.pk',
            isActive: true,
        },
    })

    const adminPassword = await hash('password', {
        memoryCost: 65536,
        timeCost: 3,
        outputLen: 32,
        parallelism: 4,
    })

    await prisma.user.upsert({
        where: { email_tenantId: { email: 'admin@fbrpos.pk', tenantId: adminTenant.id } },
        update: {},
        create: {
            email: 'admin@fbrpos.pk',
            name: 'Super Admin',
            password: adminPassword,
            role: 'SUPER_ADMIN',
            tenantId: adminTenant.id,
        },
    })

    console.log('✅ Super admin created (admin@fbrpos.pk / password)')

    // --- Demo Tenant ---
    const demoTenant = await prisma.tenant.upsert({
        where: { email: 'demo@example.com' },
        update: {},
        create: {
            name: 'Demo Traders',
            slug: 'demo-traders',
            email: 'demo@example.com',
            phone: '+92 300 1234567',
            address: 'Lahore, Pakistan',
            isActive: true,
        },
    })

    const demoPassword = await hash('Demo@123456', {
        memoryCost: 65536,
        timeCost: 3,
        outputLen: 32,
        parallelism: 4,
    })

    await prisma.user.upsert({
        where: { email_tenantId: { email: 'demo@example.com', tenantId: demoTenant.id } },
        update: {},
        create: {
            email: 'demo@example.com',
            name: 'Demo Owner',
            password: demoPassword,
            role: 'TENANT_ADMIN',
            tenantId: demoTenant.id,
        },
    })

    // Subscribe demo to starter plan
    await prisma.tenantSubscription.upsert({
        where: { tenantId: demoTenant.id },
        update: {},
        create: {
            tenantId: demoTenant.id,
            planId: starterPlan.id,
            status: SubStatus.ACTIVE,
            billingCycle: BillingCycle.MONTHLY,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
    })

    // --- Feature Flags ---
    const flags = [
        { key: 'email_invoices', description: 'Enable emailing invoices to buyers', isActive: false },
        { key: 'csv_product_import', description: 'Allow CSV bulk product import', isActive: true },
        { key: 'multi_branch', description: 'Multi-branch support for enterprise', isActive: false },
        { key: 'maintenance_mode', description: 'Platform maintenance mode', isActive: false },
    ]

    for (const f of flags) {
        await prisma.featureFlag.upsert({
            where: { key: f.key },
            update: {},
            create: f,
        })
    }

    console.log('✅ Feature flags created')

    const auditLogCount = await prisma.auditLog.count()

    if (auditLogCount === 0) {
        await prisma.auditLog.createMany({
            data: [
                {
                    actorId: 'seed-system',
                    actorEmail: 'admin@fbrpos.pk',
                    actorRole: 'SUPER_ADMIN',
                    tenantId: adminTenant.id,
                    action: 'SEED_COMPLETED',
                    entity: 'Tenant',
                    entityId: adminTenant.id,
                    after: { source: 'prisma.seed', tenant: adminTenant.email },
                },
                {
                    actorId: 'seed-system',
                    actorEmail: 'admin@fbrpos.pk',
                    actorRole: 'SUPER_ADMIN',
                    tenantId: demoTenant.id,
                    action: 'TENANT_CREATED',
                    entity: 'Tenant',
                    entityId: demoTenant.id,
                    after: { source: 'prisma.seed', tenant: demoTenant.email },
                },
                {
                    actorId: 'seed-system',
                    actorEmail: 'admin@fbrpos.pk',
                    actorRole: 'SUPER_ADMIN',
                    action: 'FEATURE_FLAG_CREATED',
                    entity: 'FeatureFlag',
                    after: { source: 'prisma.seed', count: flags.length },
                },
            ],
        })
    }

    console.log('✅ Audit log seeded')
    console.log('\n🎉 Seed complete!')
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
