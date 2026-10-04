export const WEATHER_FACT_ENVIRONMENT='canonical-weather-fact';
export const WEATHER_FACT_ACCOUNT='1a64a0a081ea758f72be8254030bdf11';
export const WEATHER_FACT_GATE='WEATHER_FACT_ONLY_V1';
export const WEATHER_SOURCE_ORIGIN='https://openpq-intelligence-weather-source-view.kenzuko.workers.dev';
export const WEATHER_SOURCE_URLS=Object.freeze(Object.fromEntries(Object.entries({weather:'current',weather_forecast:'forecast',weather_marine:'marine',weather_cloud:'cloud',weather_compact:'compact',weather_meta:'meta'}).map(([domain,role])=>[domain,WEATHER_SOURCE_ORIGIN+'/weather/data/weather-runtime/'+role+'.json'])));
export const WEATHER_FACT_DATASETS=Object.freeze(['weather.bridge.phu-quoc','weather.forecast.bridge.phu-quoc','weather.marine.bridge.phu-quoc','weather.cloud.bridge.phu-quoc','weather.compact.bridge.phu-quoc','weather.meta.bridge.phu-quoc']);
export const WEATHER_DATASET_BY_DOMAIN=Object.freeze(Object.fromEntries(Object.keys(WEATHER_SOURCE_URLS).map((domain,index)=>[domain,WEATHER_FACT_DATASETS[index]])));
