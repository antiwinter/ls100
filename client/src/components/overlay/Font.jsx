import { useMemo } from 'react'
import {
  Stack,
  Typography,
  Slider,
  Chip,
  Sheet,
  Switch
} from '@mui/joy'
import { useSettingStore } from './stores/useSettingStore'
import { useSessionStore } from './stores/useSessionStore'
import { getAvailableFonts } from '../../utils/font'
// import { log } from '../../utils/logger'

export const FontContent = ({ shardId }) => {
  const { fontSize, selectedFont, setFontSize, setSelectedFont } = useSettingStore('subtitle-shard')()

  const sessionStore = useSessionStore(shardId)
  const { langMap, toggleLang } = sessionStore()

  // Find main language by isMain === true
  const mainLangCode = useMemo(() => {
    // log.debug('FontContent mainLangCode', { langMap })
    const languages = Object.entries(langMap || {})
    const mainLang = languages.find(([, data]) => data.isMain)
    return mainLang?.[0] || 'en'
  }, [langMap])

  // Get available fonts for main language
  const availableFonts = useMemo(() => {
    return getAvailableFonts(mainLangCode)
  }, [mainLangCode])

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
      <Typography level='title-sm'>Font {availableFonts.os}</Typography>
      <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {availableFonts.fonts.map((font) => (
          <Chip
            key={font.fontName}
            variant={selectedFont === font.fontName ? 'solid' : 'outlined'}
            color='primary'
            onClick={() => setSelectedFont(font.fontName)}
            sx={{
              fontFamily: font.fontName,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'primary.softHoverBg'
              }
            }}
          >
            {font.fontName === 'system-ui' ? 'System' : font.fontName}
          </Chip>
        ))}
      </Stack>

      <Typography level='title-sm'>Size</Typography>
      <div data-allow-events="true">
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
      </div>


      {refLanguages?.length > 0 && (
        <>
          <Typography level='title-sm'>Languages</Typography>
          <Sheet variant='soft' sx={{ p: 1, borderRadius: 'sm' }}>
            <Stack spacing={1}>
              {refLanguages.filter(l => !l.isMain).map((lang) => {
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
