import { NextRequest, NextResponse } from 'next/server'
import { LedgerParseError } from '@/lib/ledger/parser'
import { previewDirectFile, type DirectFilePreview } from '@/lib/direct/service'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = /\.(xls|xlsx|csv)$/i

/** Reads the uploaded sheet from multipart form data and plans its invoices. */
export async function readDirectUpload(req: NextRequest): Promise<
    | { ok: true; file: File; preview: DirectFilePreview }
    | { ok: false; response: NextResponse }
> {
    const fail = (error: string, status = 400) => ({ ok: false as const, response: NextResponse.json({ error }, { status }) })
    const formData = await req.formData().catch(() => null)
    const file = formData?.get('file')
    if (!(file instanceof File)) return fail('Choose the filled template to upload.')
    if (!ALLOWED_EXTENSIONS.test(file.name)) return fail('Upload the sheet as .xls, .xlsx or .csv.')
    if (file.size > MAX_FILE_BYTES) return fail('The file is larger than 10 MB.')

    try {
        return { ok: true, file, preview: previewDirectFile(new Uint8Array(await file.arrayBuffer())) }
    } catch (error) {
        if (error instanceof LedgerParseError) return fail(error.message, 422)
        throw error
    }
}
