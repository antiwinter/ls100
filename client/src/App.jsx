import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { CssVarsProvider } from '@mui/joy'
import theme from './theme'
import Home from './pages/Home'
import Demo from './pages/Demo'

function App() {
  return (
    <CssVarsProvider 
      theme={theme}
      defaultMode="system"
      modeStorageKey="ls100-mode"
      colorSchemeStorageKey="ls100-color-scheme"
    >
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/demo" element={<Demo />} />
        </Routes>
      </Router>
    </CssVarsProvider>
  )
}

export default App
