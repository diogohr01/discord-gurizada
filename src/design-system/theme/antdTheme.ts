import { theme, type ThemeConfig } from "antd";

import { colors, radius, shadows, typography } from "@/design-system/tokens";

export const antdTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  cssVar: { prefix: "nexus" },
  token: {
    colorPrimary: colors.brand.primary,
    colorSuccess: colors.status.online,
    colorWarning: colors.status.warning,
    colorError: colors.status.danger,
    colorInfo: colors.status.info,
    colorBgBase: colors.background.base,
    colorBgContainer: colors.background.panel,
    colorBgElevated: colors.background.elevated,
    colorBorder: colors.border.default,
    colorText: colors.text.primary,
    colorTextLightSolid: colors.text.inverse,
    colorTextSecondary: colors.text.secondary,
    colorTextTertiary: colors.text.muted,
    borderRadius: radius.md,
    borderRadiusLG: radius.lg,
    fontFamily: typography.family,
    fontSize: typography.size.md,
    controlHeight: 40,
  },
  components: {
    Button: { fontWeight: typography.weight.strong },
    Drawer: { colorBgElevated: colors.background.sidebar },
    Input: { activeShadow: shadows.inputFocus },
    Modal: { contentBg: colors.background.panel, headerBg: colors.background.panel },
    Select: { optionSelectedBg: colors.background.hover },
  },
};
