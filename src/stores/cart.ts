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
    diFixedNotifiedValueOrRetailPrice: number | null // 3rd Schedule: tax base price per unit
    sroScheduleNo: string | null
    sroItemSerialNo: string | null
    isLocalOnly: boolean
    unit: string
    quantity: number
    discount: number // per-item discount amount
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

    addItem: (item: Omit<CartItem, 'quantity' | 'discount'>) => void
    removeItem: (productId: string) => void
    updateQuantity: (productId: string, quantity: number) => void
    updateDiscount: (productId: string, discount: number) => void
    updatePrice: (productId: string, price: number) => void
    updateTaxRate: (productId: string, taxRate: number) => void
    updateDiRate: (productId: string, diRate: string) => void
    updateDiSaleType: (productId: string, diSaleType: string) => void
    updateSroScheduleNo: (productId: string, sroScheduleNo: string) => void
    updateSroItemSerialNo: (productId: string, sroItemSerialNo: string) => void
    updateRetailPrice: (productId: string, retailPrice: number | null) => void
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
            if (existing) {
                return {
                    items: state.items.map((i) =>
                        i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i,
                    ),
                }
            }
            return { items: [...state.items, { ...item, quantity: 1, discount: 0 }] }
        }),

    removeItem: (productId) =>
        set((state) => ({
            items: state.items.filter((i) => i.productId !== productId),
        })),

    updateQuantity: (productId, quantity) =>
        set((state) => ({
            items:
                quantity <= 0
                    ? state.items.filter((i) => i.productId !== productId)
                    : state.items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
        })),

    updateDiscount: (productId, discount) =>
        set((state) => ({
            items: state.items.map((i) =>
                i.productId === productId ? { ...i, discount: Math.max(0, discount) } : i,
            ),
        })),

    updatePrice: (productId, price) =>
        set((state) => ({
            items: state.items.map((i) =>
                i.productId === productId ? { ...i, price: Math.max(0, price) } : i,
            ),
        })),

    updateTaxRate: (productId, taxRate) =>
        set((state) => ({
            items: state.items.map((i) =>
                i.productId === productId ? { ...i, taxRate: Math.max(0, taxRate) } : i,
            ),
        })),

    updateDiRate: (productId, diRate) =>
        set((state) => ({
            items: state.items.map((i) =>
                i.productId === productId ? { ...i, diRate } : i,
            ),
        })),

    updateDiSaleType: (productId, diSaleType) =>
        set((state) => ({
            items: state.items.map((i) =>
                i.productId === productId ? { ...i, diSaleType } : i,
            ),
        })),

    updateSroScheduleNo: (productId, sroScheduleNo) =>
        set((state) => ({
            items: state.items.map((i) =>
                i.productId === productId ? { ...i, sroScheduleNo } : i,
            ),
        })),

    updateSroItemSerialNo: (productId, sroItemSerialNo) =>
        set((state) => ({
            items: state.items.map((i) =>
                i.productId === productId ? { ...i, sroItemSerialNo } : i,
            ),
        })),

    updateRetailPrice: (productId, retailPrice) =>
        set((state) => ({
            items: state.items.map((i) =>
                i.productId === productId
                    ? { ...i, diFixedNotifiedValueOrRetailPrice: retailPrice }
                    : i,
            ),
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
            return sum + calculateSalesTaxApplicable({
                saleType: i.diSaleType,
                taxRate: i.taxRate,
                taxableValue: lineSubtotal,
                retailPrice: i.diFixedNotifiedValueOrRetailPrice ?? i.price,
                quantity: i.quantity,
            })
        }, 0),
    total: () => get().subtotal() - get().discountTotal() + get().taxAmount(),
    itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
