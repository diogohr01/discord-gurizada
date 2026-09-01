import { notFound } from "next/navigation";

import { UICatalog } from "@/components/dev/UICatalog";

export default function DevUiPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <UICatalog />;
}
