const fs = require('fs');

const path = 'd:/HARSHITHA_PROJECTS/Digital-Resume/src/pages/ResumeIntroPage.tsx';
let content = fs.readFileSync(path, 'utf8');

// The Nithin Erroju design system uses `lowercase tracking-normal` for ALL handwritten tags and buttons.
// Let's restore `lowercase tracking-normal` to all the `uppercase tracking-widest` we injected, EXCEPT for cases where it should be uppercase.

// Fix verified! to lowercased tag
content = content.replace(
  /font-hand text-lg uppercase tracking-normal[^>]*>VERIFIED</g,
  'font-hand text-lg lowercase tracking-normal\'>verified!</'
);

// Fix Watch Intro
content = content.replace(
  /font-hand text-lg uppercase tracking-widest([^>]*)>WATCH INTRO</g,
  "font-hand text-lg lowercase tracking-normal$1>watch intro<"
);

// Fix Contact
content = content.replace(
  /font-hand text-lg uppercase tracking-widest([^>]*)>CONTACT</g,
  "font-hand text-lg lowercase tracking-normal$1>contact<"
);

// Fix Tags (Skills, Experiences)
// All `font-hand text-sm uppercase tracking-widest` should be `font-hand text-sm lowercase tracking-normal`
content = content.replace(/font-hand text-sm uppercase tracking-widest/g, 'font-hand text-sm lowercase tracking-normal');

// Fix Buttons (Get CV, Schedule Call)
content = content.replace(/font-hand text-lg uppercase tracking-widest/g, 'font-hand text-lg lowercase tracking-normal');

// Restore At a Glance header. It should inherit uppercase, so `font-hand text-2xl rotate-[-1deg]`.
content = content.replace(/font-hand text-2xl rotate-\[-1deg\] uppercase tracking-widest/g, 'font-hand text-2xl rotate-[-1deg]');

// Restore Core tags
// Ensure uppercase tracking-widest is completely converted back to lowercase tracking-normal where I blindly replaced it inside font-hand strings
content = content.replace(/font-hand([^"'{}]*)uppercase tracking-widest/g, (match, p1) => {
  // If it's the At A Glance header, it shouldn't have lowercase either.
  if (p1.includes('text-2xl') || p1.includes('text-3xl')) {
    return `font-hand${p1}`;
  }
  return `font-hand${p1}lowercase tracking-normal`;
});

// Restore 'verified!' text if it got mashed
content = content.replace(/>VERIFIED</g, '>verified!<');
content = content.replace(/>WATCH INTRO</g, '>watch intro<');
content = content.replace(/>CONTACT</g, '>contact<');

fs.writeFileSync(path, content, 'utf8');
console.log('Restored strict UI exact match to Nithin Erroju!');
