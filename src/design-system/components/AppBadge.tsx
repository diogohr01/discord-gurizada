import { Badge, type BadgeProps } from "antd";

export function AppBadge(props: BadgeProps) {
  return <Badge overflowCount={99} {...props} />;
}
