import { Avatar, type AvatarProps } from "antd";

export interface AppAvatarProps extends Omit<AvatarProps, "children"> {
  name: string;
}

export function AppAvatar({ name, ...props }: AppAvatarProps) {
  const initial = name.trim().charAt(0).toLocaleUpperCase("pt-BR") || "?";
  return (
    <Avatar aria-label={`Avatar de ${name}`} {...props}>{props.src ? undefined : initial}</Avatar>
  );
}
