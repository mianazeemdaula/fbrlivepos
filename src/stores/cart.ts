import { create } from 'zustand'

interface CartItem {
    productId: string
    name: string
    hsCode: string
    price: number
    taxRate: number
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
            return sum + (lineSubtotal * i.taxRate) / 100
        }, 0),
    total: () => get().subtotal() - get().discountTotal() + get().taxAmount(),
    itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
