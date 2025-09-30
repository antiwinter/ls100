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

function _reg(x, y) {
  let [_x, _y] = [`https://${x}`, `http://localhost:${y}`]
  proxy.register(_x, _y)
  console.log(`Registered ${_x} → ${_y}`)
}
// Route frontend
_reg(machineIP, 5173)
_reg(`${machineIP}/api`, '3001/api')

_reg('localhost', 5173)
_reg(`localhost/api`, '3001/api')