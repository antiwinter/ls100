import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Paragraph containing "carpe diem"
const carpeDiemText = `
In the movie Dead Poets Society, the teacher encourages his students to embrace the Latin phrase "carpe diem," which means "seize the day." This timeless wisdom reminds us that life is fleeting and precious moments should not be wasted. When we truly understand carpe diem, we realize that each day offers new opportunities for growth, adventure, and meaningful connections. The philosophy behind carpe diem isn't about reckless abandon, but rather about living with intention and making the most of every moment we have been given.
`.trim();

// FreeTTS conversion function
async function convertToSpeech(text, filename) {
  console.log(`🎵 Converting text to speech: "${text.substring(0, 100)}..."`);
  console.log(`📝 Full text length: ${text.length} characters`);
  
  const url = 'https://api.streamelements.com/kappa/v2/speech';
  const params = new URLSearchParams({
    voice: 'Brian',
    text: text
  });
  
  try {
    console.log('🔄 Sending request to FreeTTS API...');
    const response = await fetch(`${url}?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('📦 Downloading audio data...');
    const buffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(buffer);
    
    const filepath = path.join(process.cwd(), `${filename}.mp3`);
    fs.writeFileSync(filepath, audioBuffer);
    
    console.log(`✅ Audio saved to: ${filepath}`);
    console.log(`📏 File size: ${audioBuffer.length} bytes`);
    console.log(`⏱️  Estimated duration: ~${Math.round(text.length / 10)} seconds`);
    
    return filepath;
    
  } catch (error) {
    console.error('❌ FreeTTS Error:', error.message);
    return null;
  }
}

// Main function
async function main() {
  console.log('🎤 Carpe Diem TTS Conversion Test\n');
  console.log('📖 Text to convert:');
  console.log('-'.repeat(60));
  console.log(carpeDiemText);
  console.log('-'.repeat(60));
  
  const audioFile = await convertToSpeech(carpeDiemText, 'carpe_diem_speech');
  
  if (audioFile) {
    console.log('\n🎉 Conversion successful!');
    console.log('\n🎧 To play the audio file:');
    console.log(`   Linux: mpv "${audioFile}" or vlc "${audioFile}"`);
    console.log(`   Windows: start "${audioFile}"`);
    console.log(`   Mac: open "${audioFile}"`);
    
    console.log('\n💡 Try these different voices by modifying the script:');
    console.log('   - Brian (current)');
    console.log('   - Amy');
    console.log('   - Emma');
    console.log('   - Russell');
    console.log('   - Geraint');
  }
}

// Run the conversion
main().catch(console.error); 