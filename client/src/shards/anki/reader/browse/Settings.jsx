import {
  Stack,
  Divider,
  Select,
  Option,
  Switch,
  FormControl,
  FormLabel,
  Input
} from '@mui/joy'

export const buildSettingsPages = (state, update) => {
  // Helper to render number input
  const numberField = (label, value, onChange, min = 0, max = 999) => (
    <FormControl size='sm' key={label}>
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
  const toggleField = (label, checked, onChange) => (
    <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }} key={label}>
      <FormLabel>{label}</FormLabel>
      <Switch checked={checked} onChange={(event) => onChange(event.target.checked)} size='sm' />
    </FormControl>
  )

  return [
    {
      key: 'browse',
      title: 'Browse options',
      content: (
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
      )
    },
    {
      key: 'learning',
      title: 'Learning options',
      content: (
        <Stack spacing={1.5}>
          {numberField('Max new cards per day', state.maxNewCards, (value) => update({ maxNewCards: value }), 1, 200)}
          {numberField('Max review cards per day', state.maxReviewCards, (value) => update({ maxReviewCards: value }), 10, 1000)}
          {numberField('Daily reset time (hour)', state.dailyResetTime, (value) => update({ dailyResetTime: value }), 0, 23)}
          {numberField('Graduation gap (minutes)', state.gradCd, (value) => update({ gradCd: value }), 1, 720)}

          <Divider sx={{ my: 1 }} />
          {toggleField('Auto reveal answer', !!state.autoReveal, (value) => update({ autoReveal: value }))}
          {toggleField('Auto play audio', !!state.autoPlayAudio, (value) => update({ autoPlayAudio: value }))}

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

          {toggleField('Auto bury siblings', !!state.autoBurySiblings, (value) => update({ autoBurySiblings: value }))}
          {toggleField('Use natural cooldown', !!state.naturalCooldown, (value) => update({ naturalCooldown: value }))}
        </Stack>
      )
    }
  ]
}

