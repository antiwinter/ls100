import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Test words for TTS
const testWords = [
  "hello",
  "serendipity", 
  "The path is made by walking"
];

// Test 1: Free TTS API (VoiceRSS - free tier)
async function testVoiceRSS(text, filename) {
  console.log(`\n🎵 Testing VoiceRSS TTS: "${text}"`);
  
  const apiKey = 'demo'; // Demo key for testing
  const url = `https://api.voicerss.org/?key=${apiKey}&hl=en-us&src=${encodeURIComponent(text)}&c=MP3&f=44khz_16bit_stereo`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (contentType && contentType.includes('audio')) {
      const buffer = await response.buffer();
      const filepath = path.join(process.cwd(), `${filename}.mp3`);
      fs.writeFileSync(filepath, buffer);
      console.log(`✅ Audio saved to: ${filepath}`);
      console.log(`📏 File size: ${buffer.length} bytes`);
    } else {
      const text = await response.text();
      console.log('❌ Not audio response:', text);
    }
    
  } catch (error) {
    console.error('❌ VoiceRSS Error:', error.message);
  }
}

// Test 2: gTTS (Google Text-to-Speech) via API
async function testGoogleTTS(text, filename) {
  console.log(`\n🎵 Testing Google TTS: "${text}"`);
  
  // Note: This is a demo endpoint, real Google TTS requires API key
  const url = 'https://translate.google.com/translate_tts';
  const params = new URLSearchParams({
    ie: 'UTF-8',
    q: text,
    tl: 'en',
    client: 'tw-ob'
  });
  
  try {
    const response = await fetch(`${url}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    const filepath = path.join(process.cwd(), `${filename}_google.mp3`);
    fs.writeFileSync(filepath, buffer);
    console.log(`✅ Audio saved to: ${filepath}`);
    console.log(`📏 File size: ${buffer.length} bytes`);
    
  } catch (error) {
    console.error('❌ Google TTS Error:', error.message);
  }
}

// Test 3: Festival TTS (if available locally)
async function testFestivalTTS(text, filename) {
  console.log(`\n🎵 Testing Festival TTS: "${text}"`);
  
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execPromise = promisify(exec);
  
  try {
    // Check if festival is installed
    await execPromise('which festival');
    
    const outputFile = path.join(process.cwd(), `${filename}_festival.wav`);
    const command = `echo "${text}" | festival --tts --pipe > ${outputFile}`;
    
    await execPromise(command);
    console.log(`✅ Audio saved to: ${outputFile}`);
    
    // Check file size
    const stats = fs.statSync(outputFile);
    console.log(`📏 File size: ${stats.size} bytes`);
    
  } catch (error) {
    console.log('❌ Festival TTS not available (install with: sudo apt-get install festival)');
  }
}

// Main test function
async function runTTSTests() {
  console.log('🎤 Starting TTS API Tests...\n');
  
  for (let i = 0; i < testWords.length; i++) {
    const word = testWords[i];
    const filename = `tts_test_${i + 1}`;
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing: "${word}"`);
    console.log(`${'='.repeat(50)}`);
    
    // Test multiple TTS services
    await testVoiceRSS(word, filename);
    await testGoogleTTS(word, filename);
    await testFestivalTTS(word, filename);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🎉 TTS Tests completed!');
  console.log('\n📁 Generated audio files:');
  
  // List generated audio files
  const audioFiles = fs.readdirSync(process.cwd())
    .filter(file => file.match(/^tts_test_\d+\.(mp3|wav)$/))
    .sort();
    
  audioFiles.forEach(file => {
    const stats = fs.statSync(file);
    console.log(`   ${file} (${stats.size} bytes)`);
  });
  
  if (audioFiles.length > 0) {
    console.log('\n🎧 To play audio files, use:');
    console.log('   Linux: mpv filename.mp3 or vlc filename.mp3');
    console.log('   Windows: start filename.mp3');
    console.log('   Mac: open filename.mp3');
  }
}

// Run tests
runTTSTests().catch(console.error); 