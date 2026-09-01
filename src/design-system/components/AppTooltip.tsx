"use client";

import { Tooltip, type TooltipProps } from "antd";

export function AppTooltip(props: TooltipProps) {
  return <Tooltip mouseEnterDelay={0.35} {...props} />;
}
