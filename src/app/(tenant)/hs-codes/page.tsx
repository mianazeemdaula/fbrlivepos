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
                <p className="text-xs uppercase tracking-[0.26em] text-[#f0d9a0]">Reference library</p>
                <h1 className="brand-heading mt-2 text-3xl font-bold text-white">FBR HS Codes</h1>
                <p className="mt-1 text-sm text-[#c1bcaf]">
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
                    className="flex-1 rounded-xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white placeholder:text-[#8d897d]"
                />
                <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="sm:w-56 rounded-xl border border-white/10 bg-white/6 px-4 py-2 text-sm text-white"
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
            <div className="app-panel overflow-hidden rounded-2xl">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-sm text-[#8d897d]">
                        Loading…
                    </div>
                ) : hsCodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-[#8d897d]">
                        <span className="text-4xl mb-3">🔍</span>
                        <p className="text-sm">No HS codes found matching your filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-[#8d897d]">
                                    <th className="px-4 py-3 text-left">Code</th>
                                    <th className="px-4 py-3 text-left">Description</th>
                                    <th className="px-4 py-3 text-left">Short Name</th>
                                    <th className="px-4 py-3 text-left">Category</th>
                                    <th className="px-4 py-3 text-left">Unit</th>
                                    <th className="px-4 py-3 text-right">Tax Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {hsCodes.map((hs) => (
                                    <tr
                                        key={hs.id}
                                        className="transition-colors hover:bg-white/6"
                                    >
                                        <td className="px-4 py-3 font-mono whitespace-nowrap text-[#f0d9a0]">
                                            {hs.code}
                                        </td>
                                        <td className="max-w-xs truncate px-4 py-3 text-xs text-[#e7e0cf]">
                                            {hs.description}
                                        </td>
                                        <td className="px-4 py-3 text-[#c1bcaf]">
                                            {hs.shortName ?? '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs text-[#d8d0bf]">
                                                {hs.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[#c1bcaf]">{hs.unit}</td>
                                        <td className="px-4 py-3 text-right font-medium text-emerald-400">
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
                <div className="flex flex-col items-center justify-between gap-3 text-sm text-[#8d897d] sm:flex-row">
                    <span>
                        Showing {from}–{to} of {total.toLocaleString()} codes
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(1)}
                            className="rounded border border-white/10 px-2 py-1 transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            «
                        </button>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="rounded border border-white/10 px-3 py-1 transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-40"
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
                                        ? 'border-[var(--accent)] bg-[rgba(200,164,90,0.18)] text-[#f0d9a0]'
                                        : 'border-white/10 hover:bg-white/6'
                                        }`}
                                >
                                    {p}
                                </button>
                            )
                        })}

                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            className="rounded border border-white/10 px-3 py-1 transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Next
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(totalPages)}
                            className="rounded border border-white/10 px-2 py-1 transition-colors hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            »
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
