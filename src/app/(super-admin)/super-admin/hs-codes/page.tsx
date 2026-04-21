'use client'

import { useEffect, useState } from 'react'
import { PaginationControls } from '@/components/pagination-controls'

interface HSCode {
    id: string
    code: string
    description: string
    shortName: string | null
    category: string
    unit: string
    defaultTaxRate: string
    isFBRActive: boolean
    isActive?: boolean
}

const LIMIT = 25

export default function HSCodesPage() {
    const [codes, setCodes] = useState<HSCode[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [showForm, setShowForm] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [importLoading, setImportLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    async function loadCodes() {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                q: search,
                page: String(page),
                limit: String(LIMIT),
            })
            const res = await fetch(`/api/admin/hs-codes?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setCodes(data.data || [])
                setTotal(data.total ?? 0)
                setTotalPages(data.pages ?? 1)
            }
        } catch {
            // Ignore
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadCodes()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, page])

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setFormLoading(true)
        setError('')

        const fd = new FormData(e.currentTarget)

        try {
            const res = await fetch('/api/admin/hs-codes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: fd.get('code'),
                    description: fd.get('description'),
                    defaultTaxRate: parseFloat(fd.get('defaultTaxRate') as string),
                    category: fd.get('category') as string,
                    unit: fd.get('unit') as string,
                    isFBRActive: true,
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                setError(data.error || 'Failed to create HS code')
                return
            }

            setShowForm(false)
            loadCodes()
        } catch {
            setError('Network error')
        } finally {
            setFormLoading(false)
        }
    }

    async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        setImportLoading(true)
        setMessage('')
        setError('')

        try {
            const formData = new FormData()
            formData.append('file', file)

            const res = await fetch('/api/admin/hs-codes/import', {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()
            if (res.ok) {
                setMessage(`Imported ${data.imported} HS codes successfully.`)
                setPage(1)
                loadCodes()
            } else {
                setError(data.error || 'Import failed')
            }
        } catch {
            setError('Failed to read CSV file')
        } finally {
            setImportLoading(false)
            e.target.value = ''
        }
    }

    const from = total === 0 ? 0 : (page - 1) * LIMIT + 1
    const to = Math.min(page * LIMIT, total)

    return (
        <div className="p-8">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">HS Code Library</h1>
                    <p className="text-slate-400 text-sm mt-1">Manage the master list of FBR Harmonized System codes</p>
                </div>
                <div className="flex gap-2">
                    <label
                        className={`bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${importLoading ? 'opacity-50 pointer-events-none' : ''
                            }`}
                    >
                        {importLoading ? 'Importing...' : 'Import CSV'}
                        <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
                    </label>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        {showForm ? 'Cancel' : '+ Add HS Code'}
                    </button>
                </div>
            </div>

            {message && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg p-3 mb-4">
                    {message}
                </div>
            )}

            {showForm && (
                <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3 mb-4">
                            {error}
                        </div>
                    )}
                    <h2 className="text-sm font-semibold text-white mb-4">New HS Code</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">HS Code</label>
                            <input name="code" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="1234.56.78" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
                            <input name="description" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
                            <input name="category" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Unit</label>
                            <select name="unit" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                                <option value="PCS">PCS</option>
                                <option value="KG">KG</option>
                                <option value="LTR">LTR</option>
                                <option value="MTR">MTR</option>
                                <option value="SQM">SQM</option>
                                <option value="SET">SET</option>
                                <option value="PAIR">PAIR</option>
                                <option value="BOX">BOX</option>
                                <option value="CTN">CTN</option>
                                <option value="DZN">DZN</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Default Tax %</label>
                            <input name="defaultTaxRate" type="number" step="0.01" min="0" defaultValue="18" required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-5">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Cancel</button>
                        <button
                            type="submit"
                            disabled={formLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            {formLoading ? 'Creating...' : 'Create HS Code'}
                        </button>
                    </div>
                </form>
            )}

            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search HS codes..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value)
                        setPage(1)
                    }}
                    className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-800">
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Code</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Description</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Tax %</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Unit</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Category</th>
                            <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-slate-800/50">
                                    <td colSpan={6} className="px-4 py-3">
                                        <div className="h-4 bg-slate-800 rounded animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : codes.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-slate-500 text-sm">
                                    No HS codes found. Add codes manually or import a CSV.
                                </td>
                            </tr>
                        ) : (
                            codes.map((code) => (
                                <tr key={code.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                    <td className="px-4 py-3 text-sm text-white font-mono">{code.code}</td>
                                    <td className="px-4 py-3 text-sm text-slate-300">{code.description}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{code.defaultTaxRate}%</td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{code.unit}</td>
                                    <td className="px-4 py-3 text-sm text-slate-400">{code.category || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${code.isFBRActive
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : 'bg-red-500/10 text-red-400'
                                                }`}
                                        >
                                            {code.isFBRActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {!loading && total > 0 && (
                <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    summary={`Showing ${from}-${to} of ${total.toLocaleString()} HS codes`}
                />
            )}
        </div>
    )
}
