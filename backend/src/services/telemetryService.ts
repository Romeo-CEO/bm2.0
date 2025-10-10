import applicationInsights, { TelemetryClient } from 'applicationinsights';

let telemetryClient: TelemetryClient | null = null;

const connectionString = process.env.APPINSIGHTS_CONNECTION_STRING;
const instrumentationKey = process.env.APPINSIGHTS_INSTRUMENTATION_KEY;

if (connectionString || instrumentationKey) {
  try {
    if (connectionString) {
      applicationInsights.setup(connectionString).setAutoCollectConsole(false, false).start();
    } else if (instrumentationKey) {
      applicationInsights.setup(instrumentationKey).setAutoCollectConsole(false, false).start();
    }
    telemetryClient = applicationInsights.defaultClient;
    telemetryClient?.config?.disableAppInsights ? (telemetryClient.config.disableAppInsights = false) : null;
    telemetryClient?.config && (telemetryClient.config.maxBatchSize = 32);
  } catch (error) {
    console.warn('Failed to initialize Application Insights client', error);
    telemetryClient = null;
  }
}

export interface TelemetryEventOptions {
  name: string;
  properties?: Record<string, string>;
  measurements?: Record<string, number>;
}

export const trackEvent = (options: TelemetryEventOptions): void => {
  const { name, properties, measurements } = options;
  if (!name) {
    return;
  }

  if (telemetryClient) {
    try {
      telemetryClient.trackEvent({ name, properties, measurements });
    } catch (error) {
      console.error('Failed to send telemetry event', error);
    }
  } else {
    // Fallback to verbose logging to aid diagnostics in environments without App Insights
    console.log('[TelemetryEvent]', name, { properties, measurements });
  }
};

export const flushTelemetry = async (): Promise<void> => {
  if (!telemetryClient) return;
  telemetryClient.flush();
};
