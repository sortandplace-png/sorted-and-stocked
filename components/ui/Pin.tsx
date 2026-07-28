// components/ui/Pin.tsx
// The single pin implementation, re-exported so components/ui/ is the one
// import path for design-system primitives (SS-142).
//
// This is a re-export, NOT a reimplementation. PinAccent is the richer and
// more-used component -- 30 files, 7 of which use the pin as a real collapse
// control (<button>, aria-expanded, stopPropagation). Growing a second dot to
// match it would just have recreated PinAccent under a new name, and
// migrating consumers to a decorative-only dot would have silently deleted
// those controls.
//
// No consumer migrates. Existing `@/components/PinAccent` imports stay valid.
export { default } from '@/components/PinAccent';
