const TARGET_ACCURACY_METERS = 100;
const MEASUREMENT_WINDOW_MS = 10_000;

function isValidPosition(position: GeolocationPosition): boolean {
  const { latitude, longitude, accuracy } = position.coords;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Number.isFinite(accuracy) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    accuracy >= 0
  );
}

/**
 * Collects GPS readings briefly and returns the most accurate valid result.
 * A sufficiently precise reading ends the measurement early.
 */
export function getPrecisePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not available"));
      return;
    }

    let bestPosition: GeolocationPosition | null = null;
    let settled = false;
    let watchId: number | null = null;

    const finish = (error?: GeolocationPositionError) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timerId);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (bestPosition) resolve(bestPosition);
      else reject(error ?? new Error("No valid location was found"));
    };

    const timerId = window.setTimeout(() => finish(), MEASUREMENT_WINDOW_MS);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!isValidPosition(position)) return;
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }
        if (position.coords.accuracy <= TARGET_ACCURACY_METERS) finish();
      },
      (error) => finish(error),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: MEASUREMENT_WINDOW_MS,
      },
    );
  });
}