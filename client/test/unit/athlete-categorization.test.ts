import { describe, it, expect } from 'vitest';
import { normalizeAthleteRows, bucketAthletes } from '@taikaix/backend/services/tiesheet/generator';

describe('Athlete Ingestion & Normalization Engine', () => {
  it('correctly maps varied weight header variants to numeric weight', () => {
    const rawExcelData = [
      { 'Name': 'Kenji Sato', 'Weight (kg)': '67.5', 'Age': '21', 'Dojo': 'Tiger Dojo' },
      { 'Name': 'Alex Rivera', 'wt': '75', 'Age': '24', 'Club': 'Eagle Karate' },
      { 'Name': 'Sara Conner', 'body weight': 55, 'Age': '19', 'Academy': 'Lion Academy' },
    ];

    const normalized = normalizeAthleteRows(rawExcelData);

    expect(normalized).toHaveLength(3);
    const kenji = normalized.find(a => a.name === 'Kenji Sato');
    const alex = normalized.find(a => a.name === 'Alex Rivera');
    const sara = normalized.find(a => a.name === 'Sara Conner');

    expect(kenji?.weight).toBe(67.5);
    expect(alex?.weight).toBe(75);
    expect(sara?.weight).toBe(55);
  });

  it('correctly extracts academy from club/dojo/team/school column variants', () => {
    const rawExcelData = [
      { 'Athlete': 'Athlete 1', 'Club': 'Tokyo Shotokan' },
      { 'Participant': 'Athlete 2', 'Team': 'Kyoto Goju' },
      { 'Player': 'Athlete 3', 'Dojo': 'Osaka Shito' },
    ];

    const normalized = normalizeAthleteRows(rawExcelData);

    expect(normalized[0].academy).toBe('Tokyo Shotokan');
    expect(normalized[1].academy).toBe('Kyoto Goju');
    expect(normalized[2].academy).toBe('Osaka Shito');
  });

  it('combines separate first name and last name into full name', () => {
    const rawExcelData = [
      { 'First Name': 'Ryota', 'Last Name': 'Murata', 'Dojo': 'Samurai Club' },
    ];

    const normalized = normalizeAthleteRows(rawExcelData);

    expect(normalized[0].name).toBe('Ryota Murata');
  });

  it('sanitizes telephone numbers and prevents scientific notation', () => {
    const rawExcelData = [
      { 'Name': 'John Doe', 'Mobile': 9876543210, 'Dojo': 'Alpha' },
    ];

    const normalized = normalizeAthleteRows(rawExcelData);

    expect(normalized[0].phone).toBe('9876543210');
  });

  it('enforces min <= value < max boundary rules for both weight and age', () => {
    // Custom category definition: 50kg <= weight < 65kg, and 14 <= age < 16
    const customCats = [
      {
        name: 'Cadet 50-65kg',
        gender: 'Male',
        minAge: 14,
        maxAge: 16,
        minWeight: 50,
        maxWeight: 65,
      },
      {
        name: 'Junior 65-80kg',
        gender: 'Male',
        minAge: 16,
        maxAge: 18,
        minWeight: 65,
        maxWeight: 80,
      }
    ];

    const athletes = [
      // Exact min weight boundary: 50.0kg -> should be in Cadet 50-65kg
      { playerId: '1', name: 'Exact Min', gender: 'male', weight: 50.0, age: 14, country: '', state: '', district: '', academy: 'Dojo', interestSpecial: '' },
      // Decimal upper limit: 64.99kg -> should be in Cadet 50-65kg (< 65)
      { playerId: '2', name: 'Decimal Below Max', gender: 'male', weight: 64.99, age: 15, country: '', state: '', district: '', academy: 'Dojo', interestSpecial: '' },
      // Exact max boundary: 65.0kg -> EXCLUDED from Cadet 50-65kg, moves to Junior 65-80kg
      { playerId: '3', name: 'Exact Max Boundary', gender: 'male', weight: 65.0, age: 16, country: '', state: '', district: '', academy: 'Dojo', interestSpecial: '' },
    ];

    const { categoryMap } = bucketAthletes(athletes, [], 'standard', customCats, 'custom');

    const cadetAthletes = categoryMap.get('Cadet 50-65kg') || [];
    const juniorAthletes = categoryMap.get('Junior 65-80kg') || [];

    // Exact min (50.0) and decimal below max (64.99) are in Cadet
    expect(cadetAthletes.some((a: any) => a.name === 'Exact Min')).toBe(true);
    expect(cadetAthletes.some((a: any) => a.name === 'Decimal Below Max')).toBe(true);
    // 65.0 is excluded from Cadet and placed into Junior
    expect(cadetAthletes.some((a: any) => a.name === 'Exact Max Boundary')).toBe(false);
    expect(juniorAthletes.some((a: any) => a.name === 'Exact Max Boundary')).toBe(true);
  });
});
