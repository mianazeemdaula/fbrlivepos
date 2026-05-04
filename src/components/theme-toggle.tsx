'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

type ThemeValue = 'light' | 'dark' | 'system'

const themeOptions: Array<{ value: ThemeValue; label: string; icon: React.ReactNode }> = [
    { value: 'light', label: 'Light', icon: <Sun size={14} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
    { value: 'system', label: 'System', icon: <Monitor size={14} /> },
]

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return null
    }

    return (
        <div className={compact ? 'flex items-center gap-1' : 'theme-toggle-dock'}>
            <span className={compact ? 'sr-only' : 'theme-toggle-label'}>Theme</span>
            <div className="theme-toggle-group" role="group" aria-label="Theme switcher">
                {themeOptions.map((option) => {
                    const active = theme === option.value
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setTheme(option.value)}
                            className={`theme-toggle-btn ${active ? 'theme-toggle-btn-active' : ''}`}
                            aria-label={`Switch to ${option.label} theme`}
                            aria-pressed={active}
                        >
                            <span className="shrink-0">{option.icon}</span>
                            {!compact && <span>{option.label}</span>}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
