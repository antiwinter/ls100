import { useState, useEffect, useRef, useCallback } from 'react'
import { usePageTitle } from '../utils/usePageTitle'
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
import { log } from '../utils/logger'
import { shardApi } from '../shards/shardApi'
import {
  engineGetTag,
  engineGetEditor,
  engineSaveData,
  engineGenCover
} from '../shards/engines.js'


export const EditShard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef(null)

  // Get data passed from navigation state
  const { mode = 'create', detectedInfo = null } = location.state || {}

  // Set dynamic page title based on mode
  usePageTitle(
    mode === 'create' ? 'Create Shard' : 'Edit Shard',
    mode === 'create'
      ? 'Create a new learning shard from your content'
      : 'Edit your learning shard settings and content'
  )

  // Unified shard data structure for both create and edit modes
  const [shardData, _setShardData] = useState({
    name: '',
    description: '',
    cover: null,
    meta: {}
  })
  const [transientData, setTransientData] = useState(null) // Transient data not persisted

  // Helper to normalize shard data with fallbacks
  const setShardData = (shard) => {
    _setShardData({
      id: shard.id,
      name: shard.name || '',
      description: shard.description || '',
      cover: shard.cover || null,
      type: shard.type || null,
      public: shard.public !== undefined ? shard.public : false, // Default to private
      meta: shard.meta || {}
    })
  }
  const [saving, setSaving] = useState(false)
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false)
  const [showCoverDialog, setShowCoverDialog] = useState(false)
  const [coverUrl, setCoverUrl] = useState('')
  const engineValid = useRef(false)
  const [draftShardId, setDraftShardId] = useState(null)

  // Get shard data from navigation or URL
  const navigationShardData = location.state?.shardData
  const shardId = navigationShardData?.id || draftShardId

  useEffect(() => {
    const init = async () => {
      if (mode === 'create' && detectedInfo) {
        // Create mode: create draft shard immediately to get valid ID
        const defaultName = detectedInfo?.metadata?.suggestedName ||
                           detectedInfo?.filename?.replace(/\.[^/.]+$/, '') ||
                           'New Shard'

        const draftId = await shardApi.create({
          name: '__draft__',
          description: '',
          type: detectedInfo.shardType,
          public: false,
          meta: {}
        })

        setDraftShardId(draftId)
        log.info('✅ Created draft shard:', draftId)

        setShardData({
          id: draftId,
          name: defaultName,
          description: '',
          type: detectedInfo.shardType,
          public: false,
          meta: {}
        })
      } else if (mode === 'edit' && navigationShardData) {
        try {
          log.info('📝 Edit mode - loading shard details for ID:', navigationShardData.id)

          // Load from local store with BE fallback
          const shard = await shardApi.read(navigationShardData.id)

          if (!shard) {
            log.error('❌ Shard not found:', navigationShardData.id)
            setShardData(navigationShardData)
            return
          }

          log.info('🔍 Loaded shard data:', shard)
          setShardData(shard)

          // Mark engine as valid for existing shards (already have valid data)
          engineValid.current = true
        } catch (error) {
          log.error('❌ Failed to fetch shard details:', error)
          setShardData(navigationShardData)
        }
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])  // Only run once on mount

  const handleSave = async () => {
    setSaving(true)
    try {
      log.info('💾 Saving shard data:', shardData)

      if (shardData.cover?.startsWith('http')) {
        // User pasted HTTP URL - fetch and store now
        log.info('📥 Fetching cover from URL:', shardData.cover)
        const response = await fetch(shardData.cover)
        if (!response.ok) {
          throw new Error(`Failed to fetch cover: ${response.statusText}`)
        }
        shardData.coverFile = await response.blob()
        log.info('✅ Cover stored:', shardData.cover)
      }

      if (shardData.coverFile) {
        const nvId = await shardApi.addFile(
          shardId,
          shardData.coverFilename || shardData.cover, // keep original filename or url
          shardData.coverFile
        )
        shardData.cover = `/oss/${nvId}`
        delete shardData.coverFile
        delete shardData.coverFilename
        log.info('✅ Cover stored:', nvId)
      }

      // Process uploads and prepare shardData (pass transient data separately)
      await engineSaveData(shardData, transientData)

      // Update shard (both create and edit modes update the existing shard)
      await shardApi.update(shardId, shardData)
      log.info('✅ Shard saved:', shardId)

      // Navigate back to home
      navigate('/')
    } catch (error) {
      log.error('Failed to save shard:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleBack = async () => {
    // Clean up draft shard on cancel
    if (mode === 'create' && draftShardId) {
      try {
        await shardApi.delete(draftShardId)
        log.info('🗑️ Deleted draft shard:', draftShardId)
      } catch (error) {
        log.warn('Failed to delete draft shard:', error)
      }
    }
    navigate('/')
  }

  const handleCoverUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    _setShardData(prev => ({ ...prev, cover: url, coverFile: file, coverFilename: file.name }))
    setShowCoverDialog(false)
  }

  const handleCoverUrl = () => {
    const url = coverUrl.trim()
    if (!url) return

    // Just set the URL directly, fetch on save
    _setShardData(prev => ({ ...prev, cover: url }))
    setCoverUrl('')
    setShowCoverDialog(false)
  }

  const resetCover = () => {
    _setShardData(prev => ({ ...prev, cover: null, coverFile: null }))
    setShowCoverDialog(false)
  }

  // Separate handlers for persistent meta and transient data
  const handleMetaChange = useCallback((metaUpdates) => {
    _setShardData(x => ({
      ...x,
      meta: { ...x.meta, ...metaUpdates }
    }))
    engineValid.current = true
  }, [])

  const handleDataChange = useCallback((data) => {
    setTransientData(data)
  }, [])

  const getShardTypeDisplayInfo = () => {
    // Get type info from current shardData
    return shardData.type ? engineGetTag(shardData.type) : { displayName: 'Unknown', color: '#666' }
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
          sx={{ border: 'none' }}
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
                value={shardData.name}
                onChange={(e) => _setShardData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter shard name"
                size="sm"
                sx={{ mb: 0.5 }}
              />
              {/* Description - tightly coupled with name input */}
              {shardData.description ? (
                <Typography level="body-sm" component="div">
                  {shardData.description}{' '}
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

          {/* Cover Preview */}
          <Box>
            <Typography level="body-sm" sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}>
              Preview
            </Typography>
            <Box
              sx={{
                width: 90,
                height: 100,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider'
              }}
              onClick={() => setShowCoverDialog(true)}
            >
              {shardData.cover ? (
                <img
                  src={shardData.cover}
                  alt="Cover preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 8
                  }}
                />
              ) : (
                shardData.type ? (
                  engineGenCover(shardData)
                ) : (
                  <Box sx={{
                    fontSize: '11px',
                    color: 'text.tertiary',
                    textAlign: 'center'
                  }}>
                    No Preview
                  </Box>
                )
              )}
            </Box>
          </Box>

          {/* Shard-Specific Configuration */}
          <Box>
            {(() => {
              const EditorComponent = engineGetEditor(shardData.type)

              if (!EditorComponent) {
                return (
                  <Typography level="body-sm" color="warning">
                    No editor available for {shardData.type} shards
                  </Typography>
                )
              }

              return (
                <EditorComponent
                  mode={mode}
                  shard={shardData}
                  detectedInfo={detectedInfo}
                  onMetaChange={handleMetaChange}
                  onDataChange={handleDataChange}
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
          disabled={!shardData.name.trim() || !engineValid.current}
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
            value={shardData.description}
            onChange={(e) => _setShardData(prev => ({ ...prev, description: e.target.value }))}
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
        title="Shard Cover"
        maxWidth={400}
      >
        <Stack spacing={2}>
          <Typography level="body-sm">
            Upload an image or paste a URL for your shard cover
          </Typography>

          <Stack spacing={1}>
            <Button
              startDecorator={<Upload />}
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Image
            </Button>

            <Stack direction="row" spacing={1}>
              <Input
                placeholder="Or paste image URL..."
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                size="sm"
                sx={{ flex: 1 }}
              />
              <Button
                size="sm"
                startDecorator={<LinkIcon />}
                onClick={handleCoverUrl}
                disabled={!coverUrl.trim()}
              >
                Set
              </Button>
            </Stack>

            {shardData.cover && (
              <Button
                variant="outlined"
                color="danger"
                size="sm"
                onClick={resetCover}
              >
                Reset to Generated
              </Button>
            )}
          </Stack>
        </Stack>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleCoverUpload}
        />
      </AppDialog>
    </Box>
  )
}
