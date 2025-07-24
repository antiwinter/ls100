import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  Box, 
  Typography, 
  Stack, 
  Input, 
  Textarea, 
  Button,
  Chip,
  IconButton,
  Link
} from '@mui/joy'
import { ArrowBack, Upload, Link as LinkIcon } from '@mui/icons-material'
import { AppDialog } from '../components/AppDialog'
import { apiCall } from '../config/api'
import { 
  getSuggestedName, 
  getShardTypeInfo, 
  createShard, 
  getEditorComponent 
} from '../shards/engines.js'

export const EditShard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get data passed from navigation state
  const { mode = 'create', shardData = null, detectedInfo = null } = location.state || {}
  

  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })
  const [shardSpecificData, setShardSpecificData] = useState({})
  const [saving, setSaving] = useState(false)
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false)
  const [showCoverDialog, setShowCoverDialog] = useState(false)

  // Initialize form data based on mode
  useEffect(() => {
    if (mode === 'create' && detectedInfo) {

      
      // Use engine-specific suggested name
      const defaultName = getSuggestedName(detectedInfo)
      
      
      setFormData({
        name: defaultName,
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
      

      
      if (mode === 'create' && detectedInfo) {
        // Create new shard with engine-specific logic
        const shard = await createShard(detectedInfo)
        
        // Update shard with user-configured data
        const updateData = {
          name: completeData.name,
          description: completeData.description,
        }
        
        // Only save cover_url if user has configured a custom cover
        if (completeData.cover && completeData.cover.type !== 'generated') {
          updateData.cover_url = completeData.cover.url
        } else {
          updateData.cover_url = null // Use dynamic generation
        }
        
        const updatedShard = await apiCall(`/api/shards/${shard.id}`, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        })
        

      } else if (mode === 'edit' && shardData) {
        // Update existing shard
        await apiCall(`/api/shards/${shardData.id}`, {
          method: 'PUT',
          body: JSON.stringify(completeData)
        })
        

      }
      
      // Navigate back to home
      navigate('/')
    } catch (error) {
      console.error('Failed to save shard:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    navigate('/')
  }

  const getShardTypeDisplayInfo = () => {
    // Get type info based on detected type or existing shard
    if (mode === 'create' && detectedInfo) {
      return getShardTypeInfo(detectedInfo.shardType)
    } else if (mode === 'edit' && shardData) {
      return getShardTypeInfo(shardData.type)
    }
    return { displayName: 'Unknown', color: '#666' }
  }

  const shardTypeInfo = getShardTypeDisplayInfo()

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.body' }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2, 
        p: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.surface'
      }}>
        <IconButton
          variant="outlined"
          color="neutral"
          size="sm"
          onClick={handleBack}
          sx={{ borderRadius: '50%' }}
        >
          <ArrowBack />
        </IconButton>
        <Typography level="h3" sx={{ fontWeight: 'bold' }}>
          {mode === 'create' ? 'Create a Shard' : 'Edit Shard'}
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ 
        maxWidth: 600, 
        mx: 'auto', 
        p: 3,
        pb: 8,  // Extra bottom padding for mobile
        overflowX: 'hidden'  // Hide horizontal scroll
      }}>
        <Stack spacing={3}>
          {/* Generic Shard Configuration */}
          <Stack spacing={2}>
            {/* Shard Name with Type Tag and Description */}
            <Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                  Name
                </Typography>
                <Chip 
                  variant="soft"
                  size="sm"
                  sx={{ 
                    bgcolor: `${shardTypeInfo.color}15`,
                    color: shardTypeInfo.color,
                    fontWeight: 'medium'
                  }}
                >
                  {shardTypeInfo.displayName}
                </Chip>
              </Stack>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter shard name"
                size="sm"
                sx={{ mb: 0.5 }}
              />
              {/* Description - tightly coupled with name input */}
              {formData.description ? (
                <Typography level="body-sm" component="div">
                  {formData.description}{' '}
                  <Link 
                    component="button"
                    level="body-sm" 
                    onClick={() => setShowDescriptionDialog(true)}
                  >
                    edit
                  </Link>
                </Typography>
              ) : (
                <Link 
                  component="button"
                  level="body-sm" 
                  onClick={() => setShowDescriptionDialog(true)}
                >
                  Add description
                </Link>
              )}
            </Box>
          </Stack>

          {/* Shard-Specific Configuration */}
          <Box>
            {(() => {
              const shardType = mode === 'create' ? detectedInfo?.shardType : shardData?.type
              const EditorComponent = getEditorComponent(shardType)
              
              if (!EditorComponent) {
                return (
                  <Typography level="body-sm" color="warning">
                    No editor available for {shardType} shards
                  </Typography>
                )
              }
              
              return (
                <EditorComponent
                  mode={mode}
                  shardData={shardData}
                  detectedInfo={detectedInfo}
                  onChange={setShardSpecificData}
                  onCoverClick={() => setShowCoverDialog(true)}
                />
              )
            })()}
          </Box>
        </Stack>
      </Box>

      {/* Fixed Action Bar */}
      <Box sx={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        p: 2,
        bgcolor: 'background.surface',
        borderTop: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 2
      }}>
        <Button 
          variant="outlined" 
          size="sm" 
          onClick={handleBack}
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
      </Box>

      {/* Description Dialog */}
      <AppDialog
        open={showDescriptionDialog}
        onClose={() => setShowDescriptionDialog(false)}
        title="Shard Description"
        maxWidth={500}
      >
        <Stack spacing={2}>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe this learning content..."
            minRows={3}
            maxRows={6}
            size="sm"
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button 
              variant="outlined" 
              size="sm" 
              onClick={() => setShowDescriptionDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={() => setShowDescriptionDialog(false)}
            >
              Save
            </Button>
          </Box>
        </Stack>
      </AppDialog>

      {/* Cover Dialog */}
      <AppDialog
        open={showCoverDialog}
        onClose={() => setShowCoverDialog(false)}
        title="Cover Image"
        maxWidth={400}
      >
        <Stack spacing={2}>
          <Typography level="body-sm">
            Upload a custom image or provide a URL for the shard cover.
          </Typography>
          
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="sm"
              startDecorator={<Upload />}
              sx={{ flex: 1 }}
            >
              Upload Image
            </Button>
            <Button
              variant="outlined"
              size="sm"
              startDecorator={<LinkIcon />}
              sx={{ flex: 1 }}
            >
              Use URL
            </Button>
          </Stack>
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button 
              variant="outlined" 
              size="sm" 
              onClick={() => setShowCoverDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={() => setShowCoverDialog(false)}
            >
              Save
            </Button>
          </Box>
        </Stack>
      </AppDialog>
    </Box>
  )
} 