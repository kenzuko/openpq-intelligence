// Pure wire identifiers shared with read-only Runtime. No producer import.
export const CONTINUOUS_PROFILE_VERSION='openpq-owned-domain-continuous-reference-isolated-v1';
export const CONTINUOUS_BUNDLE_VERSION='openpq-owned-domain-continuous-bundle-isolated-v1';
export const CONTINUOUS_SNAPSHOT_VERSION='openpq-domain-continuous-snapshot-isolated-v1';
export const TRANSIT_FACT_PROFILE_VERSION='openpq-transit-canonical-fact-v1';
export const TRANSIT_FACT_BUNDLE_VERSION='openpq-transit-canonical-bundle-v1';
export const TRANSIT_FACT_SNAPSHOT_VERSION='openpq-transit-canonical-snapshot-v1';
export const WEATHER_FACT_PROFILE_VERSION='openpq-weather-canonical-fact-v1';
export const WEATHER_FACT_BUNDLE_VERSION='openpq-weather-canonical-bundle-v1';
export const WEATHER_FACT_SNAPSHOT_VERSION='openpq-weather-canonical-snapshot-v1';
export const DIRECTORY_FACT_PROFILE_VERSION='openpq-directory-canonical-fact-v1';
export const DIRECTORY_FACT_BUNDLE_VERSION='openpq-directory-canonical-bundle-v1';
export const DIRECTORY_FACT_SNAPSHOT_VERSION='openpq-directory-canonical-snapshot-v1';
export const canonicalFactContract=version=>[TRANSIT_FACT_PROFILE_VERSION,WEATHER_FACT_PROFILE_VERSION,DIRECTORY_FACT_PROFILE_VERSION].includes(version);
export const continuousContract=version=>[CONTINUOUS_PROFILE_VERSION,TRANSIT_FACT_PROFILE_VERSION,WEATHER_FACT_PROFILE_VERSION,DIRECTORY_FACT_PROFILE_VERSION].includes(version);
export const continuousBundleVersion=version=>version===DIRECTORY_FACT_PROFILE_VERSION?DIRECTORY_FACT_BUNDLE_VERSION:version===WEATHER_FACT_PROFILE_VERSION?WEATHER_FACT_BUNDLE_VERSION:version===TRANSIT_FACT_PROFILE_VERSION?TRANSIT_FACT_BUNDLE_VERSION:CONTINUOUS_BUNDLE_VERSION;
export const continuousSnapshotVersion=version=>version===DIRECTORY_FACT_PROFILE_VERSION?DIRECTORY_FACT_SNAPSHOT_VERSION:version===WEATHER_FACT_PROFILE_VERSION?WEATHER_FACT_SNAPSHOT_VERSION:version===TRANSIT_FACT_PROFILE_VERSION?TRANSIT_FACT_SNAPSHOT_VERSION:CONTINUOUS_SNAPSHOT_VERSION;
export const continuousEnvironment=version=>version===DIRECTORY_FACT_PROFILE_VERSION?'canonical-directory-fact':version===WEATHER_FACT_PROFILE_VERSION?'canonical-weather-fact':version===TRANSIT_FACT_PROFILE_VERSION?'canonical-transit-fact':'isolated-test';
