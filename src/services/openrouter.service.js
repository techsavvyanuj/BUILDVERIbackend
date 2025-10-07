const axios = require('axios');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_MODEL = 'meta-llama/llama-4-maverick:free';

class OpenRouterService {
    async makeRequest(prompt, options = {}) {
        try {
            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: options.model || DEFAULT_MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: options.systemPrompt || 'You are a helpful assistant.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: options.temperature || 0.7,
                    max_tokens: options.maxTokens || 2000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': process.env.APP_URL || 'https://buildveritas.com',
                        'X-Title': 'BuildVeritas AI Budget Estimator'
                    }
                }
            );

            if (!response.data || !response.data.choices || !response.data.choices[0]) {
                throw new Error('Invalid response from OpenRouter API');
            }

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('OpenRouter API error:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            throw error;
        }
    }

    // Specific method for budget estimation
    async getBudgetEstimate(projectData) {
        const systemPrompt = `You are an expert construction cost estimator with deep knowledge of Indian construction markets, 
        labor rates, and material costs. Provide detailed, accurate cost breakdowns based on current market rates.
        IMPORTANT: Return ONLY a valid JSON object without any markdown formatting or additional text. The response must be a raw JSON object with the following structure:
        {
            "total_cost": { "min": number, "max": number },
            "cost_breakdown": [
                {
                    "category": string,
                    "amount": { "min": number, "max": number },
                    "percentage": number,
                    "details": [
                        {
                            "item": string,
                            "quantity": string,
                            "unit_cost": number,
                            "total_cost": number
                        }
                    ]
                }
            ],
            "factors_considered": [
                {
                    "factor": string,
                    "impact": string,
                    "percentage_effect": number
                }
            ],
            "recommendations": [
                {
                    "type": string,
                    "description": string,
                    "potential_savings": number
                }
            ]
        }`;

        try {
            const response = await this.makeRequest(
                JSON.stringify(projectData),
                {
                    model: 'meta-llama/llama-4-maverick:free',
                    systemPrompt,
                    temperature: 0.3, // Lower temperature for more consistent estimates
                    maxTokens: 3000 // Increased for detailed responses
                }
            );

            // Clean and parse the response
            try {
                // Remove markdown formatting if present
                const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
                console.log('Cleaned AI Response:', cleanResponse);
                
                return JSON.parse(cleanResponse);
            } catch (parseError) {
                console.error('Error parsing AI response:', parseError);
                console.error('Raw response:', response);
                throw new Error('Invalid response format from AI');
            }
        } catch (error) {
            console.error('Budget estimation error:', error);
            throw error;
        }
    }
}

module.exports = new OpenRouterService();
