import { useState } from 'react'
import { 
  Box, 
  Button, 
  Typography, 
  Card,
  LinearProgress,
  Stack,
  Alert
} from '@mui/joy'
import { CloudUpload, CheckCircle, Error } from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'

// Import all shard detectors
import * as subtitle from '../shards/subtitle'
// Future: import * as deck from '../shards/deck'
// Future: import * as book from '../shards/book'

const detectors = [
  { name: 'subtitle', ...subtitle }
  // Future: { name: 'deck', ...deck },
  // Future: { name: 'book', ...book }
]

export const GlobalImport = ({ onComplete, onCancel }) => {
  const { user } = useAuth()
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [detected, setDetected] = useState(null)
  const [error, setError] = useState(null)

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      detectType(selectedFile)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      setFile(droppedFile)
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
      
      setDetected(winner)
      setError(null)
    } catch (err) {
      setError('Failed to analyze file')
      setDetected(null)
    }
  }

  const handleUpload = async () => {
    if (!detected || !file) return
    
    if (detected.confidence < 0.5) {
      setError('Unsupported file type')
      return
    }

    setUploading(true)
    setError(null)
    
    try {
      const shard = await detected.processor.createShard(file, user)
      onComplete(shard)
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    setFile(null)
    setDetected(null)
    setError(null)
    onCancel?.()
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography level="h2" sx={{ mb: 3 }}>
        Upload Learning Content
      </Typography>

      {/* File Drop Zone */}
      {!file && (
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

      {/* File Info & Detection Results */}
      {file && detected && (
        <Card sx={{ p: 3, mb: 3 }}>
          <Stack spacing={2}>
            <Typography level="h4">📁 {file.name}</Typography>
            
            {detected.match ? (
              <Alert color="success" startDecorator={<CheckCircle />}>
                Detected as: {detected.name} (confidence: {Math.round(detected.confidence * 100)}%)
              </Alert>
            ) : (
              <Alert color="warning" startDecorator={<Error />}>
                Unsupported file type
              </Alert>
            )}
            
            {detected.metadata && (
              <Box>
                <Typography level="body-sm" color="neutral">
                  Movie: {detected.metadata.movieName}
                </Typography>
                <Typography level="body-sm" color="neutral">
                  Language: {detected.metadata.language}
                </Typography>
                {detected.metadata.year && (
                  <Typography level="body-sm" color="neutral">
                    Year: {detected.metadata.year}
                  </Typography>
                )}
              </Box>
            )}
          </Stack>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert color="danger" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Upload Progress */}
      {uploading && (
        <Box sx={{ mb: 3 }}>
          <Typography level="body-sm" sx={{ mb: 1 }}>
            Creating shard...
          </Typography>
          <LinearProgress />
        </Box>
      )}

      {/* Actions */}
      {file && (
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button variant="outlined" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload}
            disabled={!detected?.match || uploading}
            loading={uploading}
          >
            Create Shard
          </Button>
        </Stack>
      )}
    </Box>
  )
} 