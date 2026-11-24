import { useState } from 'react'
import { getSectorImage } from './sectorImages.js'

export default function SectorImage({ groupId, topic }) {
  const asset = getSectorImage(groupId, topic)
  const [failedSource, setFailedSource] = useState(null)
  const available = asset && failedSource !== asset.src
  const imageBase = asset?.src.slice(0, -4)
  const sizes = `auto, (max-width: ${topic ? 480 : 380}px) 300vw, (max-width: 840px) 150vw, (max-width: 1150px) 100vw, 75vw`
  const column = (asset?.cell ?? 0) % 3
  const row = Math.floor((asset?.cell ?? 0) / 3)
  return <span className="central-card-photo" aria-hidden="true">
    <span className="central-image-fallback"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></svg></span>
    {available && <picture>
      <source type="image/webp" srcSet={`${imageBase}-960.webp 960w, ${imageBase}.webp 1536w`} sizes={sizes} />
      <img src={asset.src} alt="" width="1536" height="1024" loading="lazy" decoding="async" style={{ left: `-${column * 100}%`, transform: `translateY(-${(row + .5) / 3 * 100}%)` }} onError={() => setFailedSource(asset.src)} />
    </picture>}
  </span>
}
