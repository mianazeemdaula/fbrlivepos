// CRITICAL: Before submitting any invoice, check if the buyer NTN is registered

export async function checkBuyerRegistrationType(
    buyerNTN: string,
    tenantToken: string,
): Promise<'Registered' | 'Unregistered' | 'unknown'> {
    try {
        const res = await fetch('https://gw.fbr.gov.pk/dist/v1/Get_Reg_Type', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tenantToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ Registration_No: buyerNTN }),
            signal: AbortSignal.timeout(5000),
        })
        const data = await res.json()
        // statuscode "00" = Registered, "01" = Unregistered
        return data.REGISTRATION_TYPE === 'Registered' ? 'Registered' : 'Unregistered'
    } catch {
        return 'unknown'
    }
}

// Also check ATL (Active Taxpayer List) status
export async function checkBuyerATLStatus(
    buyerNTN: string,
    tenantToken: string,
): Promise<'Active' | 'In-Active' | 'unknown'> {
    try {
        const today = new Date().toISOString().split('T')[0]
        const res = await fetch('https://gw.fbr.gov.pk/dist/v1/statl', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tenantToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ regno: buyerNTN, date: today }),
            signal: AbortSignal.timeout(5000),
        })
        const data = await res.json()
        return data.status === 'In-Active' ? 'In-Active' : 'Active'
    } catch {
        return 'unknown'
    }
}
