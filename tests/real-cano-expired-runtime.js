// Test-only serving clock; no source timestamps or production clocks are edited.
const NativeDate=globalThis.Date;
const captured=NativeDate.parse('2026-10-03T17:00:00.000Z');
globalThis.Date=class extends NativeDate {
 constructor(...args){super(...(args.length?args:[captured]));}
 static now(){return captured;}
};
export {default} from '../src/workers/runtime.js';
