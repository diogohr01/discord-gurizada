"use client";

import { Button, type ButtonProps } from "antd";

import { AppTooltip } from "./AppTooltip";

export interface AppIconButtonProps extends Omit<ButtonProps, "children" | "title"> {
  label: string;
  active?: boolean;
  danger?: boolean;
}

export function AppIconButton({
  label,
  active,
  danger,
  className,
  ...props
}: AppIconButtonProps) {
  const classes = ["nexus-icon-button", active && "is-active", className]
    .filter(Boolean)
    .join(" ");
  return (
    <AppTooltip title={label}>
      <Button
        aria-label={label}
        shape="circle"
        danger={danger}
        className={classes}
        {...props}
      />
    </AppTooltip>
  );
}
