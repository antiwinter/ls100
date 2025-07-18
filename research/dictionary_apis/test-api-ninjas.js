import axios from 'axios';

const API_KEY = 'your_api_key_here'; // Replace with actual key
const testWords = ['hello', 'computer', 'serendipity'];

async function testAPINinjas() {
  console.log('Testing API Ninjas...\n');
  
  if (API_KEY === 'your_api_key_here') {
    console.log('Please set your API key first!');
    console.log('Get it from: https://api.api-ninjas.com');
    return;
  }
  
  for (const word of testWords) {
    try {
      const response = await axios.get(`https://api.api-ninjas.com/v1/dictionary?word=${word}`, {
        headers: { 'X-Api-Key': API_KEY }
      });
      
      console.log(`Word: ${word}`);
      console.log(`Definition: ${response.data.definition}`);
      console.log('---');
    } catch (error) {
      console.log(`Error for ${word}: ${error.message}`);
      console.log('---');
    }
  }
}

testAPINinjas(); 