// Isolated fixture only. Not a production binding or deployment entrypoint.
export default {async fetch(request,env){
  if(request.method!=='GET'||request.headers.get('authorization')!=='Bearer test-only-reader')return new Response('denied',{status:403});
  const object=await env.CANONICAL.get(new URL(request.url).pathname.slice(1));
  return object ? new Response(object.body) : new Response('missing',{status:404});
}};
