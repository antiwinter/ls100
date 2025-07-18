import axios from 'axios';

const testWords = ['hello', 'computer', 'serendipity'];

async function testFreeDictionary() {
  console.log('Testing Free Dictionary API...\n');
  
  for (const word of testWords) {
    try {
      const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      const data = response.data[0];
      
      console.log(`Word: ${word}`);
      console.log(`Definition: ${data.meanings[0].definitions[0].definition}`);
      console.log(`Phonetic: ${data.phonetic || 'N/A'}`);
      console.log('---');
    } catch (error) {
      console.log(`Error for ${word}: ${error.message}`);
      console.log('---');
    }
  }
}

testFreeDictionary(); 