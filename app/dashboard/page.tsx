// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { format, isFriday, isSaturday, parseISO } from 'date-fns'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getHebcal() {
  // Lakewood, NJ - geonameid 5100280
  try {
    const res = await fetch('https://www.hebcal.com/shabbat?cfg=json&geonameid=5100280&M=on&lg=he', { next: { revalidate: 3600 } })
    const data = await res.json()
    const candle = data.items?.find((i: any) => i.category === 'candles')
    const havdalah = data.items?.find((i: any) => i.category === 'havdalah')
    const hebrew = data.items?.find((i: any) => i.category === 'parashat')?.hebrew || ''
    return {
      hebrewDate: data.date || '',
      candleTime: candle ? new Date(candle.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '8:12pm',
      candleDate: candle?.date,
      havdalahDate: havdalah?.date,
      parsha: candle?.title?.replace('Candle lighting: ', '') || ''
    }
  } catch {
    return { hebrewDate: "כ״ח תמוז תשפ״ו", candleTime: '8:12pm', candleDate: null, havdalahDate: null, parsha: '' }
  }
}

async function getData() {
  const supabase = await createClient()
  const [meals, inventory, shopping] = await Promise.all([
    supabase.from('meal_plan_entries').select('date, recipes(name), meal_type').gte('date', '2026-06-21').lte('date', '2026-08-23').order('date'),
    supabase.from('inventory_items').select('category, name, current_qty, min_qty, photo_url, reorder_link').order('category'),
    supabase.from('shopping_list_items').select('name, category, quantity, purchased, photo_url, reorder_link').eq('purchased', false).order('category')
  ])
  return { meals: meals.data || [], inventory: inventory.data || [], shopping: shopping.data || [] }
}

const kashrutColor = { Fleishig: 'bg-red-600', Milchig: 'bg-blue-600', Parve: 'bg-green-600' }

function getKashrut(name: string) {
  const n = name?.toLowerCase() || ''
  if (n.includes('cheese') || n.includes('milk') || n.includes('yogurt') || n.includes('butter')) return 'Milchig'
  if (n.includes('chicken') || n.includes('beef') || n.includes('steak') || n.includes('meat') || n.includes('brisket')) return 'Fleishig'
  return 'Parve'
}

export default async function Dashboard() {
  const [{ meals, inventory, shopping }, hebcal] = await Promise.all([getData(), getHebcal()])

  const now = new Date()
  const isShabbos = (isFriday(now) && hebcal.candleDate && now > new Date(new Date(hebcal.candleDate).getTime() - 3600000)) ||
                    (isSaturday(now) && hebcal.havdalahDate && now < new Date(hebcal.havdalahDate))

  const categories = ['Produce', 'Meat', 'Dairy', 'Pantry', 'Bakery', 'Frozen']
  const shoppingByCat = categories.map(cat => ({
    cat,
    items: shopping.filter(s => s.category?.toLowerCase().includes(cat.toLowerCase()))
  })).filter(g => g.items.length > 0)

  return (
    <div className={`min-h-screen p-6 font-sans transition-all ${isShabbos ? 'bg-amber-50' : 'bg-[#FAF7F2]'}`}>
      <div className={`max-w-7xl mx-auto rounded-[2rem] shadow-xl p-8 transition-all ${isShabbos ? 'bg-amber-50/80 backdrop-blur-sm' : 'bg-white'}`}>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✡️</span>
            <h1 className="text-4xl font-serif text-stone-800" style={{fontFamily: 'Playfair Display, serif'}}>Sorted & Stocked</h1>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-stone-500">Kosher Household Management</div>
        </div>

        {/* Hebrew Bar - LIVE */}
        <div className={`rounded-2xl p-4 text-center mb-8 border ${isShabbos ? 'bg-amber-100 border-amber-200' : 'bg-stone-100 border-stone-200'}`}>
          <div className="inline-flex items-center gap-3">
            <span className="bg-blue-100 px-4 py-1 rounded-full text-sm font-medium">
              {hebcal.hebrewDate} • {format(now, 'EEEE, MMMM d, yyyy')}
            </span>
            {hebcal.parsha && <span className="text-sm text-stone-600">Parashat {hebcal.parsha}</span>}
          </div>
          <div className="text-sm mt-2 flex items-center justify-center gap-2">
            <span>🕯️</span> Candle Lighting {hebcal.candleTime} • Lakewood, NJ
            {isShabbos && <span className="ml-2 px-2 py-0.5 bg-amber-200 rounded-full text-xs">Shabbos Mode Active</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-serif mb-1" style={{fontFamily: 'Playfair Display, serif'}}>Month-at-a-Glance Meal Plan</h2>
            <p className="text-stone-500 mb-4">June 21 — August 23, 2026 • {meals.length} meals planned</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['June', 'July', 'August'].map((month, idx) => {
                const monthMeals = meals.filter(m => new Date(m.date).getMonth() === 5 + idx)
                return (
                  <div key={month} className="border border-stone-200 rounded-2xl p-4 bg-stone-50/50">
                    <h3 className="font-serif text-center mb-3 text-stone-700">{month.toUpperCase()} 2026</h3>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {monthMeals.slice(0, 8).map((meal: any, i) => {
                        const k = getKashrut(meal.recipes?.name)
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className={`w-2 h-2 rounded-full ${kashrutColor[k as keyof typeof kashrutColor]} flex-shrink-0`}></span>
                            <span className="truncate">{format(parseISO(meal.date), 'd')} • {meal.recipes?.name}</span>
                          </div>
                        )
                      })}
                      {monthMeals.length === 0 && <div className="text-xs text-stone-400 italic">No meals</div>}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              {Object.entries(kashrutColor).map(([k, c]) => (
                <div key={k} className="flex items-center gap-1.5 px-3 py-1.5 border border-stone-200 rounded-full text-xs bg-white">
                  <span className={`w-2.5 h-2.5 rounded-full ${c}`}></span>
                  {k}
                </div>
              ))}
            </div>

            <h3 className="text-xl font-serif mt-8 mb-3" style={{fontFamily: 'Playfair Display, serif'}}>Upcoming Meals</h3>
            <div className="space-y-2.5">
              {meals.slice(0, 5).map((meal: any, i) => {
                const k = getKashrut(meal.recipes?.name)
                return (
                  <div key={i} className="flex items-center justify-between p-4 bg-stone-50 rounded-xl hover:bg-stone-100 transition">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 text-xs text-white rounded-md font-medium ${kashrutColor[k as keyof typeof kashrutColor]}`}>{k}</span>
                      <div>
                        <div className="font-medium text-stone-800">{format(parseISO(meal.date), 'EEE • MMM d')} • {meal.recipes?.name || 'Meal'}</div>
                        <div className="text-xs text-stone-500">{meal.meal_type || 'Dinner'} • 8 servings</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT */}
          <div>
            <h2 className="text-2xl font-serif mb-1" style={{fontFamily: 'Playfair Display, serif'}}>Shopping List</h2>
            <p className="text-sm text-stone-500 mb-4">{shopping.length} items</p>

            <div className="space-y-4">
              {shoppingByCat.map(group => (
                <div key={group.cat}>
                  <div className="flex items-center gap-2 font-medium mb-2 text-stone-700">
                    <span className={`w-3 h-3 rounded-full ${group.cat === 'Meat' ? 'bg-red-600' : group.cat === 'Dairy' ? 'bg-blue-600' : 'bg-green-600'}`}></span>
                    {group.cat}
                  </div>
                  <div className="space-y-2 ml-5">
                    {group.items.map((item: any, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-sm p-2 bg-stone-50/50 rounded-lg hover:bg-stone-100 transition">
                        <input type="checkbox" className="rounded border-stone-300 text-amber-600" />
                        {item.photo_url && <img src={item.photo_url} alt={item.name} className="w-8 h-8 object-cover rounded" />}
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-stone-500">{item.quantity}</div>
                        </div>
                        {item.reorder_link && (
                          <a href={item.reorder_link} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 text-xs font-medium px-2 py-1 bg-amber-50 rounded">
                            Order ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-xl font-serif mt-8 mb-3" style={{fontFamily: 'Playfair Display, serif'}}>Inventory Items</h3>
            <div className="space-y-2">
              {inventory.slice(0, 8).map((item: any, i) => {
                const stockPct = item.current_qty > 0 ? Math.min(100, (item.current_qty / (item.min_qty + 2)) * 100) : 0
                const isLow = item.current_qty < item.min_qty
                return (
                  <div key={i} className={`p-3 rounded-lg border ${isLow ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-100'}`}>
                    <div className="flex items-start gap-3">
                      {item.photo_url && <img src={item.photo_url} alt={item.name} className="w-10 h-10 object-cover rounded" />}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-stone-800 truncate">{item.name}</div>
                        <div className="text-xs text-stone-500">{item.category}</div>
                        <div className="w-full bg-stone-200 h-1 rounded-full mt-1.5 overflow-hidden">
                          <div className={`${isLow ? 'bg-red-600' : 'bg-green-600'} h-1 transition-all`} style={{ width: `${stockPct}%` }}></div>
                        </div>
                        <div className="text-xs text-stone-600 mt-1">Qty: {item.current_qty} {isLow && <span className="text-red-600 font-medium">LOW</span>}</div>
                      </div>
                      {item.reorder_link && (
                        <a href={item.reorder_link} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 text-xs font-medium px-2 py-1 bg-amber-50 rounded whitespace-nowrap">
                          Order ↗
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <button className="w-full mt-4 bg-[#C4A484] text-white py-3 rounded-xl font-medium hover:bg-[#B39370] transition shadow-sm">
              + Add Item
            </button>
          </div>
        </div>

        {isShabbos && (
          <div className="fixed bottom-4 right-4 bg-amber-900 text-amber-50 px-4 py-2 rounded-full text-sm shadow-lg">
            Shabbos Mode • Editing disabled
          </div>
        )}
      </div>
    </div>
  )
}
