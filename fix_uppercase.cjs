const fs = require('fs');

const path = 'd:/HARSHITHA_PROJECTS/Digital-Resume/src/pages/ResumeIntroPage.tsx';
let content = fs.readFileSync(path, 'utf8');

// The user indicated the image shows UPPERCASE with tracking-widest for tags, buttons, and small labels in Human Mode.
// Replace all instances of `lowercase tracking-normal` paired with `font-hand` to `uppercase tracking-widest` 
// EXCEPT for standard paragraph text or the main Name ('text-7xl'). 
// Actually, looking at the image:
// "Nithin Erroju" is capitalized normally: "Nithin Erroju"
// Role: "AI Engineer | RAG Systems Specialist" -> normally capitalized, but in the image it looks like "AI Engineer | RAG Systems Specialist" 
// Verification tags: "VERIFIED" "OPEN TO RELOCATE" -> uppercase tracking-widest
// Buttons: "WATCH INTRO" "CONTACT" -> uppercase tracking-widest

// Let's just remove `lowercase tracking-normal` entirely, and let the base classes (which I stripped previously) 
// be explicitly added inside human mode ternary if needed, OR just put `uppercase tracking-widest` inside the human mode classes 
// for buttons, tags, and small labels.

const targetsToUpper = [
  'verified!', 'verified',
  'watch intro',
  'contact',
  'Production Ready',
  'get cv',
  'schedule call',
  'view more',
  'view less',
];

// Let's just globally replace `lowercase tracking-normal` with `uppercase tracking-widest` inside font-hand classes, 
// EXCEPT for `text-7xl` (Name), `text-3xl` (Section Titles), `text-lg`/`text-xl` (Body/Descriptions).
// Wait, in Nithin's code, `text-[10px]` or `text-xs` maps to tags/buttons.
// So let's do a careful regex replace on `font-hand` strings.

content = content.replace(/font-hand ([^'"`}]*)lowercase tracking-normal/g, (match, before) => {
  // If it's a heading or body text, we might want to keep it normal.
  // Actually, the user wants it to match the image. The image has:
  // "PORTFOLIO OVERVIEW" (uppercase) -> It's an h3 or h4 right now.
  if (before.includes('text-7xl')) {
    // Name - normal capitalization
    return `font-hand ${before}`;
  }
  if (before.includes('text-3xl') || before.includes('text-2xl') || before.includes('text-xl') && !before.includes('text-xs')) {
    // Titles and roles - normal capitalization
    return `font-hand ${before}`;
  }
  // Tags, buttons, overlines -> uppercase tracking-widest
  return `font-hand ${before}uppercase tracking-widest`;
});

// Also make sure 'verified!' is 'VERIFIED'
content = content.replace(/>verified!</g, '>VERIFIED<');
content = content.replace(/>watch intro</g, '>WATCH INTRO<');
content = content.replace(/>contact</g, '>CONTACT<');

fs.writeFileSync(path, content, 'utf8');
console.log('Restored uppercase handwriting tags!');
