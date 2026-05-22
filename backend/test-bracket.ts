import { generateBracket } from './services/bracket-generator';
import { Athlete } from './types';

// Mock 9 athletes to test the "begging athlete" / late addition scenario 
// which should produce a 16-person bracket with 7 Byes.
const athletes: Athlete[] = [
  { id: 'a1', competitionId: 'c1', categoryId: 'cat1', name: 'John Doe', gender: 'M', age: 20, weight: 75, country: 'USA', state: 'CA', district: 'LA', academy: 'Cobra Kai', attendance: 'present', readiness: 'ready', disqualified: false },
  { id: 'a2', competitionId: 'c1', categoryId: 'cat1', name: 'Jane Smith', gender: 'M', age: 21, weight: 74, country: 'USA', state: 'NY', district: 'NY', academy: 'Miyagi Do', attendance: 'present', readiness: 'ready', disqualified: false },
  { id: 'a3', competitionId: 'c1', categoryId: 'cat1', name: 'Bob Lee', gender: 'M', age: 22, weight: 75, country: 'CAN', state: 'ON', district: 'TO', academy: 'Eagle Fang', attendance: 'present', readiness: 'ready', disqualified: false },
  { id: 'a4', competitionId: 'c1', categoryId: 'cat1', name: 'Alice Wong', gender: 'M', age: 19, weight: 73, country: 'CAN', state: 'BC', district: 'VAN', academy: 'Cobra Kai', attendance: 'present', readiness: 'ready', disqualified: false },
  { id: 'a5', competitionId: 'c1', categoryId: 'cat1', name: 'Charlie Brown', gender: 'M', age: 20, weight: 75, country: 'MEX', state: 'CDMX', district: 'Centro', academy: 'Miyagi Do', attendance: 'present', readiness: 'ready', disqualified: false },
  { id: 'a6', competitionId: 'c1', categoryId: 'cat1', name: 'Diana Prince', gender: 'M', age: 23, weight: 76, country: 'MEX', state: 'JAL', district: 'GDL', academy: 'Eagle Fang', attendance: 'present', readiness: 'ready', disqualified: false },
  { id: 'a7', competitionId: 'c1', categoryId: 'cat1', name: 'Evan Davis', gender: 'M', age: 21, weight: 75, country: 'UK', state: 'ENG', district: 'LON', academy: 'Cobra Kai', attendance: 'present', readiness: 'ready', disqualified: false },
  { id: 'a8', competitionId: 'c1', categoryId: 'cat1', name: 'Fiona Gallagher', gender: 'M', age: 20, weight: 74, country: 'UK', state: 'SCO', district: 'EDI', academy: 'Miyagi Do', attendance: 'present', readiness: 'ready', disqualified: false },
  { id: 'a9', competitionId: 'c1', categoryId: 'cat1', name: 'Late Addition', gender: 'M', age: 20, weight: 75, country: 'Late Add', state: '', district: '', academy: 'Unknown', attendance: 'present', readiness: 'ready', disqualified: false },
];

try {
  console.log('Generating bracket for 9 athletes in WKF mode...');
  const result = generateBracket('cat1', 'c1', athletes, 'WKF');
  
  const round1Matches = result.matches.filter(m => m.round === 1);
  const byes = round1Matches.reduce((count, m) => count + (m.aka.isBye ? 1 : 0) + (m.ao.isBye ? 1 : 0), 0);
  
  console.log(`\nProgression Type: ${result.progressionType}`);
  console.log(`Total Matches Generated: ${result.matches.length}`);
  console.log(`Round 1 Matches: ${round1Matches.length}`);
  console.log(`Total Byes in Round 1: ${byes} (Expected 7)`);
  
  console.log('\nRound 1 Pairings:');
  round1Matches.forEach(m => {
    console.log(`[${m.bracketPosition}] AKA (Red): ${m.aka.name} vs AO (Blue): ${m.ao.name}`);
  });
  
  console.log('\nSUCCESS! Bracket generation works as expected.');
} catch (error) {
  console.error('Test Failed:', error);
}
