import { useState } from 'react'
import { getSectorImage } from './sectorImages.js'

export default function SectorImage({ groupId, topic }) {
  const asset = getSectorImage(groupId, topic)
  const [failedSource, setFailedSource] = useState(null)
  const available = asset && failedSource !== asset.src
  const column = (asset?.cell ?? 0) % 3
  const row = Math.floor((asset?.cell ?? 0) / 3)
  return <span className="central-card-photo" aria-hidden="true">
    <span className="central-image-fallback"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></svg></span>
    {available && <img src={asset.src} alt="" width="1536" height="1024" loading="lazy" decoding="async" style={{ left: `-${column * 100}%`, transform: `translateY(-${(row + .5) / 3 * 100}%)` }} onError={() => setFailedSource(asset.src)} />}
  </span>
}
