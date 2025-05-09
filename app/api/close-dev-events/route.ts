// 🚧 remove if eventSource.close() in client triggers cleanup via our
//    request.signal 'abort' listener

import { client } from "../sse-clients";

export async function POST(request: Request) {
  const payload = await request.json();
  const clientId = payload.clientId as number;
  const result = {
    clientId,
    success: client.remove(clientId),
  };
  // console.log('/api/close-dev-events', result);
  return Response.json(result);
}

// Required for build to work
export const dynamic = 'force-static';
