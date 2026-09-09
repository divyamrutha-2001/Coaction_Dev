import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TopNav from './components/TopNav'
import Dashboard from './pages/Dashboard'
import ApiLibrary from './pages/ApiLibrary'
import Upload from './pages/Upload'
import Download from './pages/Download'
import Tags from './pages/Tags'
import Access from './pages/Access'
import Usage from './pages/Usage'
import PolicyTrace from './pages/PolicyTrace'
import Direction2Demo from './pages/Direction2Demo'

const queryClient = new QueryClient()

export default function App() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <Router>
          <div className="min-h-screen bg-background">
            <TopNav />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/api-library" element={<ApiLibrary />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/download" element={<Download />} />
                <Route path="/tags" element={<Tags />} />
                <Route path="/access" element={<Access />} />
                <Route path="/usage" element={<Usage />} />
                <Route path="/trace" element={<PolicyTrace />} />
                <Route path="/direction2" element={<Direction2Demo />} />
              </Routes>
            </main>
          </div>
        </Router>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
