import { useState } from 'react'
import { 
  Box, 
  Button, 
  Typography, 
  Card,
  LinearProgress,
  Alert
} from '@mui/joy'
import { CloudUpload } from '@mui/icons-material'



// Import all shard detectors
import * as subtitle from '../shards/subtitle'
// Future: import * as deck from '../shards/deck'
// Future: import * as book from '../shards/book'

const detectors = [
  { name: 'subtitle', ...subtitle }
  // Future: { name: 'deck', ...deck },
  // Future: { name: 'book', ...book }
]

export const GlobalImport = ({ onConfigure, onCancel }) => {
  const [file, setFile] = useState(null) // eslint-disable-line no-unused-vars
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setProcessing(true)
      detectType(selectedFile)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      setFile(droppedFile)
      setProcessing(true)
      detectType(droppedFile)
    }
  }

  const detectType = async (file) => {
    try {
      const buffer = await file.arrayBuffer()
      
      // Run all detectors
      const results = detectors.map(d => ({
        name: d.name,
        processor: d,
        ...d.detect(file.name, buffer)
      }))
      
      // Pick highest confidence match
      const winner = results.sort((a, b) => b.confidence - a.confidence)[0]
      
      if (!winner?.match || winner.confidence < 0.5) {
        setError('Unsupported file type')
        setProcessing(false)
        return
      }
      
      // Automatically proceed to configuration
      const detectedInfo = {
        file,
        shardType: winner.name,
        metadata: winner.metadata,
        processor: winner.processor,
        filename: file.name
      }
      

      onConfigure?.(detectedInfo)
      
    } catch {
      setError('Failed to analyze file')
      setProcessing(false)
    }
  }



  const handleCancel = () => {
    setFile(null)
    setError(null)
    setProcessing(false)
    onCancel?.()
  }

  return (
    <Box>
      {/* File Drop Zone */}
      {!processing && (
        <Card
          sx={{
            p: 4,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: 'neutral.300',
            cursor: 'pointer',
            '&:hover': { borderColor: 'primary.500' }
          }}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => document.getElementById('file-input').click()}
        >
          <CloudUpload sx={{ fontSize: 48, color: 'neutral.400', mb: 2 }} />
          <Typography level="h4" sx={{ mb: 1 }}>
            Drop file here or click to browse
          </Typography>
          <Typography color="neutral">
            Supports: SRT, VTT subtitle files
          </Typography>
          
          <input
            id="file-input"
            type="file"
            accept=".srt,.vtt,.ass,.ssa,.sub"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </Card>
      )}

      {/* Processing State */}
      {processing && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography level="body-md" sx={{ mb: 2 }}>
            Processing file...
          </Typography>
          <LinearProgress />
        </Box>
      )}

      {/* Error */}
      {error && (
        <Box sx={{ textAlign: 'center' }}>
          <Alert color="danger" sx={{ mb: 3 }}>
            {error}
          </Alert>
          <Button variant="outlined" size="sm" onClick={handleCancel}>
            Try Again
          </Button>
        </Box>
      )}
    </Box>
  )
} 