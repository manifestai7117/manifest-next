'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

const PRODUCTS = [
  { size:'8×10"', price:'$29', type:'Poster', desc:'Matte fine art paper, vibrant colors. Ships in 3-5 days.' },
  { size:'12×16"', price:'$49', type:'Canvas', desc:'Gallery-wrapped canvas, ready to hang. Ships in 5-7 days.', featured:true },
  { size:'18×24"', price:'$79', type:'Framed', desc:'Black wood frame, museum glass. Ships in 7-10 days.' },
]

export default function PrintPage() {
  const [added, setAdded] = useState<string[]>([])

  const order = (type: string) => {
    setAdded(prev => [...prev, type])
    toast.success(`${type} added! Checkout integration via Stripe coming — connect it in your Stripe dashboard.`)
  }

  return (
    <div className="fade-up max-w-[800px]">
      <h1 className="font-serif text-[32px] mb-1">Print Shop</h1>
      <p className="text-[14px] text-[#666] mb-8">Museum-quality prints of your vision art, delivered to your door</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PRODUCTS.map(p => (
          <div key={p.type} className={`bg-white rounded-2xl p-6 text-center relative ${p.featured ? 'border-2 border-[#111]' : 'border border-[#e8e8e8]'}`}>
            {p.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#111] text-white text-[10px] font-medium px-3 py-1 rounded-full whitespace-nowrap">Most popular</div>}
            <div className="w-12 h-16 bg-[#1a1a2e] rounded-lg mx-auto mb-4 flex items-center justify-center text-[18px] text-white/20 font-serif">✦</div>
            <p className="font-medium text-[16px] mb-0.5">{p.type}</p>
            <p className="text-[13px] text-[#999] mb-1">{p.size}</p>
            <p className="text-[12px] text-[#999] mb-4 leading-[1.5]">{p.desc}</p>
            <p className="font-serif text-[36px] mb-4">{p.price}</p>
            <button
              onClick={() => order(p.type)}
              disabled={added.includes(p.type)}
              className={`w-full py-2.5 rounded-xl text-[13px] font-medium transition-colors ${added.includes(p.type) ? 'bg-green-50 text-green-700 border border-green-200' : p.featured ? 'bg-[#111] text-white hover:bg-[#2a2a2a]' : 'border border-[#d0d0d0] hover:bg-[#f8f7f5]'}`}>
              {added.includes(p.type) ? '✓ Added to cart' : 'Order now'}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-[#f8f7f5] border border-[#e8e8e8] rounded-2xl p-5 flex gap-4 items-start">
        <div className="text-[20px]">🌟</div>
        <div>
          <p className="font-medium text-[14px] mb-1">Production-ready print fulfillment</p>
          <p className="text-[13px] text-[#666] leading-[1.65]">Connect <strong>Printful</strong> or <strong>Gelato</strong> to your Stripe checkout for automated print fulfillment. When a customer orders, the print is produced and shipped automatically. See the deployment guide for integration steps.</p>
        </div>
      </div>
    </div>
  )
}
