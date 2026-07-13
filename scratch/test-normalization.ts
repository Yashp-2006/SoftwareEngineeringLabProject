import { normalizeAthleteRows, bucketAthletes } from '../backend/services/tiesheet-generator';

const mockRawRows = [
  {
    "full name": "Athlete One",
    "m/f": "male",
    "yob": "2010",
    "weight (kg)": "55.5",
    "unit": "Dojo Alpha",
    "events": "Kata"
  },
  {
    "student name": "Athlete Two",
    "male/female": "F",
    "birth date": "2008-05-12",
    "body weight": "62",
    "gym": "Club Beta",
    "discipline": "Kumite"
  },
  {
    "competitor": "Athlete Three",
    "sex": "Boy",
    "date of birth": "40232", // Excel serial for 2010-02-23
    "wt": "48 kg",
    "sports body": "Academy Gamma",
    "participating events": "Kata / Kumite"
  }
];

try {
  console.log('Testing normalizeAthleteRows...');
  const normalized = normalizeAthleteRows(mockRawRows);
  console.log('Normalized Rows:', JSON.stringify(normalized, null, 2));

  const athleteOne = normalized.find(a => a.name === 'Athlete One')!;
  const athleteTwo = normalized.find(a => a.name === 'Athlete Two')!;
  const athleteThree = normalized.find(a => a.name === 'Athlete Three')!;

  if (!athleteOne) throw new Error('Athlete One missing');
  if (athleteOne.gender !== 'male') throw new Error('Gender matching failed for Athlete One');
  if (athleteOne.academy !== 'Dojo Alpha') throw new Error('Academy matching failed for Athlete One');
  if (athleteOne.age !== (new Date().getFullYear() - 2010)) throw new Error('Age/YOB matching failed for Athlete One');

  if (!athleteTwo) throw new Error('Athlete Two missing');
  if (athleteTwo.gender !== 'female') throw new Error('Gender matching failed for Athlete Two');
  if (athleteTwo.academy !== 'Club Beta') throw new Error('Academy matching failed for Athlete Two');
  if (athleteTwo.age !== (new Date().getFullYear() - 2008)) throw new Error('Age/BirthDate matching failed for Athlete Two');

  if (!athleteThree) throw new Error('Athlete Three missing');
  if (athleteThree.gender !== 'male') throw new Error('Gender matching failed for Athlete Three');
  if (athleteThree.academy !== 'Academy Gamma') throw new Error('Academy matching failed for Athlete Three');
  if (athleteThree.age !== (new Date().getFullYear() - 2010)) throw new Error('Age/ExcelSerial matching failed for Athlete Three');
  if (athleteThree.weight !== 48) throw new Error('Weight unit strip matching failed for Athlete Three');

  console.log('All normalization assertions passed! ✓');

  console.log('Testing bucketing...');
  const result = bucketAthletes(normalized);
  console.log('Bucketed Categories:', [...result.categoryMap.keys()]);
  console.log('Bucketing passed! ✓');

} catch (err: any) {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
}
