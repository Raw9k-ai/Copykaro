import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, NavLink, Link, Route, Routes } from 'react-router-dom'
import './styles.css'
import './extra.css'
import { supabase, useAuthCtx, AuthProvider } from './lib'
import { Home, Subject, Saved } from './home'
import { Topic } from './topic'
import { Login, Contribute } from './staff'
import { Admin } from './admin'

function App() {
  const auth = useAuthCtx()
  const staff = auth.role === 'contributor' || auth.role === 'admin'
  return (
    <>
      <header className="bar-top">
        <div className="bar-inner">
          <Link to="/" className="wordmark">Copykaro</Link>
          <nav>
            <NavLink to="/" end>Subjects</NavLink>
            <NavLink to="/saved">My study</NavLink>
            {staff && <NavLink to="/contribute">Upload</NavLink>}
            {auth.role === 'admin' && <NavLink to="/admin">Review</NavLink>}
          </nav>
        </div>
      </header>
      <main className="page">
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
        <footer className="foot">
          {auth.user
            ? <button className="linkbtn" onClick={() => supabase.auth.signOut()}>Sign out</button>
            : <Link to="/login">Contributor login</Link>}
        </footer>
      </main>
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
