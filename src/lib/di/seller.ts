import type { DICredentials, Tenant } from '@/generated/prisma/client'

type SellerCredentialFields = Pick<
    DICredentials,
    'sellerNTN' | 'sellerCNIC' | 'sellerBusinessName' | 'sellerProvince' | 'sellerAddress'
>

export function getSellerNTNCNIC(creds: Pick<DICredentials, 'sellerNTN' | 'sellerCNIC'>): string {
    const preferredIdentifier = creds.sellerNTN?.trim() || creds.sellerCNIC?.trim()

    if (!preferredIdentifier) {
        throw new Error('Seller NTN or CNIC is required for PRAL DI submissions. Update it in Settings.')
    }

    return preferredIdentifier
}

export function getSellerIdentity(
    creds: SellerCredentialFields,
    tenant?: Pick<Tenant, 'name' | 'address'>,
) {
    return {
        sellerNTNCNIC: getSellerNTNCNIC(creds),
        sellerBusinessName: tenant?.name?.trim() || creds.sellerBusinessName,
        sellerProvince: creds.sellerProvince,
        sellerAddress: tenant?.address?.trim() || creds.sellerAddress,
    }
}