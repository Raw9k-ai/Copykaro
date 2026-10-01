import { Link } from 'react-router-dom'
import icon from './icon.png'

const PATHS = {
  grid: (<><rect x="4" y="4" width="6" height="6" rx="1.2" /><rect x="14" y="4" width="6" height="6" rx="1.2" /><rect x="4" y="14" width="6" height="6" rx="1.2" /><rect x="14" y="14" width="6" height="6" rx="1.2" /></>),
  atom: (<><circle cx="12" cy="12" r="1.5" /><ellipse cx="12" cy="12" rx="9" ry="3.8" /><ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)" /></>),
  code: <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12" />,
  book: <path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14" />,
  flask: <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />,
  leaf: <path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15M5 19l7-7" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5" />,
  users: (<><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M21 20c0-2.6-1.5-4.8-4-5.6" /></>),
  clock: (<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>),
  download: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  chevron: <path d="M9 6l6 6-6 6" />,
}

export const SUBJECT_ICONS = ['code', 'grid', 'atom', 'book', 'flask', 'leaf']

export function Icon({ name, size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}

export function Logo() {
  return (
    <span className="logo">
      <img className="logo-img" src={icon} alt="" width="38" height="38" />
      <span>Copy<span className="logo-k">Karo</span></span>
    </span>
  )
}

export function Crumbs({ items }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((c, i) =>
        c.to ? (
          <span key={i}><Link to={c.to}>{c.label}</Link><span className="sep">/</span></span>
        ) : (
          <span key={i} className="here">{c.label}</span>
        )
      )}
    </nav>
  )
}

export function Pill({ tone = 'blue', children }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 320 240" aria-hidden="true">
      <ellipse cx="160" cy="214" rx="120" ry="12" fill="#e6edfb" />
      <rect x="50" y="160" width="220" height="40" rx="6" fill="#2563eb" />
      <rect x="62" y="166" width="196" height="6" rx="3" fill="#93b4f5" />
      <rect x="66" y="120" width="190" height="38" rx="6" fill="#f59e0b" />
      <rect x="78" y="126" width="166" height="6" rx="3" fill="#fcd48a" />
      <rect x="82" y="84" width="160" height="34" rx="6" fill="#16a34a" />
      <rect x="94" y="90" width="136" height="6" rx="3" fill="#86e0a8" />
      <path d="M110 66 V90 Q160 110 210 90 V66 Z" fill="#1e3a6e" />
      <path d="M160 22 L252 56 L160 78 L68 56 Z" fill="#0f1f3d" />
      <path d="M252 56 V92" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
      <circle cx="252" cy="96" r="6" fill="#f59e0b" />
    </svg>
  )
}
