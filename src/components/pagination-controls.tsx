'use client'

interface PaginationControlsProps {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
    summary?: string
}

export function PaginationControls({ page, totalPages, onPageChange, summary }: PaginationControlsProps) {
    if (!summary && totalPages <= 1) {
        return null
    }

    const pageCount = Math.min(5, totalPages)
    const start = Math.max(1, Math.min(page - 2, totalPages - pageCount + 1))
    const pages = Array.from({ length: pageCount }, (_, index) => start + index)

    return (
        <div className="flex flex-col gap-3 pt-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>{summary}</span>
            {totalPages > 1 && (
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => onPageChange(1)}
                        className="rounded border border-slate-700 px-2 py-1 transition-colors hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        «
                    </button>
                    <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => onPageChange(page - 1)}
                        className="rounded border border-slate-700 px-3 py-1 transition-colors hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        Prev
                    </button>
                    {pages.map((pageNumber) => (
                        <button
                            key={pageNumber}
                            type="button"
                            onClick={() => onPageChange(pageNumber)}
                            className={`rounded border px-3 py-1 transition-colors ${pageNumber === page
                                ? 'border-blue-500 bg-blue-600/20 text-blue-400'
                                : 'border-slate-700 hover:border-slate-500'
                                }`}
                        >
                            {pageNumber}
                        </button>
                    ))}
                    <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() => onPageChange(page + 1)}
                        className="rounded border border-slate-700 px-3 py-1 transition-colors hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        Next
                    </button>
                    <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() => onPageChange(totalPages)}
                        className="rounded border border-slate-700 px-2 py-1 transition-colors hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        »
                    </button>
                </div>
            )}
        </div>
    )
}