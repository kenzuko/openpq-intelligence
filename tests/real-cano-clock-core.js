// Test-only historical replay clock. Never selected by a deploy configuration.
// The captured source day must remain reproducible after its real validity expires.
const NativeDate=globalThis.Date;
const captured=NativeDate.parse('2026-10-03T00:30:00.000Z');
globalThis.Date=class extends NativeDate {
 constructor(...args){super(...(args.length?args:[captured]));}
 static now(){return captured;}
};
export {default,DatasetCoordinator} from '../src/workers/core.js';
