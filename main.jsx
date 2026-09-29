import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, NavLink, Link, Route, Routes, useLocation } from 'react-router-dom'
import './styles.css'
import './extra.css'
import { supabase, useAuthCtx, AuthProvider } from './lib'
import { Logo } from './ui'
import { Home } from './home'
import { Subject, Saved } from './subject'
import { Topic } from './topic'
import { Login, Contribute } from './staff'
import { Admin } from './admin'

function App() {
  const auth = useAuthCtx()
  const { pathname } = useLocation()
  const staff = auth.role === 'contributor' || auth.role === 'admin'
  const onStaffPage = staff && (pathname.startsWith('/contribute') || pathname.startsWith('/admin'))

  const routes = (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/subject/:id" element={<Subject />} />
      <Route path="/topic/:id" element={<Topic />} />
      <Route path="/saved" element={<Saved />} />
      <Route path="/login" element={<Login />} />
      <Route path="/contribute" element={<Contribute />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<p>Page not found. <Link to="/">Go to subjects</Link></p>} />
    </Routes>
  )

  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link to="/" className="brand"><Logo /></Link>
          <nav className="topnav">
            <NavLink to="/" end>Subjects</NavLink>
            <NavLink to="/saved">My study</NavLink>
          </nav>
          {staff
            ? <NavLink className="btn small" to={auth.role === 'admin' ? '/admin' : '/contribute'}>Dashboard</NavLink>
            : <Link className="btn small primary" to="/login">Contributor login</Link>}
        </div>
      </header>

      {onStaffPage ? (
        <div className="staff-layout">
          <aside className="side">
            <NavLink to="/contribute">Upload notes</NavLink>
            {auth.role === 'admin' && <NavLink to="/admin">Review</NavLink>}
            <Link to="/">View site</Link>
            <button className="linkbtn" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </aside>
          <main className="staff-main">{routes}</main>
        </div>
      ) : (
        <main className="page">{routes}</main>
      )}

      <footer className="foot">
        <span>Copykaro, syllabus notes reviewed by an admin.</span>
        {auth.user && !onStaffPage && <button className="linkbtn" onClick={() => supabase.auth.signOut()}>Sign out</button>}
      </footer>
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
