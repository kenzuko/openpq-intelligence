export default {
  // The Node host keeps a real external I/O operation pending across concurrent requests.
  async fetch(request,env){return env.GATE_HOST.fetch(request);}
};
