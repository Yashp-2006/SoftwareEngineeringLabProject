import xlsx from 'xlsx';

async function testUpload() {
  console.log('Generating mock Excel file...');
  // Create mock data
  const data = [
    {
      'Name': 'John Doe',
      'Age': 25,
      'Weight': '75',
      'Gender': 'Male',
      'Academy': 'Test Academy',
      'Events': 'kumite'
    },
    {
      'Name': 'Jane Smith',
      'Age': 17,
      'Weight': '55',
      'Gender': 'Female',
      'Academy': 'Super Dojo',
      'Events': 'kata'
    }
  ];

  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Athletes');
  
  // Write to a buffer
  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const fileBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  console.log('Sending upload request to localhost:3000...');
  const formData = new FormData();
  formData.append('file', fileBlob, 'roster.xlsx');
  formData.append('compType', 'international');
  formData.append('poolSize', '8');
  formData.append('append', 'false');

  try {
    const res = await fetch('http://localhost:3000/api/competitions/NnK9Jkl8sq4JKib6NDOe/import', {
      method: 'POST',
      body: formData,
    });

    console.log('Response status:', res.status);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error('Request failed:', err);
  }
}

testUpload();
