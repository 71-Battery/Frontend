import { useEffect } from 'react'

const LIGHT_THEME_COLOR = '#f7f9fc'
const DARK_THEME_COLOR = '#0d1320'

function setBrowserThemeColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  meta.setAttribute(
    'content',
    theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
  )
}

export function useBrowserThemeColor(theme) {
  useEffect(() => {
    setBrowserThemeColor(theme)
  }, [theme])
}

export function useSystemBrowserThemeColor() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const updateThemeColor = () => {
      setBrowserThemeColor(query.matches ? 'dark' : 'light')
    }

    updateThemeColor()
    query.addEventListener('change', updateThemeColor)
    return () => query.removeEventListener('change', updateThemeColor)
  }, [])
}
