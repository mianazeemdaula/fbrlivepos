import { PrismaClient, BillingCycle, SubStatus } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from '@node-rs/argon2'
import 'dotenv/config'
import { syncAllReferenceData } from '../workers/di-reference-sync.worker'
import { encryptCredential } from '../src/lib/crypto/credentials'

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

    // --- DI Scenario Catalogue ---
    const DI_SCENARIOS: Array<{ id: string; description: string; saleType: string; notes?: string }> = [
        { id: 'SN001', description: 'Goods at standard rate to registered buyers', saleType: 'Goods at Standard Rate (default)', notes: '18% ST, furtherTax=0' },
        { id: 'SN002', description: 'Goods at standard rate to unregistered buyers', saleType: 'Goods at Standard Rate (default)', notes: '18% ST + 3% further tax' },
        { id: 'SN003', description: 'Sale of Steel (Melted and Re-Rolled)', saleType: 'Steel Melting and re-rolling', notes: 'Specific rate per MT; SRO required' },
        { id: 'SN004', description: 'Sale by Ship Breakers', saleType: 'Ship breaking', notes: 'Sector-specific rate; HS 7204.4910, UOM MT' },
        { id: 'SN005', description: 'Reduced rate sale', saleType: 'Goods at Reduced Rate', notes: 'Rate < 18% per SRO; extraTax as empty string' },
        { id: 'SN006', description: 'Exempt goods sale', saleType: 'Exempt Goods', notes: 'Rate=0%, no tax charged' },
        { id: 'SN007', description: 'Zero rated sale', saleType: 'Goods at zero-rate', notes: 'Rate=0%, buyer can claim input tax credit' },
        { id: 'SN008', description: 'Sale of 3rd Schedule goods', saleType: '3rd Schedule Goods', notes: 'Tax on retail price (fixedNotifiedValueOrRetailPrice), not ex-factory' },
        { id: 'SN009', description: 'Cotton Spinners purchase from Cotton Ginners', saleType: 'Cotton Ginners', notes: 'Purchase type; UOM KG' },
        { id: 'SN010', description: 'Telecom services', saleType: 'Telecommunication services', notes: '19.5% FED charged' },
        { id: 'SN011', description: 'Toll Manufacturing (Steel)', saleType: 'Toll Manufacturing', notes: 'Only Steel sector; UOM KG for 7214.9990' },
        { id: 'SN012', description: 'Petroleum products', saleType: 'Petroleum Products', notes: 'UOM KG or Litre; no further tax' },
        { id: 'SN013', description: 'Electricity supply to retailers', saleType: 'Electricity Supply to Retailers', notes: 'UOM KWH mandatory' },
        { id: 'SN014', description: 'Gas to CNG stations', saleType: 'Gas to CNG stations', notes: 'UOM MMBTU or M3' },
        { id: 'SN015', description: 'Sale of mobile phones', saleType: 'Mobile Phones', notes: 'Fixed amount per unit + percentage' },
        { id: 'SN016', description: 'Processing / Conversion of Goods', saleType: 'Processing/ Conversion of Goods', notes: 'Conversion fee is taxable base' },
        { id: 'SN017', description: 'Sale of Goods where FED is charged in ST mode', saleType: 'Goods (FED in ST Mode)', notes: 'fedPayable field required' },
        { id: 'SN018', description: 'Services where FED charged in ST mode', saleType: 'Services (FED in ST Mode)', notes: 'fedPayable + salesTaxApplicable both used' },
        { id: 'SN019', description: 'Services rendered or provided', saleType: 'Services', notes: 'Standard 16% or 13% province-dependent' },
        { id: 'SN020', description: 'Sale of Electric Vehicles', saleType: 'Electric Vehicle', notes: 'Reduced rate per EV SRO' },
        { id: 'SN021', description: 'Cement / Concrete Block', saleType: 'Cement /Concrete Block', notes: 'HS 2523.2900, UOM KG; fixed amount per 50kg bag' },
        { id: 'SN022', description: 'Potassium Chlorate', saleType: 'Potassium Chlorate', notes: 'rate: "18% along with rupees 60 per kilogram"' },
        { id: 'SN023', description: 'CNG sales', saleType: 'CNG Sales', notes: 'HS 2711.2100, UOM MMBTU' },
        { id: 'SN024', description: 'Goods listed in SRO 297(I)/2023', saleType: 'Goods as per SRO.297(|)/2023', notes: 'SRO schedule + item no. required' },
        { id: 'SN025', description: 'Drugs at fixed ST rate (8th Schedule Table 1 Serial 81)', saleType: 'Non-Adjustable Supplies', notes: 'Fixed rate; non-adjustable input credit' },
        { id: 'SN026', description: 'Sale to End Consumer — standard goods (Retailer only)', saleType: 'Goods at Standard Rate (default)', notes: 'buyerRegistrationType=Unregistered' },
        { id: 'SN027', description: 'Sale to End Consumer — 3rd Schedule goods (Retailer only)', saleType: '3rd Schedule Goods', notes: 'buyerRegistrationType=Unregistered; non-zero valueSalesExcludingST' },
        { id: 'SN028', description: 'Sale to End Consumer — reduced rate (Retailer only)', saleType: 'Goods at Reduced Rate', notes: 'buyerRegistrationType=Unregistered; extraTax as empty string' },
    ]

    for (const s of DI_SCENARIOS) {
        await prisma.dIScenario.upsert({
            where: { id: s.id },
            update: { description: s.description, saleType: s.saleType, notes: s.notes },
            create: s,
        })
    }
    console.log('✅ DI scenario catalogue seeded (SN001-SN028)')

    // Business Activity × Sector → applicable scenarios
    type ActivitySectorScenarios = { activity: string; sector: string; scenarios: string[] }
    const ACTIVITY_SECTOR_SCENARIOS: ActivitySectorScenarios[] = [
        // Manufacturer
        { activity: 'Manufacturer', sector: 'All Other Sectors', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024'] },
        { activity: 'Manufacturer', sector: 'Steel', scenarios: ['SN003', 'SN004', 'SN011'] },
        { activity: 'Manufacturer', sector: 'FMCG', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN008'] },
        { activity: 'Manufacturer', sector: 'Textile', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN009'] },
        { activity: 'Manufacturer', sector: 'Telecom', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN010'] },
        { activity: 'Manufacturer', sector: 'Petroleum', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN012'] },
        { activity: 'Manufacturer', sector: 'Electricity Distribution', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN013'] },
        { activity: 'Manufacturer', sector: 'Gas Distribution', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN014'] },
        { activity: 'Manufacturer', sector: 'Services', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN018', 'SN019'] },
        { activity: 'Manufacturer', sector: 'Automobile', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN020'] },
        { activity: 'Manufacturer', sector: 'CNG Stations', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN023'] },
        { activity: 'Manufacturer', sector: 'Pharmaceuticals', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024'] },
        { activity: 'Manufacturer', sector: 'Wholesale / Retail', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN026', 'SN027', 'SN028', 'SN008'] },
        // Importer
        { activity: 'Importer', sector: 'All Other Sectors', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024'] },
        { activity: 'Importer', sector: 'Steel', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN003', 'SN004', 'SN011'] },
        { activity: 'Importer', sector: 'FMCG', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN008'] },
        { activity: 'Importer', sector: 'Textile', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN009'] },
        { activity: 'Importer', sector: 'Telecom', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN010'] },
        { activity: 'Importer', sector: 'Petroleum', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN012'] },
        { activity: 'Importer', sector: 'Electricity Distribution', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN013'] },
        { activity: 'Importer', sector: 'Gas Distribution', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN014'] },
        { activity: 'Importer', sector: 'Services', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN018', 'SN019'] },
        { activity: 'Importer', sector: 'Automobile', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN020'] },
        { activity: 'Importer', sector: 'CNG Stations', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN023'] },
        { activity: 'Importer', sector: 'Pharmaceuticals', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN025'] },
        { activity: 'Importer', sector: 'Wholesale / Retail', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN026', 'SN027', 'SN028', 'SN008'] },
        // Distributor / Wholesaler (identical)
        { activity: 'Distributor', sector: 'All Other Sectors', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Distributor', sector: 'Steel', scenarios: ['SN003', 'SN004', 'SN011', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Distributor', sector: 'FMCG', scenarios: ['SN008', 'SN026', 'SN027', 'SN028'] },
        { activity: 'Distributor', sector: 'Textile', scenarios: ['SN009', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Distributor', sector: 'Telecom', scenarios: ['SN010', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Distributor', sector: 'Petroleum', scenarios: ['SN012', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Distributor', sector: 'Electricity Distribution', scenarios: ['SN013', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Distributor', sector: 'Gas Distribution', scenarios: ['SN014', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Distributor', sector: 'Services', scenarios: ['SN018', 'SN019', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Distributor', sector: 'Automobile', scenarios: ['SN020', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Distributor', sector: 'CNG Stations', scenarios: ['SN023', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Distributor', sector: 'Pharmaceuticals', scenarios: ['SN025', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Distributor', sector: 'Wholesale / Retail', scenarios: ['SN001', 'SN002', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Wholesaler', sector: 'All Other Sectors', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Wholesaler', sector: 'Steel', scenarios: ['SN003', 'SN004', 'SN011', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Wholesaler', sector: 'FMCG', scenarios: ['SN008', 'SN026', 'SN027', 'SN028'] },
        { activity: 'Wholesaler', sector: 'Wholesale / Retail', scenarios: ['SN001', 'SN002', 'SN026', 'SN027', 'SN028', 'SN008'] },
        // Retailer
        { activity: 'Retailer', sector: 'All Other Sectors', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Retailer', sector: 'Steel', scenarios: ['SN003', 'SN004', 'SN011'] },
        { activity: 'Retailer', sector: 'FMCG', scenarios: ['SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Retailer', sector: 'Textile', scenarios: ['SN009', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Retailer', sector: 'Telecom', scenarios: ['SN010', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Retailer', sector: 'Petroleum', scenarios: ['SN012', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Retailer', sector: 'Electricity Distribution', scenarios: ['SN013', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Retailer', sector: 'Gas Distribution', scenarios: ['SN014', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Retailer', sector: 'Services', scenarios: ['SN018', 'SN019', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Retailer', sector: 'Automobile', scenarios: ['SN020', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Retailer', sector: 'CNG Stations', scenarios: ['SN023', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Retailer', sector: 'Pharmaceuticals', scenarios: ['SN025', 'SN026', 'SN027', 'SN028', 'SN008'] },
        { activity: 'Retailer', sector: 'Wholesale / Retail', scenarios: ['SN026', 'SN027', 'SN028', 'SN008'] },
        // Exporter
        { activity: 'Exporter', sector: 'All Other Sectors', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024'] },
        { activity: 'Exporter', sector: 'Steel', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN003', 'SN004', 'SN011'] },
        { activity: 'Exporter', sector: 'FMCG', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN008'] },
        { activity: 'Exporter', sector: 'Wholesale / Retail', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN026', 'SN027', 'SN028', 'SN008'] },
        // Service Provider
        { activity: 'Service Provider', sector: 'All Other Sectors', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN018', 'SN019'] },
        { activity: 'Service Provider', sector: 'Steel', scenarios: ['SN003', 'SN004', 'SN011', 'SN018', 'SN019'] },
        { activity: 'Service Provider', sector: 'Services', scenarios: ['SN018', 'SN019'] },
        { activity: 'Service Provider', sector: 'Telecom', scenarios: ['SN010', 'SN018', 'SN019'] },
        { activity: 'Service Provider', sector: 'Wholesale / Retail', scenarios: ['SN026', 'SN027', 'SN028', 'SN008', 'SN018', 'SN019'] },
        // Other
        { activity: 'Other', sector: 'All Other Sectors', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024'] },
        { activity: 'Other', sector: 'Wholesale / Retail', scenarios: ['SN001', 'SN002', 'SN005', 'SN006', 'SN007', 'SN015', 'SN016', 'SN017', 'SN021', 'SN022', 'SN024', 'SN026', 'SN027', 'SN028', 'SN008'] },
    ]

    for (const row of ACTIVITY_SECTOR_SCENARIOS) {
        for (const scenarioId of row.scenarios) {
            await prisma.dIBusinessScenario.upsert({
                where: { businessActivity_sector_scenarioId: { businessActivity: row.activity, sector: row.sector, scenarioId } },
                update: {},
                create: { businessActivity: row.activity, sector: row.sector, scenarioId },
            })
        }
    }
    console.log('✅ DI business-scenario matrix seeded')

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

    // --- Ali Protein Farm — Test Tenant (real PRAL sandbox credentials) ---
    const aliTenant = await prisma.tenant.upsert({
        where: { email: 'ali@aliprotein.pk' },
        update: {},
        create: {
            name: 'Ali Protein Farm',
            slug: 'ali-protein-farm',
            email: 'ali@aliprotein.pk',
            phone: '+92 300 0000000',
            address: 'VILLAGE DHARMAIWALA 5-KM BASIRPUR ROAD',
            isActive: true,
            preferredIdType: 'NTN',
        },
    })

    const aliPassword = await hash('Ali@123456', {
        memoryCost: 65536,
        timeCost: 3,
        outputLen: 32,
        parallelism: 4,
    })

    await prisma.user.upsert({
        where: { email_tenantId: { email: 'ali@aliprotein.pk', tenantId: aliTenant.id } },
        update: {},
        create: {
            email: 'ali@aliprotein.pk',
            name: 'Ali Admin',
            password: aliPassword,
            role: 'TENANT_ADMIN',
            tenantId: aliTenant.id,
        },
    })

    // Subscribe Ali Protein Farm to starter plan
    await prisma.tenantSubscription.upsert({
        where: { tenantId: aliTenant.id },
        update: {},
        create: {
            tenantId: aliTenant.id,
            planId: starterPlan.id,
            status: SubStatus.ACTIVE,
            billingCycle: BillingCycle.MONTHLY,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
    })

    // Seed PRAL DI credentials for Ali Protein Farm (sandbox token)
    if (process.env.CREDENTIALS_ENCRYPTION_KEY) {
        const sandboxTokenPlain = '78296a7f-bb56-32a0-bd45-5e6471318a76'
        const encryptedToken = encryptCredential(sandboxTokenPlain)

        await prisma.dICredentials.upsert({
            where: { tenantId: aliTenant.id },
            update: {
                sellerNTN: '28930282',
                sellerCNIC: '3530118686639',
                sellerBusinessName: 'ALI PROTEIN FARM',
                sellerProvince: 'PUNJAB',
                sellerAddress: 'VILLAGE DHARMAIWALA 5-KM BASIRPUR ROAD',
                businessActivity: 'Manufacturer',
                sector: 'All Other Sectors',
                environment: 'SANDBOX',
                encryptedSandboxToken: encryptedToken,
                tokenExpiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
            },
            create: {
                tenantId: aliTenant.id,
                sellerNTN: '28930282',
                sellerCNIC: '3530118686639',
                sellerBusinessName: 'ALI PROTEIN FARM',
                sellerProvince: 'PUNJAB',
                sellerAddress: 'VILLAGE DHARMAIWALA 5-KM BASIRPUR ROAD',
                businessActivity: 'Manufacturer',
                sector: 'All Other Sectors',
                environment: 'SANDBOX',
                encryptedSandboxToken: encryptedToken,
                tokenExpiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
            },
        })
        console.log('✅ Ali Protein Farm DI credentials seeded (sandbox token encrypted)')
    } else {
        console.warn('⚠️  CREDENTIALS_ENCRYPTION_KEY not set — skipping DI credential encryption for Ali Protein Farm')
    }

    console.log('✅ Ali Protein Farm tenant created (ali@aliprotein.pk / Ali@123456)')

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
