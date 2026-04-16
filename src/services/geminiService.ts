import { GoogleGenAI } from "@google/genai";

// Use process.env.GEMINI_API_KEY as per skill instructions for React (Vite)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const geminiService = {
  async suggestJournalCategory(title: string, scope?: string | string[]) {
    try {
      const scopeStr = Array.isArray(scope) ? scope.join(', ') : (scope || 'N/A');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on the journal title "${title}" and scope "${scopeStr}", suggest a primary category and a sub-category. 
        Return only a JSON object with "category" and "subCategory" fields.`,
      });
      
      const text = response.text || "";
      // Clean up potential markdown formatting
      const jsonStr = text.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error("AI Category Suggestion Error:", error);
      return null;
    }
  },

  async generateTaskDescription(title: string, context: string) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a professional and detailed description for a CRM task titled "${title}" in the context of "${context}". 
        Keep it actionable and clear. Max 3-4 sentences.`,
      });
      
      return (response.text || "").trim();
    } catch (error) {
      console.error("AI Task Description Error:", error);
      return null;
    }
  },

  async generatePolicy(title: string, category: string) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Write a professional company policy for "${title}" under the category "${category}". 
        Include a brief introduction, key guidelines, and compliance requirements. 
        Format it clearly with sections.`,
      });
      
      return (response.text || "").trim();
    } catch (error) {
      console.error("AI Policy Generation Error:", error);
      return null;
    }
  },

  async generateFAQ(topic: string) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 3 frequently asked questions and their answers for the topic: "${topic}". 
        Return only a JSON array of objects with "question" and "answer" fields.`,
      });
      
      const text = response.text || "";
      const jsonStr = text.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error("AI FAQ Generation Error:", error);
      return [];
    }
  },

  async summarizeActivity(activities: any[]) {
    if (activities.length === 0) return null;
    try {
      const activityStr = activities.map(a => `${a.userName} ${a.action}: ${a.details}`).join('\n');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Summarize the following recent CRM activities into a concise executive summary (2-3 sentences). 
        Highlight the most important updates or trends.
        
        Activities:
        ${activityStr}`,
      });
      
      return (response.text || "").trim();
    } catch (error) {
      console.error("AI Activity Summarization Error:", error);
      return null;
    }
  },

  async getClientInsights(clientData: any) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this client data and provide 3 key insights or recommendations for the account manager. Keep it concise and professional.
        Client: ${JSON.stringify(clientData)}`,
      });
      return (response.text || "").trim();
    } catch (error) {
      console.error("AI Client Insights Error:", error);
      return null;
    }
  },

  async getJournalHealth(journalData: any) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this journal's data and provide a brief health check summary. Mention any missing information or potential issues.
        Journal: ${JSON.stringify(journalData)}`,
      });
      return (response.text || "").trim();
    } catch (error) {
      console.error("AI Journal Health Error:", error);
      return null;
    }
  },

  async generateText(prompt: string) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return (response.text || "").trim();
    } catch (error) {
      console.error("AI Text Generation Error:", error);
      throw error;
    }
  }
};

export default geminiService;
export const getClientInsights = geminiService.getClientInsights;
export const getJournalHealth = geminiService.getJournalHealth;
export const summarizeActivity = geminiService.summarizeActivity;
export const generateTaskDescription = geminiService.generateTaskDescription;
