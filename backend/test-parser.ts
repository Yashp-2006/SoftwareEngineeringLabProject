import * as fs from 'fs';
import * as xlsx from 'xlsx';
import { parseExcelIntoCategories } from './services/tiesheet-generator';

function test() {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet([
    {
      "Name": "Yash Player",
      "Gender": "Male",
      "Weight": 70,
      "Age": 20,
      "Country": "USA",
      "State": "CA",
      "District": "LA",
      "Academy": "Tiger Dojo",
      "interest to play kata": "yes",
      "kumite": "yes"
    }
  ]);
  xlsx.utils.book_append_sheet(wb, ws, 'Roster');
  const buffer = xlsx.write(wb, { type: 'buffer' });
  
  const result = parseExcelIntoCategories(buffer.buffer);
  console.log("Parsed Categories:");
  for (const [key, value] of result.categoryMap.entries()) {
    console.log(`- ${key}: ${value.length} athletes`);
  }
}

test();
