import { AntdRegistry } from "@ant-design/nextjs-registry";
import type { Metadata } from "next";
import type { CSSProperties } from "react";

import { appConfig } from "@/config/app";
import {
  colors,
  motion,
  radius,
  shadows,
  spacing,
  typography,
} from "@/design-system/tokens";
import { ThemeProvider } from "@/design-system/theme/ThemeProvider";

import "@livekit/components-styles";
import "./globals.css";

export const metadata: Metadata = {
  title: appConfig.name,
  description: appConfig.description,
};

const cssVariables = {
  "--color-bg-base": colors.background.base,
  "--color-bg-rail": colors.background.rail,
  "--color-bg-sidebar": colors.background.sidebar,
  "--color-bg-panel": colors.background.panel,
  "--color-bg-elevated": colors.background.elevated,
  "--color-bg-hover": colors.background.hover,
  "--color-text-primary": colors.text.primary,
  "--color-text-secondary": colors.text.secondary,
  "--color-text-muted": colors.text.muted,
  "--color-border": colors.border.default,
  "--color-border-strong": colors.border.strong,
  "--color-brand": colors.brand.primary,
  "--color-brand-hover": colors.brand.hover,
  "--color-brand-active": colors.brand.active,
  "--color-brand-soft": colors.brand.soft,
  "--color-brand-faint": colors.brand.faint,
  "--color-brand-ghost": colors.brand.ghost,
  "--color-online": colors.status.online,
  "--color-warning": colors.status.warning,
  "--color-danger": colors.status.danger,
  "--color-info": colors.status.info,
  "--color-overlay": colors.overlay,
  "--color-overlay-soft": colors.overlaySoft,
  "--color-panel-translucent": colors.panelTranslucent,
  "--color-border-translucent": colors.borderTranslucent,
  "--font-family": typography.family,
  "--font-mono": typography.mono,
  "--space-xs": `${spacing.xs}px`,
  "--space-sm": `${spacing.sm}px`,
  "--space-md": `${spacing.md}px`,
  "--space-lg": `${spacing.lg}px`,
  "--space-xl": `${spacing.xl}px`,
  "--radius-sm": `${radius.sm}px`,
  "--radius-md": `${radius.md}px`,
  "--radius-lg": `${radius.lg}px`,
  "--radius-xl": `${radius.xl}px`,
  "--shadow-elevated": shadows.elevated,
  "--shadow-focus": shadows.focus,
  "--motion-fast": motion.fast,
  "--motion-mid": motion.mid,
  "--motion-ease": motion.ease,
} as CSSProperties;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" style={cssVariables}>
      {/* Browser extensions may add attributes before React hydrates the document body. */}
      <body suppressHydrationWarning>
        <AntdRegistry>
          <ThemeProvider>{children}</ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
