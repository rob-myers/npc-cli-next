export async function GET(request: Request) {
  console.log(`[${__dirname}] received`);

  if (process.env.NODE_ENV === 'development') {
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder()
    writer.write(encoder.encode(`data: ${'aloha!'}\n\n`));

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } else {
    // 🔔 dummy route in prod to fix build
    return Response.json({ hello: 'world '});
  }
}

// 🚧
export const dynamic = 'force-static';
