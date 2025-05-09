// @ts-nocheck
import React from 'react'

import type { SelectChangeEvent } from '@mui/material'
import { MenuItem, Select } from '@mui/material'

import { languages } from '@/data/speech/languages'

export default function SelectLang(props: { setSelectedLang: (lang: string) => void; selectedLang: string }) {
  const handleChange = (e: SelectChangeEvent<string>) => {
    const value = e.target.value as string

    props.setSelectedLang(value)
  }

  return (
    <Select value={props.selectedLang} onChange={handleChange} fullWidth>
      {languages.map(lang => (
        <MenuItem key={lang.code} value={lang.code}>
          {lang.label}
        </MenuItem>
      ))}
    </Select>
  )
}
