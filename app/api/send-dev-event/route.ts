// 🔔 Dev only endpoint
export async function POST(request: Request) {
  console.log(`[${__dirname}] received`, await request.json());

  // 🚧 send message to connected browsers

  return Response.json({ hello: 'world '});
}

// Also accessible in build at /api/send-dev-event
export async function GET(request: Request) {
  console.log(__dirname, 'GET');
  return Response.json({ hello: 'world '});
}

export const dynamic = 'force-static';
