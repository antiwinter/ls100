import axios from 'axios';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load environment variables from project root
const envPath = '../../.env';
const envContent = readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key] = value;
  }
});

const OPENAI_KEY = process.env.OPENAI_KEY;
const OPENAI_URL = process.env.OPENAI_URL;

console.log('LLM Translation Research for ls100\n');
console.log(`Using: ${OPENAI_URL}`);
console.log(`API Key: ${OPENAI_KEY ? OPENAI_KEY.substring(0, 20) + '...' : 'Not found'}\n`);

// Test scenarios for ls100
const testScenarios = [
  {
    name: "Word-in-Context Translation",
    movieTitle: "The Matrix",
    subtitle: "Neo, sooner or later you're going to realize just as I did that there's a difference between knowing the path and walking the path.",
    word: "path"
  },
  {
    name: "Idiomatic Expression Translation", 
    movieTitle: "Forrest Gump",
    subtitle: "Life is like a box of chocolates, you never know what you're gonna get.",
    word: "box of chocolates"
  },
  {
    name: "Technical Term in Context",
    movieTitle: "The Social Network", 
    subtitle: "We need to think of this as a platform, not just a website.",
    word: "platform"
  }
];

async function checkAvailableModels() {
  try {
    console.log('Checking available models...\n');
    const response = await axios.get(`${OPENAI_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const models = response.data.data;
    console.log(`Found ${models.length} available models:\n`);
    
    // Look for TTS models
    const ttsModels = models.filter(model => 
      model.id.includes('tts') || 
      model.id.includes('speech') || 
      model.id.includes('audio') ||
      model.id.includes('voice') ||
      (model.architecture && typeof model.architecture === 'string' && model.architecture.includes('tts'))
    );
    
    console.log('=== TEXT-TO-SPEECH MODELS ===');
    if (ttsModels.length > 0) {
      ttsModels.forEach(model => {
        console.log(`🔊 ${model.id}`);
        if (model.pricing) {
          console.log(`   Prompt: $${model.pricing.prompt || 0}, Completion: $${model.pricing.completion || 0}`);
        }
        if (model.description) {
          console.log(`   Description: ${model.description}`);
        }
        console.log('');
      });
    } else {
      console.log('❌ No TTS models found');
    }
    
    // Look for free chat models
    const freeModels = models.filter(model => 
      model.pricing && 
      (model.pricing.prompt === 0 || model.pricing.prompt === "0" || 
       model.id.includes('free') || model.id.includes('huggingface'))
    );
    
    console.log('=== FREE CHAT MODELS ===');
    if (freeModels.length > 0) {
      freeModels.slice(0, 10).forEach(model => {
        console.log(`✅ ${model.id}`);
        if (model.pricing) {
          console.log(`   Prompt: $${model.pricing.prompt || 0}, Completion: $${model.pricing.completion || 0}`);
        }
        console.log('');
      });
    }
    
    return { 
      ttsModels: ttsModels,
      freeModels: freeModels,
      firstFree: freeModels.length > 0 ? freeModels[0] : null 
    };
  } catch (error) {
    console.error(`Error checking models: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

async function callLLM(prompt, modelName = "gpt-3.5-turbo") {
  try {
    const response = await axios.post(`${OPENAI_URL}/chat/completions`, {
      model: modelName,
      messages: [
        {
          role: "system", 
          content: "You are a helpful assistant specializing in language learning and translation. Provide clear, educational explanations suitable for English learners."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(`LLM API Error: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

async function testTTSModels(ttsModels) {
  if (ttsModels.length === 0) {
    console.log('❌ No TTS models available to test\n');
    return null;
  }
  
  console.log('=== Testing TTS Models ===');
  const testText = "Hello, welcome to ls100. This is a test of text-to-speech functionality.";
  console.log(`Test text: "${testText}"\n`);
  
  for (const ttsModel of ttsModels.slice(0, 3)) { // Test first 3 TTS models
    console.log(`Testing TTS model: ${ttsModel.id}`);
    
    try {
      // Try TTS-specific endpoint first
      const ttsResponse = await axios.post(`${OPENAI_URL}/audio/speech`, {
        model: ttsModel.id,
        input: testText,
        voice: "alloy" // Default voice
      }, {
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      });
      
      if (ttsResponse.data && ttsResponse.data.byteLength > 0) {
        console.log(`✅ TTS Working! Generated ${ttsResponse.data.byteLength} bytes of audio`);
        return ttsModel.id;
      }
    } catch (ttsError) {
      console.log(`❌ TTS endpoint failed: ${ttsError.message}`);
      
      // Try as regular chat model with TTS prompt
      try {
        const chatResponse = await callLLM(
          `Convert this text to speech: "${testText}". Respond with audio data or instructions.`,
          ttsModel.id
        );
        
        if (chatResponse) {
          console.log(`🤔 Chat response: ${chatResponse.substring(0, 100)}...`);
        } else {
          console.log(`❌ Chat mode also failed`);
        }
      } catch (chatError) {
        console.log(`❌ Both TTS and chat failed for ${ttsModel.id}`);
      }
    }
    console.log('');
  }
  
  return null;
}

async function testLLMTranslation() {
  // First, check available models
  console.log('=== Checking Available Models ===');
  const modelData = await checkAvailableModels();
  
  if (!modelData) {
    console.log('❌ Failed to retrieve model data');
    return;
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test TTS models if available
  let workingTTSModel = null;
  if (modelData.ttsModels.length > 0) {
    workingTTSModel = await testTTSModels(modelData.ttsModels);
    console.log('='.repeat(60) + '\n');
  }
  
  // Try to find a working chat model
  let workingModel = null;
  const modelsToTry = [
    modelData.firstFree?.id,
    "huggingface/microsoft/DialoGPT-medium", 
    "huggingface/google/flan-t5-base",
    "meta-llama/llama-3.2-1b-instruct:free",
    "gpt-3.5-turbo"
  ].filter(Boolean);
  
  console.log('=== Testing Model Connectivity ===');
  
  for (const modelName of modelsToTry) {
    console.log(`Testing model: ${modelName}`);
    const basicTest = await callLLM("Say 'Hello, ls100!' if you can understand me.", modelName);
    
    if (basicTest) {
      console.log('✅ Working! Response:', basicTest);
      workingModel = modelName;
      break;
    } else {
      console.log('❌ Failed');
    }
    console.log('');
  }
  
  if (!workingModel) {
    console.log('❌ No working models found!');
    return;
  }
  
  console.log(`\n✅ Using working chat model: ${workingModel}\n`);
  
  if (workingTTSModel) {
    console.log(`🔊 TTS model available: ${workingTTSModel}\n`);
  } else {
    console.log('❌ No working TTS models found\n');
  }
  
  console.log('=== Testing Translation Scenarios ===\n');

  // Test each scenario
  for (const scenario of testScenarios) {
    console.log(`--- ${scenario.name} ---`);
    console.log(`Movie: ${scenario.movieTitle}`);
    console.log(`Line: "${scenario.subtitle}"`);
    console.log(`Focus word: "${scenario.word}"\n`);
    
    // Generate prompt based on scenario type
    let prompt;
    if (scenario.name === "Word-in-Context Translation") {
      prompt = `From the movie "${scenario.movieTitle}", this subtitle contains the word "${scenario.word}": "${scenario.subtitle}"

Please analyze the word "${scenario.word}" in this context:
1. What does "${scenario.word}" mean in this specific context?
2. What are other common meanings of "${scenario.word}"?
3. How would you translate "${scenario.word}" to Chinese in this context?
4. What is the deeper meaning of this line?
5. Any cultural or philosophical context?

Please be concise but informative.`;
    } else if (scenario.name === "Idiomatic Expression Translation") {
      prompt = `From the movie "${scenario.movieTitle}", analyze this famous line: "${scenario.subtitle}"

Focus on the phrase "${scenario.word}":
1. What does this idiom mean?
2. Why is it culturally significant?
3. How would you translate this to Chinese while preserving the meaning?
4. What's the life philosophy behind this metaphor?
5. Are there similar Chinese idioms?`;
    } else if (scenario.name === "Technical Term in Context") {
      prompt = `From the movie "${scenario.movieTitle}", analyze the word "${scenario.word}" in: "${scenario.subtitle}"

Please explain:
1. What does "${scenario.word}" mean in this tech/business context?
2. How is this different from other meanings of "${scenario.word}"?
3. Best Chinese translation for "${scenario.word}" in this context?
4. Why is the distinction between "${scenario.word}" and "website" important?
5. Example sentences using "${scenario.word}" in similar contexts.`;
    }
    
    const response = await callLLM(prompt, workingModel);
    
    if (response) {
      console.log('LLM Analysis:');
      console.log(response);
    } else {
      console.log('❌ Failed to get response for this scenario');
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }
  
  // Final summary
  console.log('=== RESEARCH SUMMARY ===');
  console.log(`Chat Model: ${workingModel ? '✅ ' + workingModel : '❌ None working'}`);
  console.log(`TTS Model: ${workingTTSModel ? '✅ ' + workingTTSModel : '❌ None working'}`);
  
  if (workingModel && workingTTSModel) {
    console.log('\n🎉 FULL SUITE AVAILABLE: Chat + TTS for complete ls100 integration!');
  } else if (workingModel) {
    console.log('\n✅ Chat model working - can provide text analysis and translation');
  } else {
    console.log('\n❌ No working models found');
  }
}

testLLMTranslation(); 