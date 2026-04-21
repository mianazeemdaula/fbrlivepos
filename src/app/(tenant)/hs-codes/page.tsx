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
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">FBR HS Codes</h1>
                <p className="text-slate-400 text-sm mt-1">
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
                    className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="sm:w-56 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
                        Loading…
                    </div>
                ) : hsCodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                        <span className="text-4xl mb-3">🔍</span>
                        <p className="text-sm">No HS codes found matching your filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                                    <th className="px-4 py-3 text-left">Code</th>
                                    <th className="px-4 py-3 text-left">Description</th>
                                    <th className="px-4 py-3 text-left">Short Name</th>
                                    <th className="px-4 py-3 text-left">Category</th>
                                    <th className="px-4 py-3 text-left">Unit</th>
                                    <th className="px-4 py-3 text-right">Tax Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {hsCodes.map((hs) => (
                                    <tr
                                        key={hs.id}
                                        className="hover:bg-slate-800/50 transition-colors"
                                    >
                                        <td className="px-4 py-3 font-mono text-blue-400 whitespace-nowrap">
                                            {hs.code}
                                        </td>
                                        <td className="px-4 py-3 text-slate-200 max-w-xs truncate text-xs">
                                            {hs.description}
                                        </td>
                                        <td className="px-4 py-3 text-slate-400">
                                            {hs.shortName ?? '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-xs">
                                                {hs.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-400">{hs.unit}</td>
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
                    <span>
                        Showing {from}–{to} of {total.toLocaleString()} codes
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(1)}
                            className="px-2 py-1 rounded border border-slate-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            «
                        </button>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="px-3 py-1 rounded border border-slate-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                                        ? 'border-blue-500 bg-blue-600/20 text-blue-400'
                                        : 'border-slate-700 hover:border-slate-500'
                                        }`}
                                >
                                    {p}
                                </button>
                            )
                        })}

                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            className="px-3 py-1 rounded border border-slate-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(totalPages)}
                            className="px-2 py-1 rounded border border-slate-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            »
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
