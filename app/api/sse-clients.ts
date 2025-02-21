export const clients: Client[] = process.env.NODE_ENV === "production" 
  ? []
  : ((global as any).clients ??= [])
;

export const client = {
  add(res: any) {
    const id = nextClientId++;
    clients.push({ id, res });
    console.log('sse-clients: added clientId', id);
    return id;
  },
  remove(id: number) {
    const index = clients.findIndex(client => client.id === id);
    if (index !== -1) {
      clients.splice(index, 1);
      console.log('sse-clients removed clientId', id);
      return true;
    } else {
      return false;
    }
  },
  sendMessage(message: string, id?: number) {
    if (id === undefined) {
      clients.forEach(client => client.res.write(`data: ${message}\n\n`));
    } else {
      clients.find(client => client.id === id)?.res.write(`data: ${message}\n\n`);
    }
  },
  getCount() {
    return clients.length;
  },
};

type Client = { id: number; res: any; }

let nextClientId = 0;
