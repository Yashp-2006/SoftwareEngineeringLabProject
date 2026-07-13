import * as xlsx from 'xlsx';

function test() {
  try {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet([{ "Name": "Test" }]);
    xlsx.utils.book_append_sheet(wb, ws, 'Roster');
    
    // Create a Uint8Array buffer (what xlsx.write outputs)
    const uint8array = xlsx.write(wb, { type: 'array' });
    
    // Convert to native ArrayBuffer like `file.arrayBuffer()` would return
    const arrayBuffer = uint8array.buffer.slice(uint8array.byteOffset, uint8array.byteOffset + uint8array.byteLength);

    console.log("Testing xlsx.read with ArrayBuffer...");
    const parsed = xlsx.read(arrayBuffer, { type: 'array' });
    console.log("Success! Sheets:", parsed.SheetNames);
  } catch (e: any) {
    console.error("Error with ArrayBuffer:", e.message);
  }
}

test();
