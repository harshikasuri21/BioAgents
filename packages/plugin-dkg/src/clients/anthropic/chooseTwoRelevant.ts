import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function chooseTwoRelevantKeywords(
  keywords: string[],
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-3-7-sonnet-latest',
    max_tokens: 5001,
    messages: [
      {
        role: 'user',
        content: `If I were to generate a novel hypothesis and want to test it. 
        I have a list of keywords.
        To ensure my hypothesis is novel, I want to choose two keywords that have not been used in a hypothesis before.
        Which two keywords would you suggest I test first?
        Make sure you follow the exact same case as the keywords.
        Eg. if a keyword is "Alzheimer disease", you should return "Alzheimer disease" not "alzheimer disease".
        Or if a keyword is "neurodegenerative diseases", you should return "neurodegenerative diseases" not "Neurodegenerative diseases".
        Follow the output format exactly.
        DO NOT include any other text in your response.
        INPUT:
        Here are the keywords: ${keywords.join(', ')}
        OUTPUT:
        [KEYWORD1, KEYWORD2]`,
      },
    ],
    thinking: {
      type: 'enabled',
      budget_tokens: 5000,
    },
  });

  if (response.content[1].type === 'text') {
    return response.content[1].text;
  }
  throw new Error('No text content found');
}
