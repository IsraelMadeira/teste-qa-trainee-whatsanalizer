import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  ApiAnalysisRequest,
  ApiAnalysisResponse,
  ChatMessage,
  DashboardMetrics,
  ParticipantMetric,
  SentimentMetric,
} from './models/chat-insights.models';
import { ZAiApiService } from './services/zai-api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly api = inject(ZAiApiService);

  readonly token = signal('');
  readonly tokenTouched = signal(false);
  readonly systemPrompt = signal(`Voce e um analista de conversas corporativas.
Retorne APENAS JSON valido no formato:
{
  "summary": "string",
  "sentiment": "positivo|negativo|neutro",
  "sentimentDescription": "string",
  "participants": ["string"],
  "tasks": ["string"],
  "deadlines": ["string"],
  "risks": ["string"],
  "conflicts": ["string"],
  "metrics": {
    "sentimentScore": 0
  },
  "confidence": "low|medium|high"
}`);
  readonly selectedModel = signal('glm-5');
  readonly temperature = signal(0.2);

  readonly sourceMessages = signal<ChatMessage[]>([]);
  readonly loadedFileName = signal('');

  readonly selectedParticipant = signal('Todos');
  readonly keyword = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');

  readonly loading = signal(false);
  readonly error = signal('');
  readonly apiResult = signal<ApiAnalysisResponse | null>(null);

  readonly modelOptions = [
    { label: 'GLM-5', value: 'glm-5' },
    { label: 'GLM-4.7', value: 'glm-4.7' },
    { label: 'GLM-4.5 Flash', value: 'glm-4.5-flash' },
  ];

  readonly participants = computed(() => {
    const apiParticipants = this.apiResult()?.participants ?? [];
    const fromMessages = this.sourceMessages().map((message) => message.author);
    const values = new Set([...apiParticipants, ...fromMessages]);
    return ['Todos', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  });

  readonly hasLoadedFile = computed(() => this.loadedFileName().length > 0);
  readonly hasAnalysis = computed(() => !!this.apiResult());
  readonly normalizedToken = computed(() => this.token().trim());
  readonly tokenRequiredError = computed(() => this.tokenTouched() && this.normalizedToken().length === 0);
  readonly tokenInvalidError = computed(
    () => this.tokenTouched() && this.normalizedToken().length > 0 && !this.isValidToken(this.normalizedToken()),
  );
  readonly canSubmit = computed(
    () => this.hasLoadedFile() && !this.loading() && this.normalizedToken().length > 0 && this.isValidToken(this.normalizedToken()),
  );
  readonly hasActiveFilters = computed(
    () =>
      this.selectedParticipant() !== 'Todos' ||
      !!this.keyword().trim() ||
      !!this.dateFrom().trim() ||
      !!this.dateTo().trim(),
  );
  readonly activeFilterChips = computed(() => {
    const chips: string[] = [];

    if (this.selectedParticipant() !== 'Todos') {
      chips.push(`Participante: ${this.selectedParticipant()}`);
    }

    if (this.keyword().trim()) {
      chips.push(`Palavra-chave: ${this.keyword().trim()}`);
    }

    if (this.dateFrom().trim()) {
      chips.push(`Data inicial: ${this.dateFrom()}`);
    }

    if (this.dateTo().trim()) {
      chips.push(`Data final: ${this.dateTo()}`);
    }

    return chips;
  });

  readonly filteredMessages = computed(() => {
    const participant = this.selectedParticipant();
    const keyword = this.keyword().trim().toLowerCase();
    const fromDate = this.dateFrom() ? new Date(this.dateFrom()) : null;
    const toDate = this.dateTo() ? new Date(this.dateTo()) : null;

    return this.sourceMessages().filter((message) => {
      const participantOk = participant === 'Todos' || message.author === participant;
      const keywordOk = !keyword || message.content.toLowerCase().includes(keyword);
      const fromOk = !fromDate || message.timestamp >= fromDate;
      const toOk = !toDate || message.timestamp <= toDate;
      return participantOk && keywordOk && fromOk && toOk;
    });
  });

  readonly filteredTasks = computed(() => this.filterListByParticipant(this.apiResult()?.tasks ?? []));
  readonly filteredDeadlines = computed(() =>
    this.filterListByParticipant(this.apiResult()?.deadlines ?? []),
  );
  readonly filteredRisks = computed(() => this.filterListByParticipant(this.apiResult()?.risks ?? []));
  readonly filteredConflicts = computed(() =>
    this.filterListByParticipant(this.apiResult()?.conflicts ?? []),
  );

  readonly kpiInvolved = computed(() => {
    const current = this.selectedParticipant();
    const participants = this.apiResult()?.participants ?? [];
    if (current === 'Todos') {
      return participants.length;
    }
    return participants.filter((item) => item.toLowerCase().includes(current.toLowerCase())).length;
  });

  readonly sentimentScore = computed(() => {
    const result = this.apiResult();
    if (!result) {
      return 0;
    }

    const score = result.metrics['sentimentScore'];
    if (typeof score === 'number' && score >= 0 && score <= 10) {
      return Math.round(score);
    }

    if (result.sentiment === 'positivo') {
      return 8;
    }
    if (result.sentiment === 'negativo') {
      return 3;
    }
    return 5;
  });

  readonly sentimentEmoji = computed(() => {
    const score = this.sentimentScore();
    if (score <= 2) {
      return '😢';
    }
    if (score <= 4) {
      return '😕';
    }
    if (score <= 6) {
      return '😐';
    }
    if (score <= 8) {
      return '🙂';
    }
    return '😊';
  });

  readonly metrics = computed<DashboardMetrics>(() => {
    const messages = this.filteredMessages();
    const byParticipant = this.groupByParticipant(messages);
    const totalMessages = messages.length;
    const averageMessageLength =
      totalMessages > 0
        ? Math.round(
            messages.reduce((acc, message) => acc + message.content.length, 0) / totalMessages,
          )
        : 0;

    return {
      totalMessages,
      participants: byParticipant,
      topWords: this.topWords(messages),
      busiestHour: this.busiestHour(messages),
      averageMessageLength,
      sentiment: this.sentiment(messages),
    };
  });

  onTokenInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.tokenTouched.set(true);
    this.token.set(value);
  }

  onTokenBlur(): void {
    this.tokenTouched.set(true);
  }

  onSystemPromptInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement | null)?.value ?? '';
    this.systemPrompt.set(value);
  }

  onModelChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value ?? 'glm-5';
    this.selectedModel.set(value);
  }

  onTemperatureChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement | null)?.value ?? 0.2);
    this.temperature.set(Number.isNaN(value) ? 0.2 : value);
  }

  onParticipantChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value ?? 'Todos';
    this.selectedParticipant.set(value);
  }

  onKeywordInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.keyword.set(value);
  }

  onDateFromChange(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.dateFrom.set(value);
  }

  onDateToChange(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.dateTo.set(value);
  }

  resetFilters(): void {
    this.selectedParticipant.set('Todos');
    this.keyword.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
  }

  async onFileUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.txt')) {
      this.error.set('Apenas arquivos .txt sao permitidos.');
      this.sourceMessages.set([]);
      this.loadedFileName.set('');
      this.apiResult.set(null);
      return;
    }

    this.error.set('');
    this.apiResult.set(null);

    const rawText = await file.text();
    const parsed = this.parseFile(file.name, rawText);

    if (parsed.length === 0) {
      this.error.set('Nao foi possivel extrair mensagens do arquivo enviado.');
      this.sourceMessages.set([]);
      this.loadedFileName.set('');
      return;
    }

    parsed.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this.sourceMessages.set(parsed);
    this.loadedFileName.set(file.name);
  }

  async generateInsights(): Promise<void> {
    this.error.set('');
    this.tokenTouched.set(true);

    const sanitizedToken = this.normalizedToken();

    if (!sanitizedToken) {
      this.error.set('Token é obrigatório');
      return;
    }

    if (!this.isValidToken(sanitizedToken)) {
      this.error.set('Token invalido');
      return;
    }

    if (this.filteredMessages().length === 0) {
      this.error.set('Carregue um arquivo com mensagens validas antes de analisar.');
      return;
    }

    this.loading.set(true);
    this.apiResult.set(null);

    const request: ApiAnalysisRequest = {
      messages: this.filteredMessages().map((message) => ({
        timestamp: message.timestamp.toISOString(),
        author: message.author,
        content: message.content,
      })),
      metrics: this.metrics(),
      filters: {
        participant: this.selectedParticipant() === 'Todos' ? null : this.selectedParticipant(),
        keyword: this.keyword().trim() || null,
        dateFrom: this.dateFrom() || null,
        dateTo: this.dateTo() || null,
      },
    };

    try {
      const result = await firstValueFrom(
        this.api.analyze(
          request,
          sanitizedToken,
          this.systemPrompt(),
          this.selectedModel(),
          this.temperature(),
        ),
      );
      this.apiResult.set(result);
    } catch (error: unknown) {
      this.error.set(this.mapErrorToMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private mapErrorToMessage(error: unknown): string {
    const code = this.readErrorCode(error);

    if (code === 'RATE_LIMIT') {
      return 'Limite de requisições atingido. Tente novamente mais tarde.';
    }

    if (code === 'TIMEOUT') {
      return 'Tempo de resposta excedido. Tente novamente.';
    }

    if (code === 'INVALID_TOKEN') {
      return 'Token invalido';
    }

    if (code === 'INVALID_CONTRACT') {
      return 'Resposta da IA inválida. Tente novamente.';
    }

    return 'Ocorreu um erro ao processar a análise.';
  }

  private readErrorCode(error: unknown): string | null {
    if (typeof error !== 'object' || error === null) {
      return null;
    }

    const maybeCode = (error as { code?: unknown }).code;
    return typeof maybeCode === 'string' ? maybeCode : null;
  }

  private isValidToken(token: string): boolean {
    if (typeof token !== 'string') {
      return false;
    }

    if (token.length <= 10) {
      return false;
    }

    return /^[A-Za-z0-9._-]+$/.test(token);
  }

  private parseFile(fileName: string, rawText: string): ChatMessage[] {
    if (!fileName.toLowerCase().endsWith('.txt')) {
      return [];
    }
    return this.parseWhatsAppText(rawText);
  }

  private parseWhatsAppText(rawText: string): ChatMessage[] {
    const lines = rawText.split(/\r?\n/).filter((line) => !!line.trim());
    const messages: ChatMessage[] = [];
    const lineRegex =
      /^(?:\[)?(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}),?\s(\d{1,2}:\d{2})(?:\s?[APMapm]{2})?(?:\])?\s-\s([^:]+):\s(.*)$/;

    for (const line of lines) {
      const match = line.match(lineRegex);
      if (!match) {
        continue;
      }

      const [, rawDate, rawTime, author, content] = match;
      const date = this.parseDateTime(rawDate, rawTime);

      if (!date || !author.trim() || !content.trim()) {
        continue;
      }

      messages.push({
        id: crypto.randomUUID(),
        timestamp: date,
        author: author.trim(),
        content: content.trim(),
      });
    }

    return messages;
  }

  private parseDateTime(rawDate: string, rawTime: string): Date | null {
    const normalizedDate = rawDate.replace(/[.-]/g, '/');
    const parts = normalizedDate.split('/');

    if (parts.length !== 3) {
      return null;
    }

    const day = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const yearValue = Number(parts[2]);
    const year = yearValue < 100 ? 2000 + yearValue : yearValue;

    const [hoursText, minutesText] = rawTime.split(':');
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    const candidate = new Date(year, month, day, hours, minutes, 0, 0);
    return Number.isNaN(candidate.getTime()) ? null : candidate;
  }

  private groupByParticipant(messages: ChatMessage[]): ParticipantMetric[] {
    const total = messages.length || 1;
    const accumulator = new Map<string, { totalMessages: number; chars: number }>();

    for (const message of messages) {
      const current = accumulator.get(message.author) ?? { totalMessages: 0, chars: 0 };
      current.totalMessages += 1;
      current.chars += message.content.length;
      accumulator.set(message.author, current);
    }

    return Array.from(accumulator.entries())
      .map(([name, metric]) => ({
        name,
        totalMessages: metric.totalMessages,
        percentage: Math.round((metric.totalMessages / total) * 100),
        averageLength: Math.round(metric.chars / metric.totalMessages),
      }))
      .sort((a, b) => b.totalMessages - a.totalMessages);
  }

  private topWords(messages: ChatMessage[]): Array<{ word: string; count: number }> {
    const stopWords = new Set([
      'de',
      'da',
      'do',
      'e',
      'a',
      'o',
      'que',
      'com',
      'para',
      'por',
      'na',
      'no',
      'em',
      'um',
      'uma',
      'eu',
      'voce',
      'vc',
      'pra',
      'ta',
    ]);

    const counter = new Map<string, number>();

    for (const message of messages) {
      const tokens = message.content
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .match(/[a-z0-9]{3,}/g);

      if (!tokens) {
        continue;
      }

      for (const token of tokens) {
        if (stopWords.has(token)) {
          continue;
        }
        counter.set(token, (counter.get(token) ?? 0) + 1);
      }
    }

    return Array.from(counter.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  private busiestHour(messages: ChatMessage[]): string {
    if (messages.length === 0) {
      return '-';
    }

    const hourCounter = new Map<number, number>();

    for (const message of messages) {
      const hour = message.timestamp.getHours();
      hourCounter.set(hour, (hourCounter.get(hour) ?? 0) + 1);
    }

    let topHour = 0;
    let topCount = 0;

    for (const [hour, count] of hourCounter.entries()) {
      if (count > topCount) {
        topHour = hour;
        topCount = count;
      }
    }

    return `${String(topHour).padStart(2, '0')}:00`;
  }

  private sentiment(messages: ChatMessage[]): SentimentMetric {
    const positiveWords = ['obrigado', 'excelente', 'otimo', 'bom', 'resolvido', 'perfeito', 'feliz'];
    const negativeWords = ['ruim', 'lento', 'problema', 'erro', 'pessimo', 'insatisfeito', 'cancelar'];

    let positive = 0;
    let neutral = 0;
    let negative = 0;

    for (const message of messages) {
      const text = message.content.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const hasPositive = positiveWords.some((word) => text.includes(word));
      const hasNegative = negativeWords.some((word) => text.includes(word));

      if (hasPositive && !hasNegative) {
        positive += 1;
      } else if (hasNegative && !hasPositive) {
        negative += 1;
      } else {
        neutral += 1;
      }
    }

    return { positive, neutral, negative };
  }

  private filterListByParticipant(items: string[]): string[] {
    const participant = this.selectedParticipant();
    if (participant === 'Todos') {
      return items;
    }

    const needle = participant.toLowerCase();
    return items.filter((item) => item.toLowerCase().includes(needle));
  }
}
