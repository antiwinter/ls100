const {Redbird} = require('redbird')
const fs = require('fs')
const { networkInterfaces } = require('os')

// Auto-detect current machine IP
function getMachineIP() {
  const nets = networkInterfaces()
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (localhost) addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  
  return 'localhost' // Fallback if no external IP found
}

const machineIP = getMachineIP()

const proxy = new Redbird({
  port: 443, // HTTPS port
  secure: false, // Allow HTTP backends
  ssl: {
    port: 443,
    key: fs.readFileSync('./ca-key.pem'),
    cert: fs.readFileSync('./ca.pem')
  }
})

// Route frontend
proxy.register(machineIP, 'http://localhost:5173')
// Route API (with /api prefix or subdomain)
proxy.register(`${machineIP}/api`, 'http://localhost:3001/api')

console.log('🚀 HTTPS Proxy running:')
console.log(`  Frontend: https://${machineIP}/ → http://localhost:5173`)
console.log(`  API: https://${machineIP}/api → http://localhost:3001`)
