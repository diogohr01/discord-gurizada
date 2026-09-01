interface ProfileResponse {
  avatarUrl: string | null;
}

async function readProfileResponse(response: Response): Promise<ProfileResponse> {
  const payload = await response.json() as ProfileResponse & { message?: string };
  if (!response.ok) throw new Error(payload.message || "Não foi possível atualizar o perfil.");
  return payload;
}

export async function getProfile(): Promise<ProfileResponse> {
  return readProfileResponse(await fetch("/api/profile", { cache: "no-store" }));
}

export async function uploadProfileAvatar(file: File): Promise<ProfileResponse> {
  const form = new FormData();
  form.set("file", file);
  return readProfileResponse(await fetch("/api/profile", { method: "POST", body: form }));
}
