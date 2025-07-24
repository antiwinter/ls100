import { useState, useEffect } from 'react'
import { 
  Box, 
  Typography, 
  Stack, 
  Input, 
  Textarea, 
  Button,
  Chip
} from '@mui/joy'
import { AppDialog } from './AppDialog'
import { SubtitleShardEditor, shardTypeInfo as subtitleTypeInfo } from '../shards/subtitle'

export const EditShardDialog = ({ 
  open, 
  onClose, 
  mode = 'create', // 'create' | 'edit'
  shardData = null, // for edit mode
  detectedInfo = null, // for create mode (from GlobalImport)
  onSave
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    // Shard-specific data will be managed by child components
  })
  const [shardSpecificData, setShardSpecificData] = useState({})
  const [saving, setSaving] = useState(false)

  // Initialize form data based on mode
  useEffect(() => {
    if (mode === 'create' && detectedInfo) {
      setFormData({
        name: detectedInfo.metadata?.movie_name || 'Untitled Shard',
        description: ''
      })
    } else if (mode === 'edit' && shardData) {
      setFormData({
        name: shardData.name || '',
        description: shardData.description || ''
      })
    }
  }, [mode, detectedInfo, shardData])

  const handleSave = async () => {
    setSaving(true)
    try {
      const completeData = {
        ...formData,
        ...shardSpecificData
      }
      await onSave(completeData)
      onClose()
    } catch (error) {
      console.error('Failed to save shard:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    onClose()
  }

  const getShardTypeInfo = () => {
    // For now, handle subtitle type, can be extended for other types
    if (mode === 'create' && detectedInfo?.shardType === 'subtitle') {
      return subtitleTypeInfo
    } else if (mode === 'edit' && shardData?.type === 'subtitle') {
      return subtitleTypeInfo
    }
    return { displayName: 'Unknown', color: '#666' }
  }

  const shardTypeInfo = getShardTypeInfo()

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Create a Shard' : 'Edit Shard'}
      maxWidth={600}
    >
      <Stack spacing={3}>
        {/* Shard Type Tag */}
        <Box>
          <Chip 
            variant="soft"
            sx={{ 
              bgcolor: `${shardTypeInfo.color}15`,
              color: shardTypeInfo.color,
              fontWeight: 'medium'
            }}
          >
            {shardTypeInfo.displayName}
          </Chip>

        </Box>

        {/* Generic Shard Configuration */}
        <Stack spacing={2}>
          {/* Shard Name */}
          <Box>
            <Typography level="body-sm" sx={{ mb: 1 }}>
              Shard Name
            </Typography>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter shard name"
              size="sm"
            />
          </Box>

          {/* Shard Description */}
          <Box>
            <Typography level="body-sm" sx={{ mb: 1 }}>
              Shard Description
            </Typography>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe this learning content..."
              minRows={2}
              maxRows={4}
              size="sm"
            />
          </Box>
        </Stack>

        {/* Shard-Specific Configuration */}
        <Box>
          {(detectedInfo?.shardType === 'subtitle' || shardData?.type === 'subtitle') && (
            <SubtitleShardEditor
              mode={mode}
              shardData={shardData}
              detectedInfo={detectedInfo}
              onChange={setShardSpecificData}
            />
          )}
        </Box>

        {/* Action Buttons */}
        <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
          <Button 
            variant="outlined" 
            size="sm" 
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button 
            size="sm"
            onClick={handleSave}
            loading={saving}
            disabled={!formData.name.trim()}
          >
            {mode === 'create' ? 'Create Shard' : 'Save Changes'}
          </Button>
        </Stack>
      </Stack>
    </AppDialog>
  )
} 