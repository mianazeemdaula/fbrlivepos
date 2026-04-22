import type { DICredentials } from '@/generated/prisma/client'

type SellerCredentialFields = Pick<
    DICredentials,
    'sellerNTN' | 'sellerCNIC' | 'sellerBusinessName' | 'sellerProvince' | 'sellerAddress'
>

type SellerIdPreference = 'NTN' | 'CNIC'

function normalizeSellerIdentifier(value: string | null | undefined): string {
    return value?.trim() ?? ''
}

export function getSellerNTNCNIC(
    creds: Pick<DICredentials, 'sellerNTN' | 'sellerCNIC'>,
    preferredIdType?: SellerIdPreference | null,
): string {
    const sellerNTN = normalizeSellerIdentifier(creds.sellerNTN)
    const sellerCNIC = normalizeSellerIdentifier(creds.sellerCNIC)

    const preferredIdentifier = preferredIdType === 'CNIC'
        ? (sellerCNIC || sellerNTN)
        : (sellerNTN || sellerCNIC)

    if (!preferredIdentifier) {
        throw new Error('Seller NTN or CNIC is required for PRAL DI submissions. Update it in Settings.')
    }

    return preferredIdentifier
}

type SellerIdentityContext = {
    name?: string | null
    address?: string | null
    preferredIdType?: string | null
}

export function getSellerIdentity(
    creds: SellerCredentialFields,
    tenant?: SellerIdentityContext,
) {
    const normalizedPreference: SellerIdPreference | undefined =
        tenant?.preferredIdType === 'CNIC'
            ? 'CNIC'
            : tenant?.preferredIdType === 'NTN'
                ? 'NTN'
                : undefined

    return {
        sellerNTNCNIC: getSellerNTNCNIC(creds, normalizedPreference),
        sellerBusinessName: tenant?.name?.trim() || creds.sellerBusinessName,
        sellerProvince: creds.sellerProvince,
        sellerAddress: tenant?.address?.trim() || creds.sellerAddress,
    }
}