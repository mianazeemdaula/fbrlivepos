import { create } from 'zustand'
import { calculateSalesTaxApplicable } from '@/lib/di/tax'

interface CartItem {
    productId: string
    name: string
    hsCode: string
    price: number
    taxRate: number
    diRate: string | null // FBR rate string e.g. "18%", "Exempt"
    diSaleType: string | null
    diFixedNotifiedValueOrRetailPrice: number | null // 3rd Schedule: retail/notified price per unit (callers multiply by qty for tax calc)
    sroScheduleNo: string | null
    sroItemSerialNo: string | null
    isLocalOnly: boolean
    unit: string
    quantity: number
    discount: number // per-item discount amount
    valueSalesExcludingST?: number
    salesTaxApplicable?: number
    furtherTax?: number
    fedPayable?: number
    extraTax?: number
    totalTax?: number
    totalInvoiceValue?: number
    furtherTaxPercent?: number
    fedPercent?: number
    extraTaxPercent?: number
    isExempt?: boolean
    itemTotal?: number
}

type CartItemInput = Omit<CartItem, 'quantity' | 'discount'> & {
    quantity?: number
    discount?: number
}

interface CartStore {
    items: CartItem[]
    buyerName: string
    buyerNTN: string
    buyerPhone: string
    buyerProvince: string
    buyerAddress: string
    buyerRegistrationType: 'Registered' | 'Unregistered' | ''
    customerId: string | null
    paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER'
    terminalId: string | null

    addItem: (item: CartItemInput) => void
    removeItem: (productId: string) => void
    setBuyerInfo: (info: { buyerName?: string; buyerNTN?: string; buyerPhone?: string; buyerProvince?: string; buyerAddress?: string; buyerRegistrationType?: 'Registered' | 'Unregistered' | '' }) => void
    setCustomer: (customer: { id: string; name: string; ntnCnic?: string | null; phone?: string | null; province?: string | null; address?: string | null; registrationType?: string | null } | null) => void
    setPaymentMethod: (method: 'CASH' | 'CARD' | 'BANK_TRANSFER') => void
    setTerminalId: (id: string | null) => void
    clearCart: () => void

    // Computed
    subtotal: () => number
    discountTotal: () => number
    taxAmount: () => number
    total: () => number
    itemCount: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
    items: [],
    buyerName: '',
    buyerNTN: '',
    buyerPhone: '',
    buyerProvince: '',
    buyerAddress: '',
    buyerRegistrationType: '',
    customerId: null,
    paymentMethod: 'CASH',
    terminalId: null,

    addItem: (item) =>
        set((state) => {
            const existing = state.items.find((i) => i.productId === item.productId)
            const quantityToAdd = item.quantity ?? 1
            const discountToAdd = item.discount ?? 0
            if (existing) {
                return {
                    items: state.items.map((i) =>
                        i.productId === item.productId
                            ? { ...i, quantity: i.quantity + quantityToAdd, discount: i.discount + discountToAdd }
                            : i,
                    ),
                }
            }
            return { items: [...state.items, { ...item, quantity: quantityToAdd, discount: discountToAdd }] }
        }),

    removeItem: (productId) =>
        set((state) => ({
            items: state.items.filter((i) => i.productId !== productId),
        })),

    setBuyerInfo: (info) => set(info),
    setCustomer: (customer) => {
        if (!customer) {
            set({ customerId: null, buyerName: '', buyerNTN: '', buyerPhone: '', buyerProvince: '', buyerAddress: '', buyerRegistrationType: '' })
        } else {
            set({
                customerId: customer.id,
                buyerName: customer.name,
                buyerNTN: customer.ntnCnic || '',
                buyerPhone: customer.phone || '',
                buyerProvince: customer.province || '',
                buyerAddress: customer.address || '',
                buyerRegistrationType: (customer.registrationType as 'Registered' | 'Unregistered') || '',
            })
        }
    },
    setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
    setTerminalId: (terminalId) => set({ terminalId }),
    clearCart: () =>
        set({
            items: [],
            buyerName: '',
            buyerNTN: '',
            buyerPhone: '',
            buyerProvince: '',
            buyerAddress: '',
            buyerRegistrationType: '',
            customerId: null,
            paymentMethod: 'CASH',
        }),

    subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    discountTotal: () => get().items.reduce((sum, i) => sum + i.discount, 0),
    taxAmount: () =>
        get().items.reduce((sum, i) => {
            const lineSubtotal = i.price * i.quantity - i.discount
            return sum + (i.totalTax ?? i.salesTaxApplicable ?? calculateSalesTaxApplicable({
                saleType: i.diSaleType,
                taxRate: i.taxRate,
                taxableValue: lineSubtotal,
                retailPrice: (i.diFixedNotifiedValueOrRetailPrice ?? i.price) * i.quantity,
                quantity: i.quantity,
            }))
        }, 0),
    total: () => get().subtotal() - get().discountTotal() + get().taxAmount(),
    itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
