// Test-only replay of the exact next local midnight boundary.
const NativeDate=globalThis.Date;
const captured=NativeDate.parse('2026-10-03T17:00:00.000Z');
globalThis.Date=class extends NativeDate {
 constructor(...args){super(...(args.length?args:[captured]));}
 static now(){return captured;}
};
export {default,DatasetCoordinator} from '../src/workers/core.js';
