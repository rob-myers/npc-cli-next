export async function POST(request: Request) {

  console.log(__dirname, 'received', await request.json());

  return Response.json({ hello: 'world '});
}
