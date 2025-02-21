// Source https://github.com/vercel/next.js/discussions/48427#discussioncomment-9791770

import { client } from "../sse-clients";

export async function POST(request: Request) {
  const payload = await request.json();
  const clientId = payload.clientId as number;
  const result = {
    clientId,
    success: client.remove(clientId),
  };
  console.log('close-dev-events', result);
  return Response.json(result);
}

// Required for build to work
export const dynamic = 'force-static';
