"use client";

import { Button, type ButtonProps } from "antd";

export type AppButtonVariant = "primary" | "secondary" | "danger";

export interface AppButtonProps extends Omit<ButtonProps, "type" | "danger" | "variant"> {
  variant?: AppButtonVariant;
}

export function AppButton({ variant = "secondary", ...props }: AppButtonProps) {
  return (
    <Button
      type={variant === "primary" ? "primary" : "default"}
      danger={variant === "danger"}
      {...props}
    />
  );
}
