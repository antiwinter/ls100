import { Slider } from '@mui/joy'
import { styled } from '@mui/joy/styles'

export const PrettoSlider = styled(Slider)(({ theme }) => ({
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
    backgroundColor: theme.vars.palette.background.body,
    border: '1px solid currentColor',
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
