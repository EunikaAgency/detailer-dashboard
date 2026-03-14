import { servePwaShell } from "./_static";

export async function GET() {
  return servePwaShell();
}

export async function HEAD() {
  const response = await servePwaShell();
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}
