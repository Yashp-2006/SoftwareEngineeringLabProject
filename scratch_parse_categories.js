const fs = require('fs');
const content = fs.readFileSync('./backend/lib/wkf-categories.ts', 'utf8');
const lines = content.split('\n').map(l => l.trim());
const categories = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('"') || line.startsWith("'")) {
    categories.push(line.replace(/^["']|["',]+$/g, ''));
  }
}

const parseWkfString = (name) => {
  let gender = 'Any';
  if (name.includes('Male / Female') || name.includes('Mixed Gender')) gender = 'Any';
  else if (name.includes('Male')) gender = 'Male';
  else if (name.includes('Female')) gender = 'Female';

  let minAge, maxAge;
  if (name.includes('Senior (18+)')) { minAge = 18; maxAge = 99; }
  else if (name.includes('Under 21 (18-20)')) { minAge = 18; maxAge = 20; }
  else if (name.includes('Junior / U18 (16-17)')) { minAge = 16; maxAge = 17; }
  else if (name.includes('Cadet / U16 (14-15)')) { minAge = 14; maxAge = 15; }
  else if (name.includes('U14 (12-13)')) { minAge = 12; maxAge = 13; }
  else if (name.includes('U12 (10-11)')) { minAge = 10; maxAge = 11; }
  else if (name.includes('U10 (8-9)')) { minAge = 8; maxAge = 9; }
  else if (name.includes('U8 (6-7)')) { minAge = 6; maxAge = 7; }
  else if (name.includes('Toddler')) { minAge = 3; maxAge = 5; }

  let minWeight, maxWeight;
  const wMatch = name.match(/([+-])(\d+)\s*kg/);
  if (wMatch) {
    const val = parseInt(wMatch[2]);
    if (wMatch[1] === '-') { maxWeight = val; }
    else if (wMatch[1] === '+') { minWeight = val; }
  }
  return { gender, minAge, maxAge, minWeight, maxWeight };
};

const result = categories.map(c => ({ name: c, ...parseWkfString(c) }));
console.log(JSON.stringify(result, null, 2));
