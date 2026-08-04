import OpenAI from 'openai';

export function createOpenAiClient({ apiKey, baseURL }) {
  const options = { apiKey };
  if (baseURL) options.baseURL = baseURL;
  return new OpenAI(options);
}
