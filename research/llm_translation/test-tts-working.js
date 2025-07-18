import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Test words for TTS
const testWords = [
  "hello",
  "serendipity", 
  "The path is made by walking"
];

// Test 1: FreeTTS API (actually free)
async function testFreeTTS(text, filename) {
  console.log(`\n🎵 Testing FreeTTS API: "${text}"`);
  
  const url = 'https://api.streamelements.com/kappa/v2/speech';
  const params = new URLSearchParams({
    voice: 'Brian',
    text: text
  });
  
  try {
    const response = await fetch(`${url}?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    const filepath = path.join(process.cwd(), `${filename}_freetts.mp3`);
    fs.writeFileSync(filepath, buffer);
    console.log(`✅ Audio saved to: ${filepath}`);
    console.log(`📏 File size: ${buffer.length} bytes`);
    
  } catch (error) {
    console.error('❌ FreeTTS Error:', error.message);
  }
}

// Test 2: Microsoft Edge TTS (free, no API key required)
async function testEdgeTTS(text, filename) {
  console.log(`\n🎵 Testing Edge TTS API: "${text}"`);
  
  // This uses a public endpoint that mimics Edge's TTS
  const url = 'https://speech.platform.bing.com/synthesize';
  
  const ssml = `
    <speak version='1.0' xml:lang='en-US'>
      <voice xml:lang='en-US' xml:gender='Female' name='en-US-AriaNeural'>
        ${text}
      </voice>
    </speak>`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: ssml
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    const filepath = path.join(process.cwd(), `${filename}_edge.mp3`);
    fs.writeFileSync(filepath, buffer);
    console.log(`✅ Audio saved to: ${filepath}`);
    console.log(`📏 File size: ${buffer.length} bytes`);
    
  } catch (error) {
    console.error('❌ Edge TTS Error:', error.message);
  }
}

// Test 3: TextToSpeech.io API (free tier)
async function testTextToSpeechIO(text, filename) {
  console.log(`\n🎵 Testing TextToSpeech.io: "${text}"`);
  
  const url = 'https://texttospeech.responsivevoice.org/v1/text:synthesize';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text: text },
        voice: { languageCode: 'en-US', name: 'en-US-Standard-C' },
        audioConfig: { audioEncoding: 'MP3' }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Response:', errorText);
      return;
    }
    
    const result = await response.json();
    
    if (result.audioContent) {
      const audioData = Buffer.from(result.audioContent, 'base64');
      const filepath = path.join(process.cwd(), `${filename}_responsivevoice.mp3`);
      fs.writeFileSync(filepath, audioData);
      console.log(`✅ Audio saved to: ${filepath}`);
      console.log(`📏 File size: ${audioData.length} bytes`);
    } else {
      console.log('❌ No audio content in response');
    }
    
  } catch (error) {
    console.error('❌ TextToSpeech.io Error:', error.message);
  }
}

// Test 4: Simple TTS using system command (if espeak is available)
async function testEspeakTTS(text, filename) {
  console.log(`\n🎵 Testing espeak TTS: "${text}"`);
  
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execPromise = promisify(exec);
  
  try {
    // Check if espeak is installed
    await execPromise('which espeak');
    
    const outputFile = path.join(process.cwd(), `${filename}_espeak.wav`);
    const command = `espeak "${text}" -w ${outputFile}`;
    
    await execPromise(command);
    console.log(`✅ Audio saved to: ${outputFile}`);
    
    // Check file size
    const stats = fs.statSync(outputFile);
    console.log(`📏 File size: ${stats.size} bytes`);
    
  } catch (error) {
    console.log('❌ espeak TTS not available (install with: sudo apt-get install espeak)');
  }
}

// Test 5: Generate simple TTS HTML for ResponsiveVoice (browser test)
function generateResponsiveVoiceHTML() {
  console.log('\n🎵 Generating ResponsiveVoice HTML test...');
  
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>ResponsiveVoice TTS Test</title>
    <script src="https://code.responsivevoice.org/responsivevoice.js?key=free"></script>
</head>
<body>
    <h1>ResponsiveVoice TTS Test</h1>
    
    <div id="tests">
        <button onclick="testTTS('hello', 'UK English Female')">Test: Hello</button><br><br>
        <button onclick="testTTS('serendipity', 'US English Female')">Test: Serendipity</button><br><br>
        <button onclick="testTTS('The path is made by walking', 'UK English Male')">Test: Long sentence</button><br><br>
    </div>
    
    <div id="status"></div>
    
    <script>
        function testTTS(text, voice) {
            const status = document.getElementById('status');
            status.innerHTML = 'Speaking: "' + text + '" with voice: ' + voice;
            
            responsiveVoice.speak(text, voice, {
                onstart: function() {
                    status.innerHTML += '<br>✅ Started speaking...';
                },
                onend: function() {
                    status.innerHTML += '<br>✅ Finished speaking.';
                }
            });
        }
        
        // Test when page loads
        window.onload = function() {
            document.getElementById('status').innerHTML = '✅ ResponsiveVoice loaded successfully!';
        };
    </script>
</body>
</html>`;

  const filepath = path.join(process.cwd(), 'responsivevoice_test.html');
  fs.writeFileSync(filepath, html);
  console.log(`✅ HTML test saved to: ${filepath}`);
  console.log('🌐 Open this file in a browser to test ResponsiveVoice TTS');
}

// Main test function
async function runTTSTests() {
  console.log('🎤 Starting Advanced TTS Tests...\n');
  
  for (let i = 0; i < testWords.length; i++) {
    const word = testWords[i];
    const filename = `tts_test_${i + 1}`;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: "${word}"`);
    console.log(`${'='.repeat(60)}`);
    
    // Test multiple TTS services
    await testFreeTTS(word, filename);
    await testEdgeTTS(word, filename);
    await testTextToSpeechIO(word, filename);
    await testEspeakTTS(word, filename);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Generate ResponsiveVoice HTML test
  generateResponsiveVoiceHTML();
  
  console.log('\n🎉 TTS Tests completed!');
  console.log('\n📁 Generated audio files:');
  
  // List generated audio files
  const audioFiles = fs.readdirSync(process.cwd())
    .filter(file => file.match(/^tts_test_\d+_.+\.(mp3|wav)$/))
    .sort();
    
  audioFiles.forEach(file => {
    const stats = fs.statSync(file);
    console.log(`   ${file} (${stats.size} bytes)`);
  });
  
  // List HTML test file
  const htmlFiles = fs.readdirSync(process.cwd())
    .filter(file => file.endsWith('.html'));
    
  if (htmlFiles.length > 0) {
    console.log('\n🌐 HTML test files:');
    htmlFiles.forEach(file => console.log(`   ${file}`));
  }
  
  if (audioFiles.length > 0) {
    console.log('\n🎧 To play audio files, use:');
    console.log('   Linux: mpv filename.mp3 or vlc filename.mp3');
    console.log('   Windows: start filename.mp3');
    console.log('   Mac: open filename.mp3');
  }
  
  console.log('\n📝 Summary of TTS services tested:');
  console.log('   1. StreamElements TTS (free, no key required)');
  console.log('   2. Microsoft Edge TTS (free, high quality)');
  console.log('   3. ResponsiveVoice (browser-based, free tier)');
  console.log('   4. espeak (local system TTS)');
  console.log('\n💡 Recommendation: StreamElements or Edge TTS for API usage');
  console.log('   ResponsiveVoice for browser-based applications');
}

// Run tests
runTTSTests().catch(console.error); 