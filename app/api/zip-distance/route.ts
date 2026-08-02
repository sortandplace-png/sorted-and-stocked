// POST /api/zip-distance
// { propertyZip: string, zips: string[] } ->
// { miles: { [zip]: number | null } }
//
// The Local Takeout Directory's radius filter needs real miles between
// the property's zip and each directory row's zip. The centroid table
// (lib/zip-distance.ts, us-zips / Census ZCTA data) is ~1.5 MB and
// server-only, so the client asks here instead of bundling it. Distances
// between public zip centroids reveal nothing sensitive, but the route
// keeps the app-wide signed-in gate anyway -- no anonymous compute.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { distanceMilesBetweenZips } from '@/lib/zip-distance';

// A property's curated directory is dozens of rows, not thousands -- the
// cap is a safety valve against abuse, far above real use.
const MAX_ZIPS = 500;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  let body: { propertyZip?: unknown; zips?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const propertyZip = typeof body.propertyZip === 'string' ? body.propertyZip : null;
  const zips = Array.isArray(body.zips) ? body.zips.filter((z): z is string => typeof z === 'string') : null;
  if (!propertyZip || !zips) {
    return NextResponse.json({ error: 'propertyZip and zips[] are required.' }, { status: 400 });
  }
  if (zips.length > MAX_ZIPS) {
    return NextResponse.json({ error: `Too many zips — max ${MAX_ZIPS}.` }, { status: 400 });
  }

  const miles: Record<string, number | null> = {};
  for (const zip of new Set(zips)) {
    miles[zip] = distanceMilesBetweenZips(propertyZip, zip);
  }

  return NextResponse.json({ miles });
}
