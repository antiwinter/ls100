import { useMemo } from "react";
import {
  Box,
  Stack,
  Typography,
  RadioGroup,
  Radio,
  Slider,
  Chip,
  Sheet,
  Switch,
} from "@mui/joy";
import { ActionDrawer } from "../../../../components/ActionDrawer.jsx";
import { fontStack } from "../../../../utils/font";

export const FontDrawer = ({
  open,
  onClose,
  fontSetting,
  onChangeFont,
  langMap,
  onToggleLang,
}) => {
  const marks = useMemo(
    () => [
      { value: 12, label: "12" },
      { value: 16, label: "16" },
      { value: 20, label: "20" },
      { value: 24, label: "24" },
    ],
    []
  );

  // Get ref languages from langMap
  const refLanguages = useMemo(
    () =>
      Array.from(langMap?.entries() || []).map(([code, data]) => ({
        code,
        ...data,
      })),
    [langMap]
  );

  return (
    <ActionDrawer open={open} onClose={onClose} position="bottom" size="half">
      <Stack spacing={2} sx={{ px: 1, pb: 1 }}>
        <Typography level="title-sm">Font</Typography>
        <RadioGroup
          orientation="horizontal"
          value={fontSetting?.mode || "sans"}
          onChange={(e) => {
            const mode = e.target.value;
            const family = fontStack(mode);
            onChangeFont?.({ mode, family, size: fontSetting?.size });
          }}
        >
          <Radio value="sans" label="Sans" />
          <Radio value="serif" label="Serif" />
        </RadioGroup>

        <Typography level="title-sm">Size</Typography>
        <Slider
          value={fontSetting?.size || 16}
          min={14}
          max={20}
          step={1}
          marks={marks}
          onChange={(_, v) => {
            const family = fontStack(fontSetting?.mode || "sans");
            onChangeFont?.({ mode: fontSetting?.mode, family, size: v });
          }}
        />

        {refLanguages?.length > 0 && (
          <>
            <Typography level="title-sm">Languages</Typography>
            <Sheet variant="soft" sx={{ p: 1, borderRadius: "sm" }}>
              <Stack spacing={1}>
                {refLanguages.map((lang) => {
                  return (
                    <Stack
                      key={lang.code}
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Stack direction="row" spacing={1} sx={{ minWidth: 0 }}>
                        <Typography
                          level="body-sm"
                          sx={{
                            maxWidth: 220,
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {lang.filename || "Untitled subtitle"}
                        </Typography>
                        <Chip variant="outlined" size="sm">
                          {lang.code.toUpperCase()}
                        </Chip>
                      </Stack>
                      <Switch
                        checked={!!lang.visible}
                        onChange={() => onToggleLang?.(lang.code)}
                      />
                    </Stack>
                  );
                })}
              </Stack>
            </Sheet>
          </>
        )}
      </Stack>
    </ActionDrawer>
  );
};
