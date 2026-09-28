import { NavLink, Link, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Subject from './pages/Subject'
import Topic from './pages/Topic'
import Saved from './pages/Saved'

export default function App() {
  return (
    <>
      <header className="bar-top">
        <div className="bar-inner">
          <Link to="/" className="wordmark">Copykaro</Link>
          <nav>
            <NavLink to="/" end>Subjects</NavLink>
            <NavLink to="/saved">My study</NavLink>
          </nav>
        </div>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/subject/:id" element={<Subject />} />
          <Route path="/topic/:id" element={<Topic />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="*" element={<p>Page not found. <Link to="/">Go to subjects</Link></p>} />
        </Routes>
      </main>
    </>
  )
}
