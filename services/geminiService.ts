import { GoogleGenAI } from "@google/genai";

const getApiKey = (): string | null => {
  try {
    // Vite: use import.meta.env and allow fallback
    const key = (import.meta as any)?.env?.VITE_GOOGLE_API_KEY || (window as any)?.VITE_GOOGLE_API_KEY || null;
    return typeof key === 'string' && key.trim().length > 0 ? key : null;
  } catch {
    return null;
  }
};

const getClient = (): GoogleGenAI | null => {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const geminiService = {
  /**
   * Generates a maintenance plan based on equipment details.
   */
  generateMaintenancePlan: async (equipmentName: string, equipmentType: string, lastMaintenance: string): Promise<string> => {
    try {
      const model = 'gemini-2.5-flash';
      const prompt = `
        Atue como um especialista em manutenção predial.
        Crie um checklist curto e prático de manutenção preventiva para o seguinte equipamento:
        Nome: ${equipmentName}
        Tipo: ${equipmentType}
        Última manutenção: ${lastMaintenance}
        
        Saída desejada: Lista com 5 a 7 itens essenciais para verificar, formatada em Markdown.
      `;

      const client = getClient();
      if (!client) {
        return "Função de IA indisponível: configure a variável VITE_GOOGLE_API_KEY.";
      }
      const response = await client.models.generateContent({
        model,
        contents: prompt,
      });

      return response.text || "Não foi possível gerar o plano no momento.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "Erro ao conectar com o serviço de IA. Verifique sua chave de API.";
    }
  },

  /**
   * Analyzes water consumption data for anomalies.
   */
  analyzeWaterConsumption: async (data: any[]): Promise<string> => {
    try {
      const model = 'gemini-2.5-flash';
      const dataStr = JSON.stringify(data.slice(0, 10)); // Limit data size
      const prompt = `
        Analise os seguintes dados de consumo de água de um condomínio (formato JSON):
        ${dataStr}

        Identifique:
        1. Qual unidade tem o consumo mais alto?
        2. Existe alguma anomalia ou salto suspeito no consumo?
        3. Dê uma recomendação curta para o síndico.
        
        Responda em português, tom profissional e conciso.
      `;

      const client = getClient();
      if (!client) {
        return "Análise de IA indisponível: configure VITE_GOOGLE_API_KEY.";
      }
      const response = await client.models.generateContent({
        model,
        contents: prompt,
      });

      return response.text || "Sem insights disponíveis.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "Erro ao analisar dados.";
    }
  }
};
