import { NextRequest, NextResponse } from 'next/server'
import { assertSuperAdmin } from '@/lib/admin/guard'
import { HSCodeImportSchema } from '@/lib/admin/hscode.schema'
import { prisma } from '@/lib/db/prisma'
import { writeAuditLog } from '@/lib/admin/audit'

export async function POST(req: NextRequest) {
    const { actor } = await assertSuperAdmin(req)
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const text = await file.text()

    // Simple CSV parsing (header row + data rows)
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 2) {
        return NextResponse.json({ error: 'CSV must have headers and at least one data row' }, { status: 400 })
    }

    const headers = lines[0].split(',').map((h) => h.trim())
    const rows = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim())
        const row: Record<string, string> = {}
        headers.forEach((h, i) => {
            row[h] = values[i] ?? ''
        })
        return row
    })

    const parsed = HSCodeImportSchema.safeParse(rows)
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: 'CSV validation failed',
                details: parsed.error.issues.slice(0, 10),
            },
            { status: 422 },
        )
    }

    // Upsert all rows
    const results = await prisma.$transaction(
        parsed.data.map((row) =>
            prisma.hSCode.upsert({
                where: { code: row.code },
                create: {
                    code: row.code,
                    description: row.description,
                    category: row.category,
                    defaultTaxRate: row.defaultTaxRate,
                    unit: row.unit,
                    shortName: row.shortName,
                },
                update: {
                    description: row.description,
                    category: row.category,
                    defaultTaxRate: row.defaultTaxRate,
                    unit: row.unit,
                },
            }),
        ),
    )

    await writeAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'SUPER_ADMIN',
        action: 'HSCODE_BULK_IMPORT',
        after: { count: results.length },
    })

    return NextResponse.json({
        success: true,
        imported: results.length,
    })
}
