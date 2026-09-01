"use client";

import { App, ConfigProvider } from "antd";
import ptBR from "antd/locale/pt_BR";
import type { PropsWithChildren } from "react";

import { antdTheme } from "./antdTheme";

export function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <ConfigProvider locale={ptBR} theme={antdTheme} componentSize="medium">
      <App component={false}>{children}</App>
    </ConfigProvider>
  );
}
