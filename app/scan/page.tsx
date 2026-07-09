// app/scan/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ScanPage() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [product, setProduct] = useState<any>(null)
  const [category, setCategory] = useState('Pantry')
  const html5QrCodeRef = useRef<any>(null)

  useEffect(() => {
    // Load html5-qrcode dynamically
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
    script.async = true
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [])

  const startScan = async () => {
    setScanning(true)
    setResult(null)
    // @ts-ignore
    const Html5Qrcode = window.Html5Qrcode
    const html5QrCode = new Html5Qrcode("reader")
    html5QrCodeRef.current = html5QrCode

    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          await html5QrCode.stop()
          setScanning(false)
          setResult(decodedText)
          // Lookup product
          try {
            const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`)
            const data = await res.json()
            if (data.status === 1) {
              setProduct({
                name: data.product.product_name || 'Unknown',
                brand: data.product.brands || '',
                image: data.product.image_front_small_url
              })
              // Guess category
              const cats = data.product.categories?.toLowerCase() || ''
              if (cats.includes('dairy')) setCategory('Dairy')
              else if (cats.includes('meat')) setCategory('Meat')
              else if (cats.includes('frozen')) setCategory('Freezer')
              else setCategory('Pantry')
            }
          } catch {}
        },
        () => {}
      )
    } catch (err) {
      console.error(err)
      setScanning(false)
    }
  }

  const addToInventory = async () => {
    if (!result) return
    const { error } = await supabase.from('inventory_items').insert({
      property_id: 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a', // Strauss Residence
      name: product?.name || `Item ${result}`,
      qr_code: result,
      category,
      current_qty: 1,
      min_qty: 1,
      unit: 'unit'
    })
    if (!error) {
      alert(`Added ${product?.name || result} to ${category}!`)
      setResult(null)
      setProduct(null)
    } else {
      alert(`Error: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-6">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-[2rem] shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#C4A484] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">📷</span>
            </div>
            <h1 className="text-2xl font-serif" style={{fontFamily: 'Playfair Display, serif'}}>Scan to Stock</h1>
            <p className="text-stone-500 text-sm mt-1">Point camera at barcode</p>
          </div>

          <div id="reader" className={`w-full ${scanning ? 'block' : 'hidden'} rounded-xl overflow-hidden mb-4`}></div>

          {!scanning && !result && (
            <button
              onClick={startScan}
              className="w-full bg-charcoal text-white py-4 rounded-xl font-medium hover:bg-stone-800 transition flex items-center justify-center gap-2"
            >
              <span>📷</span> Start Camera
            </button>
          )}

          {result && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="text-xs text-green-700 uppercase tracking-wide mb-1">Scanned</div>
                <div className="font-mono text-sm">{result}</div>
              </div>

              {product && (
                <div className="flex gap-3 p-3 bg-stone-50 rounded-xl">
                  {product.image && <img src={product.image} alt="" className="w-16 h-16 object-cover rounded-lg" />}
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-stone-500">{product.brand}</div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-stone-700 mb-1 block">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full p-3 border border-stone-200 rounded-xl bg-white"
                >
                  <option>Pantry</option>
                  <option>Dairy</option>
                  <option>Meat</option>
                  <option>Freezer</option>
                  <option>Produce</option>
                  <option>Bakery</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={addToInventory}
                  className="flex-1 bg-[#C4A484] text-white py-3 rounded-xl font-medium hover:bg-[#B39370]"
                >
                  Add to Inventory
                </button>
                <button
                  onClick={() => { setResult(null); setProduct(null) }}
                  className="px-4 py-3 border border-stone-200 rounded-xl"
                >
                  Rescan
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-stone-100">
            <h3 className="text-sm font-medium text-stone-700 mb-2">Staff Quick Add</h3>
            <div className="grid grid-cols-3 gap-2">
              {['Milk', 'Eggs', 'Bread'].map(item => (
                <button
                  key={item}
                  onClick={async () => {
                    const cat = item === 'Milk' ? 'Dairy' : item === 'Eggs' ? 'Dairy' : 'Pantry'
                    const { error } = await supabase.from('inventory_items').insert({
                      property_id: 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a',
                      name: item,
                      category: cat,
                      current_qty: 1,
                      min_qty: 1,
                      unit: 'unit'
                    })
                    alert(error ? `Error: ${error.message}` : `Added ${item}`)
                  }}
                  className="p-3 bg-stone-50 rounded-xl text-sm hover:bg-stone-100"
                >
                  + {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center mt-4">
          <a href="/dashboard" className="text-sm text-stone-500 hover:text-stone-700">← Back to Dashboard</a>
        </div>
      </div>
    </div>
  )
}
