// app/staff/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { format } from 'date-fns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STAFF_PIN = '2026' // Change this to your household PIN

export default function StaffMode() {
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [meals, setMeals] = useState<any[]>([])
  const [tasks, setTasks] = useState<string[]>([])
  const [lastActivity, setLastActivity] = useState(Date.now())

  useEffect(() => {
    const saved = localStorage.getItem('staff_unlocked')
    if (saved && Date.now() - parseInt(saved) < 5 * 60 * 1000) {
      setUnlocked(true)
      loadToday()
    }
  }, [])

  useEffect(() => {
    if (!unlocked) return
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > 5 * 60 * 1000) {
        lock()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [lastActivity, unlocked])

  const loadToday = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('meal_plans')
      .select('date, recipes(name), meal_type')
      .eq('date', today)
      .order('meal_type')

    setMeals(data || [])
    setTasks([
      'Prep vegetables for dinner',
      'Check dairy fridge stock',
      'Set table for 8'
    ])
  }

  const handlePin = (digit: string) => {
    const newPin = (pin + digit).slice(0, 4)
    setPin(newPin)
    setLastActivity(Date.now())

    if (newPin.length === 4) {
      if (newPin === STAFF_PIN) {
        setUnlocked(true)
        localStorage.setItem('staff_unlocked', Date.now().toString())
        loadToday()
        setPin('')
      } else {
        setTimeout(() => setPin(''), 500)
      }
    }
  }

  const lock = () => {
    setUnlocked(false)
    localStorage.removeItem('staff_unlocked')
    setPin('')
  }

  const toggleTask = (idx: number) => {
    setTasks(tasks.filter((_, i) => i !== idx))
    setLastActivity(Date.now())
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-[2rem] shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-[#C4A484] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">👩‍🍳</span>
            </div>
            <h1 className="text-2xl font-serif mb-2" style={{fontFamily: 'Playfair Display, serif'}}>Staff Access</h1>
            <p className="text-stone-500 text-sm mb-8">Enter 4-digit PIN</p>

            <div className="flex justify-center gap-3 mb-8">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 ${pin.length > i ? 'bg-[#3C2F2F] border-[#3C2F2F]' : 'border-stone-300'}`} />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((key) => (
                <button
                  key={key}
                  onClick={() => key === '⌫' ? setPin(p => p.slice(0, -1)) : key !== '' && handlePin(key.toString())}
                  className="aspect-square bg-stone-50 hover:bg-stone-100 rounded-2xl text-2xl font-medium text-stone-800 active:scale-95 transition"
                  disabled={key === ''}
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="mt-8 text-xs text-stone-400">
              Sorted & Stocked • Household Staff
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-4" onClick={() => setLastActivity(Date.now())}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm p-5 mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-serif" style={{fontFamily: 'Playfair Display, serif'}}>Today</h1>
            <p className="text-sm text-stone-500">{format(new Date(), 'EEEE, MMM d')}</p>
          </div>
          <button onClick={lock} className="text-sm text-stone-500 hover:text-stone-700 px-3 py-1.5 rounded-lg hover:bg-stone-50">
            Lock
          </button>
        </div>

        {/* Today's Meals - BIG */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-4">
          <h2 className="font-medium text-stone-800 mb-4 flex items-center gap-2">
            <span className="text-xl">🍽️</span> Today's Meals
          </h2>
          {meals.length > 0 ? meals.map((meal, i) => (
            <div key={i} className="py-3 border-b border-stone-100 last:border-0">
              <div className="font-medium text-lg">{meal.recipes?.name || 'Meal'}</div>
              <div className="text-sm text-stone-500">{meal.meal_type} • 8 servings</div>
            </div>
          )) : (
            <div className="text-stone-400 text-center py-4">No meals scheduled</div>
          )}
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-3xl shadow-sm p-6 mb-4">
          <h2 className="font-medium text-stone-800 mb-4 flex items-center gap-2">
            <span className="text-xl">✓</span> Tasks
          </h2>
          <div className="space-y-2">
            {tasks.map((task, i) => (
              <button
                key={i}
                onClick={() => toggleTask(i)}
                className="w-full text-left p-3 bg-stone-50 hover:bg-green-50 rounded-xl flex items-center gap-3 transition"
              >
                <div className="w-5 h-5 border-2 border-stone-300 rounded"></div>
                <span>{task}</span>
              </button>
            ))}
            {tasks.length === 0 && (
              <div className="text-center py-4 text-green-600 font-medium">All done! ✓</div>
            )}
          </div>
        </div>

        {/* Big Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <a href="/scan" className="bg-[#3C2F2F] text-white rounded-3xl p-6 text-center hover:bg-stone-800 transition">
            <div className="text-3xl mb-2">📷</div>
            <div className="font-medium">Scan Item</div>
          </a>
          <a href="/dashboard" className="bg-white rounded-3xl p-6 text-center shadow-sm hover:shadow transition border border-stone-100">
            <div className="text-3xl mb-2">📋</div>
            <div className="font-medium text-stone-800">Shopping List</div>
          </a>
        </div>

        <div className="text-center mt-6 text-xs text-stone-400">
          Auto-locks in 5 min • Sorted & Stocked
        </div>
      </div>
    </div>
  )
}
