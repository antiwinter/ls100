import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // In production, API is on same origin. In dev, use localhost:3001
    const apiUrl = import.meta.env.PROD 
      ? '/api/hello' 
      : 'http://localhost:3001/api/hello';
      
    fetch(apiUrl)
      .then(res => res.json())
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="loading">Loading...</div>
  if (error) return <div className="error">Error: {error}</div>

  return (
    <div className="App">
      <header className="App-header">
        <h1>LS100 - Full Stack App</h1>
        <div className="backend-data">
          <h2>Data from Backend:</h2>
          <div className="data-card">
            <p><strong>Message:</strong> {data?.message}</p>
            <p><strong>Server:</strong> {data?.server}</p>
            <p><strong>Environment:</strong> {data?.env}</p>
            <p><strong>Timestamp:</strong> {data?.timestamp}</p>
          </div>
        </div>
      </header>
    </div>
  )
}

export default App
