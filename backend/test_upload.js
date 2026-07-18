require('dotenv').config();
const supabase = require('./src/models/supabaseClient');

async function test() {
  const dummyBuffer = Buffer.from('test image', 'utf-8');
  const fileName = `test-upload-${Date.now()}.txt`;
  
  console.log('Fetching all available buckets...');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  console.log('Available Buckets:', buckets?.map(b => b.name) || bucketError);

  console.log('Testing upload to photos bucket...');
  const { data, error } = await supabase.storage
    .from('photos')
    .upload(fileName, dummyBuffer, {
      contentType: 'text/plain',
      upsert: true,
      duplex: 'half'
    });
    
  if (error) {
    console.error('Upload Error:', error);
  } else {
    console.log('Upload Success:', data);
    
    const { data: publicUrlData } = supabase.storage
      .from('photos')
      .getPublicUrl(fileName);
      
    console.log('Public URL:', publicUrlData.publicUrl);
  }
}
test();
