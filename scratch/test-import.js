const fs = require('fs');
const { parseExcelIntoCategories } = require('../backend/services/tiesheet-generator.ts');
const buffer = new TextEncoder().encode('Name,Age,Gender,Weight,State,District,Academy,Events,Phone,Email\nYash,20,Male,75,State,District,Academy,kata,123,email@email.com').buffer;
try {
  const res = parseExcelIntoCategories(buffer);
  console.log([...res.categoryMap.keys()]);
} catch(e) {
  console.error('ERROR:', e);
}
