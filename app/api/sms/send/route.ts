// app/api/sms/send/route.ts
// Single entry point for every staff SMS trigger. Auth/authorization and
// recipient resolution happen here (using the caller's own session, via
// the regular server client); the actual Twilio call + opt-in check +
// audit-log write is the shared sendStaffText() primitive (lib/sms.ts),
// which always runs under the service-role admin client since it needs to
// read other members' profiles and phone numbers -- not something RLS
// should let a client-side query do directly.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendStaffText, type SmsTrigger } from '@/lib/sms';

type Body =
  | { propertyId: string; trigger: 'task_assigned'; assignedToMembershipId: string; taskTitle: string }
  | { propertyId: string; trigger: 'shift_handover'; noteText: string }
  | { propertyId: string; trigger: 'broadcast'; message: string };

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  const { propertyId, trigger } = body;

  if (!propertyId || !trigger) {
    return NextResponse.json({ error: 'Missing propertyId or trigger.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', propertyId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Not a member of this property.' }, { status: 403 });

  const { data: property } = await supabase.from('properties').select('name').eq('id', propertyId).single();
  const propertyName = property?.name ?? 'your property';

  if (trigger === 'task_assigned') {
    const { assignedToMembershipId, taskTitle } = body;
    const { data: assignee } = await supabase
      .from('property_members')
      .select('user_id')
      .eq('id', assignedToMembershipId)
      .eq('property_id', propertyId)
      .maybeSingle();

    // Self-assignment doesn't need a text, and an unresolved/removed
    // membership row has nowhere real to send one.
    if (!assignee || assignee.user_id === user.id) {
      return NextResponse.json({ sent: false });
    }

    const result = await sendStaffText({
      propertyId,
      recipientUserId: assignee.user_id,
      message: `${propertyName}: you've been assigned a new task — "${taskTitle}".`,
      trigger: 'task_assigned' as SmsTrigger,
      sentBy: user.id,
    });
    return NextResponse.json(result);
  }

  if (trigger === 'shift_handover') {
    const { noteText } = body;
    const { data: members } = await supabase
      .from('property_members')
      .select('user_id')
      .eq('property_id', propertyId)
      .neq('user_id', user.id);

    const preview = noteText.length > 100 ? `${noteText.slice(0, 100)}…` : noteText;
    const results = await Promise.all(
      (members ?? []).map((m) =>
        sendStaffText({
          propertyId,
          recipientUserId: m.user_id,
          message: `${propertyName}: new shift handover note — "${preview}"`,
          trigger: 'shift_handover' as SmsTrigger,
          sentBy: user.id,
        })
      )
    );
    return NextResponse.json({ sent: results.filter((r) => r.sent).length, total: results.length });
  }

  if (trigger === 'broadcast') {
    // Owner/manager only -- a mass text to every opted-in staff member is
    // a real, deliberate action, not something any member should trigger.
    if (membership.role !== 'owner' && membership.role !== 'manager') {
      return NextResponse.json({ error: 'Only an owner or manager can send a broadcast.' }, { status: 403 });
    }
    const { message } = body;
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }
    const { data: staffMembers } = await supabase
      .from('property_members')
      .select('user_id')
      .eq('property_id', propertyId)
      .eq('role', 'staff');

    const results = await Promise.all(
      (staffMembers ?? []).map((m) =>
        sendStaffText({
          propertyId,
          recipientUserId: m.user_id,
          message: message.trim(),
          trigger: 'broadcast' as SmsTrigger,
          sentBy: user.id,
        })
      )
    );
    return NextResponse.json({ sent: results.filter((r) => r.sent).length, total: results.length });
  }

  return NextResponse.json({ error: 'Unknown trigger.' }, { status: 400 });
}
