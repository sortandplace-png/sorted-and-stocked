'use client';

import React, { useState } from 'react';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Calendar, Clock, ArrowLeft } from 'lucide-react';

interface MealPlanEntry {
  id: string;
  plan_date: string;
  meal_slot?: string;
  course?: string;
  recipes?: {
    id: string;
    name: string;
    kosher_type?: string;
  };
  custom_name?: string;
}

interface MealPlanViewerProps {
  initialEntries: MealPlanEntry[];
}

export default function MealPlanViewer({ initialEntries }: MealPlanViewerProps) {
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [currentAnchorDate, setCurrentAnchorDate] = useState(new Date());

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Rule: Exclude historical entries prior to today dynamically
  const activeEntries = initialEntries.filter(entry => entry.plan_date >= todayStr);

  const getCourseIcon = (course?: string) => {
    switch (course?.toLowerCase()) {
      case 'protein':
        return '🥩';
      case 'starch':
        return '🍚';
      case 'vege':
        return '🥦';
      case 'salad':
        return '🥗';
      case 'soup':
        return '🥣';
      case 'dessert':
        return '🍰';
      case 'dip':
        return '🫘';
      default:
        return '🍽️';
    }
  };

  // Generate date ranges for views
  const weekStart = startOfWeek(currentAnchorDate, { weekStartsOn: 0 }); // Sunday start
  const daysInWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentAnchorDate),
    end: endOfMonth(currentAnchorDate),
  });

  return (
    <div className="bg-cream p-6 rounded-2xl border border-sand shadow-sm text-charcoal">
      {/* Top Controller */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-sand">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-charcoal">Meal Plan</h2>
          <p className="text-xs text-slate-500">Active and upcoming meals</p>
        </div>

        <div className="flex items-center gap-2 bg-sand p-1 rounded-lg self-stretch sm:self-auto">
          {(['day', 'week', 'month'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-all ${
                viewMode === mode
                  ? 'bg-white text-terracotta shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {daysInWeek.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayMeals = activeEntries.filter((e) => e.plan_date === dateStr);
            const isToday = dateStr === todayStr;

            return (
              <div
                key={dateStr}
                className={`p-4 rounded-xl border transition-all flex flex-col min-h-[200px] ${
                  isToday
                    ? 'bg-white border-terracotta shadow-md ring-1 ring-terracotta/20'
                    : 'bg-white border-sand hover:border-slate-300'
                }`}
              >
                <div className="mb-3 border-b border-sand pb-1.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {format(day, 'EEEE')}
                  </p>
                  <p className={`text-lg font-black ${isToday ? 'text-terracotta' : 'text-slate-800'}`}>
                    {format(day, 'd')}
                  </p>
                </div>

                <div className="space-y-2 flex-1">
                  {dayMeals.length === 0 ? (
                    <span className="text-xs italic text-slate-400 block pt-4">No meals scheduled</span>
                  ) : (
                    dayMeals.map((meal) => (
                      <div key={meal.id} className="text-xs p-2 bg-cream rounded border border-sand">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span>{getCourseIcon(meal.course)}</span>
                          <span className="font-semibold text-slate-700 truncate">
                            {meal.recipes?.name || meal.custom_name || 'Unscheduled'}
                          </span>
                        </div>
                        {meal.recipes?.kosher_type && (
                          <p className="text-[10px] text-slate-500">{meal.recipes.kosher_type}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-7 gap-2 bg-sand p-2 rounded-xl border border-sand">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((h) => (
            <div key={h} className="text-center text-xs font-bold text-slate-500 py-1">
              {h}
            </div>
          ))}
          {monthDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayMeals = activeEntries.filter((e) => e.plan_date === dateStr);
            const isToday = dateStr === todayStr;

            return (
              <div
                key={dateStr}
                className={`min-h-[70px] p-2 rounded border flex flex-col justify-between ${
                  isToday
                    ? 'bg-white border-terracotta'
                    : 'bg-white border-sand'
                }`}
              >
                <span className={`text-xs font-bold ${isToday ? 'text-terracotta' : 'text-slate-400'}`}>
                  {format(day, 'd')}
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {dayMeals.slice(0, 3).map((m) => (
                    <span
                      key={m.id}
                      title={m.recipes?.name || m.custom_name}
                      className="w-2 h-2 rounded-full bg-sage"
                    />
                  ))}
                  {dayMeals.length > 3 && <span className="text-[8px] text-slate-400">+{dayMeals.length - 3}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Day View */}
      {viewMode === 'day' && (
        <div className="bg-white p-6 rounded-xl border border-sand max-w-md mx-auto">
          <h3 className="font-bold text-slate-800 mb-4">{format(currentAnchorDate, 'EEEE, MMMM d, yyyy')}</h3>
          {activeEntries.filter((e) => e.plan_date === todayStr).length === 0 ? (
            <p className="text-sm text-slate-500">No meals scheduled for today</p>
          ) : (
            activeEntries
              .filter((e) => e.plan_date === todayStr)
              .map((meal) => (
                <div key={meal.id} className="p-3 border-b last:border-0 border-sand">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{getCourseIcon(meal.course)}</span>
                    <span className="text-xs font-bold text-terracotta capitalize">{meal.course}</span>
                  </div>
                  <p className="font-semibold text-slate-900">{meal.recipes?.name || meal.custom_name}</p>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}
