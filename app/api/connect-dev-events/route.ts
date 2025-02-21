// Source https://github.com/vercel/next.js/discussions/48427#discussioncomment-9791770

import { client, clients } from "../sse-clients";

export async function GET(request: Request, context: {
  params: Promise<{ uid: string }>
}) {
  // const { uid: clientUid } = await context.params;
  // console.log(`[${__dirname}] received`);
  // console.log('🔔', { uid });

  if (process.env.NODE_ENV === 'development') {
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder()

    // remember client
    const clientId = client.add({
      write: (message: string) => writer.write(encoder.encode(message)),
      end: () => writer.close(),
      isClosed: () => writer.closed,
    });
    request.signal.addEventListener('abort', () => {
      client.remove(clientId);
      writer.close();
    });

    // send initial message
    writer.write(encoder.encode(`data: ${JSON.stringify({
      key: 'initial-message',
      pathname: new URL(request.url).pathname,
      clientId,
    })}\n\n`));

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } else {
    // 🔔 dummy route in prod to fix build
    return Response.json({ hello: 'world' });
  }
}

// Required for build to work
export const dynamic = 'force-static';

// export async function generateStaticParams(): Promise<{ slug: string }[]> {
//   return [];
// }
