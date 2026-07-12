const {GoogleGenerativeAI} = require('@google/generative-ai');
require('dotenv').config();

if(!process.env.GEMINI_API_KEY){
    console.warn('WARNING: GEMINI_API_KEY not set. AI features will fail.');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-flash-latest';

/**
 * Returns a configured Gemini model instance with the given system instruction.
 * Gemini uses "systemInstruction" at model-creation time rather than a
 * per-message system role (unlike some other providers).
 */
function getModel(systemInstruction) {
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction,
  });
}

module.exports = { getModel, MODEL_NAME };