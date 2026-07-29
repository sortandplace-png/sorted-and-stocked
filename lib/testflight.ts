// lib/testflight.ts
// One place for the TestFlight join link.
//
// It is referenced from two unrelated surfaces -- the marketing homepage hero
// and the staff/manager invite email -- and a TestFlight link changes when a
// build group is recreated. Two hardcoded copies would drift silently, and
// the one in the email is the copy nobody would notice was stale until an
// invited person could not install the app.
//
// The word "beta" is deliberately absent from every string that reaches a
// reader, per the homepage brief.
export const TESTFLIGHT_URL = 'https://testflight.apple.com/join/n5gZbpa5';
