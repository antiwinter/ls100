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
import { ArrowBack, Upload } from '@mui/icons-material'
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
  const inputShard = location.state?.shard

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
  const [draft, setDraft] = useState(null)

  const [transientData, setTransientData] = useState(null) // Transient data not persisted
  const [saving, setSaving] = useState(false)
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false)
  const [showCoverDialog, setShowCoverDialog] = useState(false)

  const baseDraft = useRef(null)
  const isModified = useRef(false)
  const fileInputRef = useRef(null)
  const uploadRef = useRef(null) // { file, filename } for pending upload
  const originalCoverRef = useRef(null) // Track original cover for deletion

  useEffect(() => {
    if (typeof draft !== 'object') return

    const coming = JSON.stringify(draft)
    if (!baseDraft.current) {
      baseDraft.current = coming
      originalCoverRef.current = draft.cover
    }
    else if (baseDraft.current !== coming)
      isModified.current = true
  }, [draft])

  useEffect(() => {
    const init = async () => {
      log.info('🚀 EditShard init:', { mode, hasDetectedInfo: !!detectedInfo, hasNavigationDraft: !!inputShard })

      if (mode === 'create' && detectedInfo) {
        // Create mode: create draft shard immediately to get valid ID
        const defaultName = detectedInfo?.metadata?.suggestedName ||
                           detectedInfo?.filename?.replace(/\.[^/.]+$/, '') ||
                           'New Shard'

        const d = await shardApi.create({
          name: '__draft__',
          type: detectedInfo.shardType
        })

        setDraft({
          ...d,
          name: defaultName
        })
      } else if (mode === 'edit' && inputShard) {
        try {
          log.info('📝 Edit mode - loading shard details for ID:', inputShard.id)

          // Load from local store with BE fallback
          const d = await shardApi.read(inputShard.id)

          if (!d) {
            log.error('❌ Shard not found:', inputShard)
            setDraft('error')
            return
          }

          log.info('🔍 Loaded shard data:', d)
          setDraft(d)
        } catch (error) {
          log.error('❌ Failed to fetch shard details:', error)
          setDraft('error')
        }
      } else {
        log.warn('⚠️ Init skipped - unhandled case')
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])  // Only run once on mount

  const handleSave = async () => {
    setSaving(true)
    try {
      log.info('💾 Saving shard:', draft)

      // Delete old cover if changed
      const old = originalCoverRef.current
      if (old?.startsWith('/oss/') && old !== draft.cover) {
        const nvid = old.replace('/oss/', '')
        await shardApi.deleteFile(draft.id, nvid)
        log.info('🗑️ Deleted old cover:', nvid)
      }

      // Handle new cover upload
      let cover = draft.cover
      let { blob, filename } = uploadRef.current || {}

      if (cover?.startsWith('http')) {
        // Fetch HTTP URL and upload
        log.info('📥 Fetching cover from URL:', draft.cover)
        const response = await fetch(draft.cover)
        if (!response.ok) {
          throw new Error(`Failed to fetch cover: ${response.statusText}`)
        }
        blob = await response.blob()
        filename = cover
      }

      if (blob) {
        const nvid = await shardApi.addFile(draft.id, filename, blob)
        cover = `/oss/${nvid}`
      }

      // Process engine data
      await engineSaveData(draft, transientData)

      // Update shard
      await shardApi.update(draft.id, { ...draft, cover })
      log.info('✅ Shard saved:', draft.id)

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
    if (mode === 'create' && draft?.id) {
      try {
        await shardApi.delete(draft?.id)
        log.info('🗑️ Deleted draft shard:', draft)
      } catch (error) {
        log.warn('Failed to delete draft shard:', error)
      }
    }
    navigate('/')
  }

  const handleCoverUpload = (e) => {
    const blob = e.target.files?.[0]
    if (!blob) return

    uploadRef.current = { blob, filename: blob.name }
    setDraft(d => ({ ...d, cover: URL.createObjectURL(blob) }))
    setShowCoverDialog(false)
  }

  const resetCover = () => {
    uploadRef.current = null
    setDraft(d => ({ ...d, cover: null }))
    setShowCoverDialog(false)
  }

  // Separate handlers for persistent meta and transient data
  const handleMetaChange = useCallback((metaUpdates) => {
    setDraft(d => ({
      ...d,
      meta: { ...d.meta, ...metaUpdates }
    }))
  }, [])

  const handleDataChange = useCallback((data) => {
    setTransientData(data)
  }, [])

  const getShardTypeDisplayInfo = () => {
    // Get type info from current draft
    return draft?.type ? engineGetTag(draft.type) : { displayName: 'Unknown', color: '#666' }
  }

  const shardTypeInfo = getShardTypeDisplayInfo()

  // Error state
  if (draft === 'error') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack spacing={2} alignItems="center">
          <Typography level="h4" color="danger">Failed to load shard</Typography>
          <Button variant="outlined" onClick={handleBack}>Go Back</Button>
        </Stack>
      </Box>
    )
  }

  // Loading state
  if (!draft) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography level="body-lg">Loading...</Typography>
      </Box>
    )
  }

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
                value={draft.name}
                onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="Enter shard name"
                size="sm"
                sx={{ mb: 0.5 }}
              />
              {/* Description - tightly coupled with name input */}
              {draft.description ? (
                <Typography level="body-sm" component="div">
                  {draft.description}{' '}
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
              {draft.cover ? (
                <img
                  src={draft.cover}
                  alt="Cover preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 8
                  }}
                />
              ) : (
                draft.type ? (
                  engineGenCover(draft)
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
              log.info('🎯 EditShard render editor:', { type: draft.type, mode, draft })
              const EditorComponent = engineGetEditor(draft.type)
              log.info('🔍 EditorComponent:', EditorComponent)

              if (!EditorComponent) {
                log.warn('⚠️ No editor available for type:', draft.type)
                return (
                  <Typography level="body-sm" color="warning">
                    No editor available for {draft.type} shards
                  </Typography>
                )
              }
              if (!draft?.id) {
                log.debug('shard not ready, skip loading compoennt editor')
                return
              }

              log.info('✅ Rendering editor:', { mode, draft, hasDetectedInfo: !!detectedInfo })
              return (
                <EditorComponent
                  mode={mode}
                  shard={draft}
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
          disabled={!draft.name.trim() || !isModified.current}
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
            value={draft.description}
            onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
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
                value={draft.cover}
                onChange={(e) => setDraft(d => ({ ...d, cover: e.target.value }))}
                size="sm"
                sx={{ flex: 1 }}
              />
            </Stack>

            {draft.cover && (
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
