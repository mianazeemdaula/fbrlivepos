// CRITICAL: Before submitting any invoice, check if the buyer NTN is registered

const FBR_BASE = 'https://gw.fbr.gov.pk'

export async function checkBuyerRegistrationType(
    buyerNTN: string,
    token: string,
): Promise<{ registrationType: 'Registered' | 'Unregistered' | 'unknown'; registrationNo?: string; raw?: unknown }> {
    try {
        const res = await fetch(`${FBR_BASE}/dist/v1/Get_Reg_Type`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ Registration_No: buyerNTN }),
            signal: AbortSignal.timeout(10_000),
        })
        if (res.status === 401) return { registrationType: 'unknown' }
        const data = await res.json()
        // statuscode "00" = found
        const regType = data.REGISTRATION_TYPE === 'Registered' ? 'Registered' as const : 'Unregistered' as const
        return {
            registrationType: regType,
            registrationNo: data.REGISTRATION_NO,
            raw: data,
        }
    } catch {
        return { registrationType: 'unknown' }
    }
}

// Also check ATL (Active Taxpayer List) status
export async function checkBuyerATLStatus(
    buyerNTN: string,
    token: string,
): Promise<{ status: 'Active' | 'In-Active' | 'unknown'; raw?: unknown }> {
    try {
        const today = new Date().toISOString().split('T')[0]
        const res = await fetch(`${FBR_BASE}/dist/v1/statl`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ regno: buyerNTN, date: today }),
            signal: AbortSignal.timeout(10_000),
        })
        if (res.status === 401) return { status: 'unknown' }
        const data = await res.json()
        return {
            status: data.status === 'In-Active' ? 'In-Active' : 'Active',
            raw: data,
        }
    } catch {
        return { status: 'unknown' }
    }
}

// Combined verification
export async function verifyBuyer(
    buyerNTN: string,
    token: string,
): Promise<{
    registrationType: 'Registered' | 'Unregistered' | 'unknown'
    atlStatus: 'Active' | 'In-Active' | 'unknown'
    registrationNo?: string
}> {
    const [regResult, atlResult] = await Promise.all([
        checkBuyerRegistrationType(buyerNTN, token),
        checkBuyerATLStatus(buyerNTN, token),
    ])
    return {
        registrationType: regResult.registrationType,
        atlStatus: atlResult.status,
        registrationNo: regResult.registrationNo,
    }
}
