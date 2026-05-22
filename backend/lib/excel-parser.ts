// backend/lib/excel-parser.ts
import * as xlsx from 'xlsx';
import { Athlete } from '../types';

export interface ParsedExcelRow {
  name: string;
  gender: 'M' | 'F';
  age: number;
  weight: number;
  country: string;
  state: string;
  district: string;
  academy: string;
  seedRating?: number;
}

/**
 * Parses an Excel or CSV buffer and extracts athlete data.
 * Validates essential fields and normalizes strings.
 */
export function parseAthleteRoster(buffer: Buffer): ParsedExcelRow[] {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert sheet to JSON array, mapping headers to properties
  const rawData = xlsx.utils.sheet_to_json<any>(worksheet);
  
  const athletes: ParsedExcelRow[] = [];

  for (const row of rawData) {
    // Basic validation & normalization
    const name = String(row['Name'] || row['name'] || '').trim();
    if (!name) continue; // Skip empty rows

    const rawGender = String(row['Gender'] || row['gender'] || '').toUpperCase();
    const gender = (rawGender === 'M' || rawGender === 'MALE') ? 'M' : 'F';

    const age = parseInt(row['Age'] || row['age'], 10) || 0;
    const weight = parseFloat(row['Weight'] || row['weight']) || 0;

    const country = String(row['Country'] || row['country'] || 'Unknown').trim();
    const state = String(row['State'] || row['state'] || 'Unknown').trim();
    const district = String(row['District'] || row['district'] || 'Unknown').trim();
    const academy = String(row['Academy'] || row['academy'] || 'Unknown').trim();
    
    const seedRating = row['Seed'] ? parseFloat(row['Seed']) : undefined;

    athletes.push({
      name,
      gender,
      age,
      weight,
      country,
      state,
      district,
      academy,
      seedRating
    });
  }

  return athletes;
}
