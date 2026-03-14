import { servePwaAsset } from "../_static";

export async function GET(_request, { params }) {
  return servePwaAsset(await params);
}

export async function HEAD(_request, { params }) {
  const response = await servePwaAsset(await params);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}
