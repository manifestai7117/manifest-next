'use client'

const HERO_CARDS = [
  { src:'photo-1571019613454-1cb2f99b2d8b', name:'James T.', goal:'Completed first marathon', badge:'3:52 finish', rot:-3, delay:'0s', pos:{top:10,left:10}, w:250, h:320 },
  { src:'photo-1573496359142-b8d87734a5a2', name:'Ariana M.', goal:'Launched her brand', badge:'$10k first month', rot:2.5, delay:'0.4s', pos:{top:30,right:0}, w:230, h:290 },
  { src:'photo-1500648767791-00dcc994a43e', name:'Marcus L.', goal:'Saved first $50k', badge:'4 months early', rot:1, delay:'0.8s', pos:{bottom:10,left:60}, w:210, h:260 },
]

export default function DraggableCards() {
  const startDrag = (e: React.MouseEvent<HTMLDivElement>, rot: number, idx: number) => {
    const el = e.currentTarget
    const parent = el.parentElement!
    const rect = el.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()
    const dx = e.clientX - rect.left
    const dy = e.clientY - rect.top
    el.style.zIndex = '10'
    el.style.transform = 'rotate(0deg) scale(1.02)'
    el.style.animation = 'none'
    el.style.transition = 'transform 0.1s ease'
    el.style.cursor = 'grabbing'
    const move = (ev: MouseEvent) => {
      el.style.left = (ev.clientX - dx - parentRect.left) + 'px'
      el.style.top = (ev.clientY - dy - parentRect.top) + 'px'
      el.style.right = 'auto'
      el.style.bottom = 'auto'
    }
    const up = () => {
      el.style.zIndex = String(3 - idx)
      el.style.transform = `rotate(${rot}deg)`
      el.style.cursor = 'grab'
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  return (
    <div className="relative w-[380px] h-[480px]">
      {HERO_CARDS.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-2xl overflow-hidden shadow-2xl float-anim select-none"
          style={{
            width: p.w, height: p.h, ...p.pos,
            '--r': `${p.rot}deg`,
            transform: `rotate(${p.rot}deg)`,
            animationDelay: p.delay,
            zIndex: 3 - i,
            cursor: 'grab',
            touchAction: 'none',
          } as React.CSSProperties}
          onMouseDown={e => startDrag(e, p.rot, i)}
        >
          <img
            src={`https://images.unsplash.com/${p.src}?w=400&h=500&fit=crop&crop=top`}
            alt=""
            className="w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
          <div className="absolute bottom-3 left-3 right-3 bg-white/92 backdrop-blur-sm rounded-xl p-2.5 pointer-events-none">
            <p className="text-[13px] font-medium">{p.name}</p>
            <p className="text-[11px] text-[#666]">{p.goal}</p>
            <span className="inline-block mt-1 text-[10px] font-medium text-[#b8922a] bg-[#faf3e0] px-2 py-0.5 rounded-full">
              {p.badge}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}