// Captured source replay only. Never referenced by a deployment config.
const NativeDate=globalThis.Date,fixed=NativeDate.parse('2026-10-04T03:56:07.789Z');
globalThis.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};
export {default,DatasetCoordinator} from '../src/workers/core.js';
