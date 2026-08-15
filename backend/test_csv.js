const xlsx = require('xlsx');
const fs = require('fs');
const buffer = fs.readFileSync('test.csv');
const dataArray = new Uint8Array(buffer);
const workbook = xlsx.read(dataArray, { type: 'array' });
console.log(workbook.SheetNames);
console.log(xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]));
