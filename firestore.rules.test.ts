import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.join(process.cwd(), 'firestore.rules');
const rulesText = fs.readFileSync(rulesPath, 'utf-8');

test('firestore.rules enforces Eight Pillars and denies all Dirty Dozen patterns', () => {
  // Global Safety Net
  assert.match(rulesText, /rules_version = '2';/);
  assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);

  // Dirty Dozen 1 & 2: Authentication + email_verified enforcement
  assert.match(rulesText, /request\.auth != null/);
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);

  // Dirty Dozen 3 & 4: Strict owner UID enforcement
  assert.match(rulesText, /request\.auth\.uid == userId/);
  assert.match(rulesText, /data\.ownerId == request\.auth\.uid/);

  // Dirty Dozen 5 & 8: hasOnly key allowlists and affectedKeys allowlists
  assert.match(rulesText, /hasAll\(\[.*\]\)/);
  assert.match(rulesText, /hasOnly\(\[.*\]\)/);
  assert.match(rulesText, /affectedKeys\(\)\.hasOnly/);

  // Dirty Dozen 6 & 7: ID validation and string size bounds
  assert.match(rulesText, /isValidId\(/);
  assert.match(rulesText, /id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/);
  assert.match(rulesText, /u\.size\(\) <= 350000/);

  // Dirty Dozen 9: Server timestamp integrity
  assert.match(rulesText, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesText, /data\.updatedAt == request\.time/);

  // Dirty Dozen 10: Master Gate parent check on subcollections
  assert.match(rulesText, /hasParentUser\(userId\)/);

  // Dirty Dozen 11: Enum and type checks
  assert.match(rulesText, /data\.g == '' \|\| data\.g == 'L' \|\| data\.g == 'P'/);

  // Dirty Dozen 12: PII users collection blocks list & subcollection list enforces ownerId
  assert.match(rulesText, /match \/users\/\{userId\}[\s\S]*allow list: if false;/);
  assert.match(rulesText, /allow list: if isOwner\(userId\) && resource\.data\.ownerId == request\.auth\.uid;/);
});
