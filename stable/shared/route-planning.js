// Nearest-neighbor day-trip ordering + Google Maps multi-stop route links — extracted from the
// one-off Python script used to build the campaign artifact (2026-08 Merida/Giant density drive)
// into a reusable module, so the Visit Planner (and later the map, per the plan's Phase 5
// stretch goal) share one implementation instead of drifting apart.

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Great-circle distance between two {lat,lng} points, in km.
export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Greedy nearest-neighbor ordering: starts from whichever point is furthest north (a day plan
// then reads top-to-bottom, matching how the campaign artifact ordered all 60 of its day-trips),
// then repeatedly jumps to whichever remaining point is closest. Not an optimal TSP solve, but
// that was never the bar — it's what already worked for every day-trip in the artifact, and a
// day only ever has 3-5 stops, where "optimal" and "greedy nearest" rarely differ.
export function nearestNeighborChain(points) {
  if (points.length <= 1) return [...points];
  const remaining = [...points];
  remaining.sort((a, b) => b.lat - a.lat);
  const chain = [remaining.shift()];
  while (remaining.length) {
    const last = chain[chain.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineKm(last, p);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    chain.push(remaining.splice(bestIdx, 1)[0]);
  }
  return chain;
}

// Greedy nearest-neighbor ordering anchored to a fixed starting point (e.g. a day plan's
// start_location/depot) — more accurate than nearestNeighborChain's northernmost-first heuristic
// whenever a real origin is known, since the first hop is genuinely "closest to where the day
// actually begins" rather than an arbitrary compass-direction guess.
export function nearestNeighborFromStart(start, points) {
  if (!points.length) return [];
  const remaining = [...points];
  const chain = [];
  let current = start;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineKm(current, p);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    current = remaining.splice(bestIdx, 1)[0];
    chain.push(current);
  }
  return chain;
}

// A single stop's Google Maps "waypoint" param — prefers exact lat,lng over an address (which
// Google geocodes at request time, less reliable for shops with a sparse/generic address).
function pointParam(p) {
  if (p.lat != null && p.lng != null) return `${p.lat},${p.lng}`;
  return encodeURIComponent(p.address || p.name || '');
}

// Google's multi-stop directions deep link: origin -> waypoints in order -> destination (the
// route's last stop). travelmode is always driving — reps cover county-wide distances between
// shops by car/scooter, not on foot or transit.
export function buildRouteUrl(origin, stops) {
  if (!stops || !stops.length) return null;
  const destination = pointParam(stops[stops.length - 1]);
  const waypoints = stops.slice(0, -1).map(pointParam);
  const params = new URLSearchParams({
    api: '1',
    origin: typeof origin === 'string' ? origin : pointParam(origin),
    destination,
    travelmode: 'driving',
  });
  let url = `https://www.google.com/maps/dir/?${params.toString()}`;
  if (waypoints.length) url += `&waypoints=${waypoints.join('|')}`;
  return url;
}

// A single shop's own Google Maps location link (not a route) — place_id if known, else exact
// lat/lng, else an address search. Same fallback order as the campaign artifact's gmaps_url().
export function shopMapsUrl(shop) {
  if (shop.google_place_id) return `https://www.google.com/maps/place/?q=place_id:${shop.google_place_id}`;
  if (shop.lat != null && shop.lng != null) return `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`;
  if (shop.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`;
  return null;
}

// Depot default for a new plan's start_location — 數據科技 (Datalake Tech)'s office. See
// supabase/migrations/0013_add_visit_plans.sql, which sets the identical value as the column
// default. Kept in sync manually (same convention as shared/delete-policy.js's admin email being
// duplicated into map.html's classic script).
export const DEFAULT_START_LOCATION = '24.13315821890205,120.62641783465286';
export const DEFAULT_START_LOCATION_LABEL = '數據科技辦公室 Datalake Tech Office';

// Parses a start_location string back into {lat,lng} for distance math, if it's in "lat,lng"
// form; returns null for a freeform address (those can only be used as a route origin string,
// not for ordering distance calculations).
export function parseStartLocation(text) {
  if (!text) return null;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return null;
  return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
}
