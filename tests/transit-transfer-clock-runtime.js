// Replay clock for captured source transport tests only; never a deployment entrypoint.
const NativeDate=globalThis.Date,fixed=NativeDate.parse('2026-10-03T21:46:00.000Z');
globalThis.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};
export {default} from '../src/workers/runtime.js';
