import React, { useMemo } from 'react'
import {
  Stack,
  Typography,
  Slider,
  Chip,
  Sheet,
  Switch
} from '@mui/joy'
import { styled } from '@mui/joy/styles'
import { useSettingStore } from './stores/useSettingStore'
import { useSessionStore } from './stores/useSessionStore'
import { getAvailableFonts } from '../../utils/font'
// import { log } from '../../utils/logger'

const PrettoSlider = styled(Slider)(({ theme }) => ({
  color: theme.palette.primary[300],
  height: 10,
  '& .MuiSlider-track': {
    backgroundColor: theme.palette.primary[500],
    border: 'none',
    height: 10
  },
  '& .MuiSlider-rail': {
    backgroundColor: theme.vars.palette.background.level2,
    opacity: 1,
    height: 10
  },
  '& .MuiSlider-thumb': {
    height: 24,
    width: 24,
    backgroundColor: '#fff',
    border: '2px solid currentColor',
    borderRadius: '50%',
    '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
      boxShadow: 'inherit'
    },
    '&::before': {
      display: 'none'
    }
  },
  '& .MuiSlider-valueLabel': {
    lineHeight: 1.2,
    fontSize: 12,
    background: theme.vars.palette.background.level1,
    padding: '4px 8px',
    borderRadius: '4px',
    color: theme.palette.primary[500],
    // fontWeight: 'bold',
    '&::before': { display: 'none' }
  }
}))

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
      <Stack direction='row' spacing={1} alignItems='center'>
        <Typography level='title-sm' sx={{ color: 'neutral.500' }}>Font</Typography>
        <Chip variant='soft' size='sm' color='neutral' sx={{ fontSize: '0.75rem', color: 'neutral.400', px: 1 }}>
          {availableFonts.os?.toUpperCase()}
        </Chip>
      </Stack>
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
              px: 1.5
            }}
          >
            {font.fontName === 'system-ui' ? 'System' : font.fontName}
          </Chip>
        ))}
      </Stack>

      <Typography level='title-sm' sx={{ mb: 0.5, color: 'neutral.500' }}>Size</Typography>
      <div data-allow-events="true">
        <PrettoSlider
          value={fontSize}
          min={14}
          max={24}
          step={1}
          valueLabelDisplay="auto"
          onChange={(_, v) => {
            setFontSize(v)
          }}
        />
      </div>


      <Typography level='title-sm' sx={{ color: 'neutral.500' }}>Ref langs</Typography>
      <Sheet variant='soft' sx={(theme) => ({ p: 1, borderRadius: 'sm',
        backgroundColor: theme.vars.palette.background.level1 })}>
        <Stack spacing={1}>
          {refLanguages?.filter(l => !l.isMain)?.length > 0 ? (
            refLanguages.filter(l => !l.isMain).map((lang) => {
              return (
                <Stack
                  key={lang.code}
                  direction='row'
                  alignItems='center'
                  spacing={2}
                >
                  <Switch
                    checked={!!lang.visible}
                    onChange={() => toggleLang(lang.code)}
                    size='sm'
                    slotProps={{
                      track: {
                        children: (
                          <React.Fragment>
                            <Typography component="span" level="inherit" sx={{ ml: '9px', mt: '2px', fontSize: '10px' }}>
                              {lang.code.toUpperCase()}
                            </Typography>
                            <Typography component="span" level="inherit" sx={(theme) => ({ mr: '9px',
                              mt: '2px', fontSize: '10px',
                              color: theme.vars.palette.neutral[400] })}>
                              {lang.code.toUpperCase()}
                            </Typography>
                          </React.Fragment>
                        )
                      }
                    }}
                    sx={(theme) => ({
                      '--Switch-thumbSize': '22px',
                      '--Switch-trackWidth': '50px',
                      '--Switch-trackHeight': '20px',
                      '--Switch-trackBackground': theme.vars.palette.background.level2
                    })}
                  />
                  <Typography
                    level='body-sm'
                    sx={(theme) => ({
                      // maxWidth: 220,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      color: lang.visible ? 'inherit' : theme.vars.palette.neutral[400]
                    })}
                  >
                    {lang.filename || 'Untitled subtitle'}
                  </Typography>
                </Stack>
              )
            })
          ) : (
            <Typography
              level='body-sm'
              sx={{
                color: 'neutral.400',
                // fontStyle: 'italic',
                textAlign: 'center',
                py: 0.5
              }}
            >
              Import a ref lang in Shard Editor page
            </Typography>
          )}
        </Stack>
      </Sheet>
    </Stack>
  )
}
