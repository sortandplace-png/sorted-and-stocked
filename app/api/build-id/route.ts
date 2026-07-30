// GET /api/build-id
//
// SS-339: the one direct, caching-layer-independent signal for "is this tab
// running the build that's actually live." A stale service worker is one
// way a device ends up on an old build, but tonight's real incidents (four
// of them -- white screen, black training videos, missing SOP posters, a
// stale property label) turned out to be plain browser HTTP caching of an
// old page/response, which a service-worker-only check would never catch.
// Comparing build IDs does, regardless of which caching layer is at fault.
//
// Reads the same VERCEL_GIT_COMMIT_SHA baked into app/layout.tsx's
// app-build-id meta tag -- both must agree, or every tab would "mismatch"
// against a server that hasn't actually changed. force-dynamic plus
// no-store is what makes this endpoint itself immune to the exact
// staleness it's checking for; env vars are read fresh per invocation
// regardless, but a cached RESPONSE would defeat the whole point.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? 'development';
  return NextResponse.json({ buildId }, { headers: { 'Cache-Control': 'no-store' } });
}
