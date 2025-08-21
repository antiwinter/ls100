import { useMemo } from 'react'
import {
  Stack,
  Typography,
  RadioGroup,
  Radio,
  Slider,
  Chip,
  Sheet,
  Switch
} from '@mui/joy'
import { useSettingStore } from './stores/useSettingStore'
import { useSessionStore } from './stores/useSessionStore'
import { fontStack } from '../../utils/font'

export const FontContent = ({ shardId }) => {
  const { fontSize, fontFamily, setFontSize, setFontFamily } = useSettingStore('subtitle-shard')()

  // Get session store data
  const sessionStore = useSessionStore(shardId)
  const { langMap, toggleLang } = sessionStore()

  // Extract current font mode from fontFamily
  const currentMode = useMemo(() => {
    if (fontFamily.includes('serif')) return 'serif'
    if (fontFamily.includes('monospace')) return 'mono'
    return 'sans'
  }, [fontFamily])

  const marks = useMemo(
    () => [
      { value: 12, label: '12' },
      { value: 16, label: '16' },
      { value: 20, label: '20' },
      { value: 24, label: '24' }
    ],
    []
  )

  // Get ref languages from langMap (plain object)
  const refLanguages = useMemo(
    () =>
      Object.entries(langMap || {}).map(([code, data]) => ({
        code,
        ...data
      })),
    [langMap]
  )

  return (
    <Stack spacing={2} sx={{ px: 1, pb: 1 }}>
      <Typography level='title-sm'>Font</Typography>
      <RadioGroup
        orientation='horizontal'
        value={currentMode}
        onChange={(e) => {
          const mode = e.target.value
          setFontFamily(fontStack(mode))
        }}
      >
        <Radio value='mono' label='Mono' />
        <Radio value='sans' label='Sans' />
        <Radio value='serif' label='Serif' />
      </RadioGroup>

      <Typography level='title-sm'>Size</Typography>
      <Slider
        value={fontSize}
        min={14}
        max={20}
        step={1}
        marks={marks}
        onChange={(_, v) => {
          setFontSize(v)
        }}
      />

      {refLanguages?.length > 0 && (
        <>
          <Typography level='title-sm'>Languages</Typography>
          <Sheet variant='soft' sx={{ p: 1, borderRadius: 'sm' }}>
            <Stack spacing={1}>
              {refLanguages.map((lang) => {
                return (
                  <Stack
                    key={lang.code}
                    direction='row'
                    alignItems='center'
                    justifyContent='space-between'
                    spacing={1}
                  >
                    <Stack direction='row' spacing={1} sx={{ minWidth: 0 }}>
                      <Typography
                        level='body-sm'
                        sx={{
                          maxWidth: 220,
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {lang.filename || 'Untitled subtitle'}
                      </Typography>
                      <Chip variant='outlined' size='sm'>
                        {lang.code.toUpperCase()}
                      </Chip>
                    </Stack>
                    <Switch
                      checked={!!lang.visible}
                      onChange={() => toggleLang(lang.code)}
                    />
                  </Stack>
                )
              })}
            </Stack>
          </Sheet>
        </>
      )}
    </Stack>
  )
}
