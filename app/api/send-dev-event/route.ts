import { client } from "../sse-clients";

/**
 * Send message to all connected clients (browsers).
 * 🔔 Dev only endpoint
 */
export async function POST(_request: Request) {
  // console.log(`[${__dirname}] received`, await request.json());

  client.sendMessage(JSON.stringify({
    key: 'reload-world',
  }));

  return Response.json({ sentMessageToClients: true });
}

export const dynamic = 'force-static';
