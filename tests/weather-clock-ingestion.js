// Captured source replay only. Never referenced by a deployment config.
const NativeDate=globalThis.Date,fixed=NativeDate.parse('2026-10-03T01:12:00.000Z');
globalThis.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};
export {default,WeatherSourcePump} from '../src/workers/weather-ingestion.js';
