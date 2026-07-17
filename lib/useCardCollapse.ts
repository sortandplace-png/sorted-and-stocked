'use client'

import { useCallback, useEffect, useState } from 'react'

// Collapsed state starts false on every render (server-rendered markup has
// no access to localStorage) and is corrected in an effect right after
// mount -- a previously-collapsed card will render expanded for one frame,
// then collapse. Not worth a cookie/SSR round trip to avoid for a purely
// cosmetic preference.
export function useCardCollapse(cardId: string) {
  const key = `card-collapsed-${cardId}`
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem(key) === 'true')
  }, [key])

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(key, String(next))
      return next
    })
  }, [key])

  return { collapsed, toggle }
}
