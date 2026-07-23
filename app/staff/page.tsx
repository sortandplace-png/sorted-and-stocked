// app/staff/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { format } from 'date-fns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// No PIN gate here — middleware.ts already requires a real signed-in Supabase
// session for every route except /login, /auth/callback, /forgot-password.
// A hardcoded 4-digit PIN on top of that was redundant and easily guessed.
export default function StaffMode() {
  const [meals, setMeals] = useState<any[]>([])
  const [tasks, setTasks] = useState<string[]>([])

  useEffect(() => {
    loadToday()
  }, [])

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

  const toggleTask = (idx: number) => {
    setTasks(tasks.filter((_, i) => i !== idx))
  }

  return (
    <div className="min-h-screen bg-linen p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm p-5 mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-serif" style={{fontFamily: 'Playfair Display, serif'}}>Today</h1>
            <p className="text-sm text-stone-500">{format(new Date(), 'EEEE, MMM d')}</p>
          </div>
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
          <a href="/scan" className="bg-denim text-white rounded-3xl p-6 text-center hover:bg-stone-800 transition">
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
