'use client'

import { useEffect, useState, useCallback } from 'react'

interface HSCode {
    id: string
    code: string
    description: string
    shortName: string | null
    category: string
    unit: string
    defaultTaxRate: string | number
}

const LIMIT = 25

export default function HSCodesPage() {
    const [hsCodes, setHsCodes] = useState<HSCode[]>([])
    const [categories, setCategories] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [category, setCategory] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
            setPage(1)
        }, 300)
        return () => clearTimeout(timer)
    }, [search])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                q: debouncedSearch,
                category,
                page: String(page),
                limit: String(LIMIT),
            })
            const res = await fetch(`/api/hs-codes?${params}`)
            if (res.ok) {
                const data = await res.json()
                setHsCodes(data.data ?? [])
                setTotal(data.total ?? 0)
                setTotalPages(data.pages ?? 1)
                if (data.categories?.length) {
                    setCategories(data.categories)
                }
            }
        } catch {
            // Ignore network errors
        } finally {
            setLoading(false)
        }
    }, [debouncedSearch, category, page])

    useEffect(() => {
        load()
    }, [load])

    function handleCategoryChange(val: string) {
        setCategory(val)
        setPage(1)
    }

    const from = total === 0 ? 0 : (page - 1) * LIMIT + 1
    const to = Math.min(page * LIMIT, total)

    return (
        <div className="space-y-6 p-6 lg:p-8">
            {/* Header */}
            <div>
                <p className="text-xs font-medium uppercase tracking-caps text-muted">Reference library</p>
                <h1 className="mt-2 text-page-title font-normal text-ink">FBR HS Codes</h1>
                <p className="mt-1 text-sm text-muted">
                    Browse the complete list of FBR-approved Harmonised System codes and applicable tax rates.
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    placeholder="Search by code, description, or short name…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 rounded-input border border-border bg-white px-4 py-2 text-sm text-ink placeholder:text-muted"
                />
                <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="sm:w-56 rounded-input border border-border bg-white px-4 py-2 text-sm text-ink"
                >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                        <option key={cat} value={cat}>
                            {cat}
                        </option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-card shadow-card overflow-hidden rounded-2xl">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-sm text-muted">
                        Loading…
                    </div>
                ) : hsCodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted">
                        <span className="text-4xl mb-3">🔍</span>
                        <p className="text-sm">No HS codes found matching your filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                                    <th className="px-4 py-3 text-left">Code</th>
                                    <th className="px-4 py-3 text-left">Description</th>
                                    <th className="px-4 py-3 text-left">Category</th>
                                    <th className="px-4 py-3 text-left">Unit</th>
                                    <th className="px-4 py-3 text-right">Tax Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {hsCodes.map((hs) => (
                                    <tr
                                        key={hs.id}
                                        className="transition-colors hover:bg-surface-subtle"
                                    >
                                        <td className="px-4 py-3 font-mono whitespace-nowrap text-muted">
                                            {hs.code}
                                        </td>
                                        <td className="max-w-xs truncate px-4 py-3 text-xs text-ink">
                                            {hs.description}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-ink">
                                                {hs.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{hs.unit}</td>
                                        <td className="px-4 py-3 text-right font-medium">
                                            {Number(hs.defaultTaxRate).toFixed(0)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {!loading && total > 0 && (
                <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted sm:flex-row">
                    <span>
                        Showing {from}–{to} of {total.toLocaleString()} codes
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(1)}
                            className="rounded border border-border px-2 py-1 transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            «
                        </button>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="rounded border border-border px-3 py-1 transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Prev
                        </button>

                        {/* Page window */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                            const p = start + i
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`px-3 py-1 rounded border transition-colors ${p === page
                                        ? 'border-accent bg-gold/15 text-muted'
                                        : 'border-border hover:bg-surface-subtle'
                                        }`}
                                >
                                    {p}
                                </button>
                            )
                        })}

                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            className="rounded border border-border px-3 py-1 transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Next
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(totalPages)}
                            className="rounded border border-border px-2 py-1 transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            »
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
