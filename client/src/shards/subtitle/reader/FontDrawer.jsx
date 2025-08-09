import { useMemo } from 'react'
import { Box, Stack, Typography, RadioGroup, Radio, Slider, Chip, Sheet, Switch } from '@mui/joy'
import { ActionDrawer } from '../../../components/ActionDrawer.jsx'

export const FontDrawer = ({ open, onClose, fontMode, onChangeFontMode, fontSize, onChangeFontSize, languages = [], langSet, onToggleLang, mainLanguageCode }) => {
  const marks = useMemo(() => ([
    { value: 12, label: '12' },
    { value: 16, label: '16' },
    { value: 20, label: '20' },
    { value: 24, label: '24' }
  ]), [])
  
  // Memoize filtered languages to avoid recalculation on every render
  const filteredLanguages = useMemo(() => 
    languages.filter((l) => l.code !== mainLanguageCode),
    [languages, mainLanguageCode]
  )

  return (
    <ActionDrawer open={open} onClose={onClose} position="bottom" size="half">
      <Stack spacing={2} sx={{ px: 1, pb: 1 }}>
        <Typography level="title-sm">Font</Typography>
        <RadioGroup
          orientation="horizontal"
          value={fontMode}
          onChange={(e) => onChangeFontMode?.(e.target.value)}
        >
          <Radio value="sans" label="Sans" />
          <Radio value="serif" label="Serif" />
        </RadioGroup>

        <Typography level="title-sm">Size</Typography>
        <Slider
          value={fontSize}
          min={14}
          max={20}
          step={1}
          marks={marks}
          onChange={(_, v) => onChangeFontSize?.(v)}
        />

        {filteredLanguages?.length > 0 && (
          <>
            <Typography level="title-sm">Languages</Typography>
            <Sheet variant="soft" sx={{ p: 1, borderRadius: 'sm' }}>
              <Stack spacing={1}>
                {filteredLanguages.map((lang) => {
                  const active = langSet?.has?.(lang.code)
                  return (
                    <Stack key={lang.code} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Stack direction="row" spacing={1} sx={{ minWidth: 0 }}>
                        <Typography level="body-sm" sx={{ maxWidth: 220, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {lang.filename || 'Untitled subtitle'}
                        </Typography>
                        <Chip variant="outlined" size="sm">{lang.code.toUpperCase()}</Chip>
                      </Stack>
                      <Switch checked={!!active} onChange={() => onToggleLang?.(lang.code)} />
                    </Stack>
                  )
                })}
              </Stack>
            </Sheet>
          </>
        )}
      </Stack>
    </ActionDrawer>
  )
}


