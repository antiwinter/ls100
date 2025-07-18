import axios from 'axios';

const testWords = ['hello', 'computer', 'serendipity'];

async function testMyMemoryChineseTranslation() {
  console.log('Testing MyMemory Translation API (English → Chinese)...\n');
  
  for (const word of testWords) {
    try {
      // Test both Simplified and Traditional Chinese
      const simplifiedResponse = await axios.get(`https://api.mymemory.translated.net/get?q=${word}&langpair=en|zh-CN`);
      const traditionalResponse = await axios.get(`https://api.mymemory.translated.net/get?q=${word}&langpair=en|zh-TW`);
      
      console.log(`Word: ${word}`);
      console.log(`Simplified Chinese: ${simplifiedResponse.data.responseData.translatedText}`);
      console.log(`Traditional Chinese: ${traditionalResponse.data.responseData.translatedText}`);
      console.log(`Match Quality: ${simplifiedResponse.data.responseData.match || 'N/A'}`);
      console.log('---');
    } catch (error) {
      console.log(`Error for ${word}: ${error.message}`);
      console.log('---');
    }
  }
}

testMyMemoryChineseTranslation(); 