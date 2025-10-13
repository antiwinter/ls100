import {
  Stack,
  Divider,
  Select,
  Option,
  Switch,
  FormControl,
  FormLabel,
  Input,
  Box,
  Typography
} from '@mui/joy'
import anki from '../../core/index.js'

// Helper to render number input
const NumberField = ({ label, value, onChange, min = 0, max = 999 }) => (
  <FormControl size='sm'>
    <FormLabel>{label}</FormLabel>
    <Input
      type='number'
      value={value}
      onChange={(event) => {
        const next = Number(event.target.value)
        if (Number.isNaN(next)) return
        const clamped = Math.min(max, Math.max(min, next))
        onChange(clamped)
      }}
      sx={{ mt: 0.5 }}
    />
  </FormControl>
)

// Helper to render toggle switch
const ToggleField = ({ label, checked, onChange }) => (
  <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
    <FormLabel>{label}</FormLabel>
    <Switch checked={checked} onChange={(event) => onChange(event.target.checked)} size='sm' />
  </FormControl>
)

// Global prefs toggle component
const GlobalPrefsToggle = ({ session }) => {
  const { shard } = session()
  const localPrefs = anki.prefsStore(shard.id)
  const globalPrefs = localPrefs(state => state.globalPrefs)

  const handleToggle = (checked) => {
    localPrefs.setState({ globalPrefs: checked })
  }

  return (
    <Box sx={{ p: 2, bgcolor: 'background.level1', borderRadius: 'sm', mb: 2 }}>
      <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <FormLabel sx={{ mb: 0.5 }}>Use global settings</FormLabel>
          <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
            Apply settings across all Anki shards
          </Typography>
        </Box>
        <Switch checked={!!globalPrefs} onChange={(e) => handleToggle(e.target.checked)} size='md' />
      </FormControl>
    </Box>
  )
}

export const BrowseSettings = ({ prefs, session }) => {
  const state = prefs()
  const update = (updates) => prefs.setState(updates)

  return {
    key: 'browse',
    title: 'Browse options',
    content: (
      <>
        <GlobalPrefsToggle session={session} />
        <Stack spacing={1.5}>
          <FormControl size='sm'>
            <FormLabel>Preview side</FormLabel>
            <Select
              value={state.previewSide || 'back'}
              onChange={(_, value) => update({ previewSide: value })}
              size='sm'
            >
              <Option value='both'>Both sides</Option>
              <Option value='front'>Front only</Option>
              <Option value='back'>Back only</Option>
            </Select>
          </FormControl>
        </Stack>
      </>
    )
  }
}

export const LearningSettings = ({ prefs, session }) => {
  const state = prefs()
  const update = (updates) => prefs.setState(updates)

  return {
    key: 'learning',
    title: 'Learning options',
    content: (
      <>
        <GlobalPrefsToggle session={session} />
        <Stack spacing={1.5}>
          <NumberField
            label='Max new cards per day'
            value={state.maxNewCards}
            onChange={(value) => update({ maxNewCards: value })}
            min={1}
            max={200}
          />
          <NumberField
            label='Max review cards per day'
            value={state.maxReviewCards}
            onChange={(value) => update({ maxReviewCards: value })}
            min={10}
            max={1000}
          />
          <NumberField
            label='Daily reset time (hour)'
            value={state.dailyResetTime}
            onChange={(value) => update({ dailyResetTime: value })}
            min={0}
            max={23}
          />
          <NumberField
            label='Graduation gap (minutes)'
            value={state.gradCd}
            onChange={(value) => update({ gradCd: value })}
            min={1}
            max={720}
          />

          <Divider sx={{ my: 1 }} />
          <ToggleField
            label='Auto reveal answer'
            checked={!!state.autoReveal}
            onChange={(value) => update({ autoReveal: value })}
          />
          <ToggleField
            label='Auto play audio'
            checked={!!state.autoPlayAudio}
            onChange={(value) => update({ autoPlayAudio: value })}
          />

          <Divider sx={{ my: 1 }} />
          <FormControl size='sm'>
            <FormLabel>New vs review order</FormLabel>
            <Select
              value={state.newReviewOrder || 'mixed'}
              onChange={(_, value) => update({ newReviewOrder: value })}
              size='sm'
            >
              <Option value='mixed'>Mixed</Option>
              <Option value='new-first'>New cards first</Option>
              <Option value='review-first'>Reviews first</Option>
            </Select>
          </FormControl>
          <FormControl size='sm'>
            <FormLabel>New card ordering</FormLabel>
            <Select
              value={state.newCardOrder || 'gather'}
              onChange={(_, value) => update({ newCardOrder: value })}
              size='sm'
            >
              <Option value='gather'>Template order</Option>
              <Option value='random'>Random</Option>
              <Option value='template-random'>Random within template</Option>
            </Select>
          </FormControl>

          <ToggleField
            label='Auto bury siblings'
            checked={!!state.autoBurySiblings}
            onChange={(value) => update({ autoBurySiblings: value })}
          />
          <ToggleField
            label='Use natural cooldown'
            checked={!!state.naturalCooldown}
            onChange={(value) => update({ naturalCooldown: value })}
          />
        </Stack>
      </>
    )
  }
}

