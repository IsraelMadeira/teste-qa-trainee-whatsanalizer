export interface ChatMessage {
  id: string;
  timestamp: Date;
  author: string;
  content: string;
}

export interface ParticipantMetric {
  name: string;
  totalMessages: number;
  percentage: number;
  averageLength: number;
}

export interface SentimentMetric {
  positive: number;
  neutral: number;
  negative: number;
}

export interface DashboardMetrics {
  totalMessages: number;
  participants: ParticipantMetric[];
  topWords: Array<{ word: string; count: number }>;
  busiestHour: string;
  averageMessageLength: number;
  sentiment: SentimentMetric;
}

export interface AnalysisFilters {
  participant: string | null;
  keyword: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface ApiAnalysisRequest {
  messages: Array<{
    timestamp: string;
    author: string;
    content: string;
  }>;
  metrics: DashboardMetrics;
  filters: AnalysisFilters;
}

export interface ApiAnalysisResponse {
  summary: string;
  sentiment: 'positivo' | 'negativo' | 'neutro';
  sentimentDescription: string;
  participants: string[];
  tasks: string[];
  deadlines: string[];
  risks: string[];
  conflicts: string[];
  metrics: Record<string, unknown>;
  confidence: 'low' | 'medium' | 'high';
}

export interface ZAiChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
}
