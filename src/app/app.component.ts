import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, ReactiveFormsModule, ValidationErrors, Validators, FormBuilder } from '@angular/forms';
import { firstValueFrom, map, startWith } from 'rxjs';

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
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly api = inject(ZAiApiService);
  private readonly fb = inject(FormBuilder);

  private readonly defaultSystemPrompt = `Voce e um analista de conversas corporativas.
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
}`;

  readonly calibrationForm = this.fb.nonNullable.group({
    systemPrompt: [this.defaultSystemPrompt],
    model: ['glm-5'],
    temperature: [0.2],
    token: ['', [Validators.required, this.tokenFormatValidator]],
  });

  readonly filtersForm = this.fb.nonNullable.group({
    participant: ['Todos'],
    keyword: [''],
    dateFrom: [''],
    dateTo: [''],
  });

  private readonly calibrationValues = toSignal(
    this.calibrationForm.valueChanges.pipe(
      startWith(this.calibrationForm.getRawValue()),
      map((value) => ({
        systemPrompt: value.systemPrompt ?? this.defaultSystemPrompt,
        model: value.model ?? 'glm-5',
        temperature: typeof value.temperature === 'number' ? value.temperature : 0.2,
        token: value.token ?? '',
      })),
    ),
    { initialValue: this.calibrationForm.getRawValue() },
  );

  private readonly filterValues = toSignal(
    this.filtersForm.valueChanges.pipe(
      startWith(this.filtersForm.getRawValue()),
      map((value) => ({
        participant: value.participant ?? 'Todos',
        keyword: value.keyword ?? '',
        dateFrom: value.dateFrom ?? '',
        dateTo: value.dateTo ?? '',
      })),
    ),
    { initialValue: this.filtersForm.getRawValue() },
  );

  readonly submitAttempted = signal(false);
  readonly tokenBlurVersion = signal(0);

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
  readonly currentTemperature = computed(() => this.calibrationValues().temperature);
  readonly normalizedToken = computed(() => this.calibrationValues().token.trim());
  readonly tokenRequiredError = computed(() => {
    this.calibrationValues();
    this.tokenBlurVersion();
    const control = this.calibrationForm.controls.token;
    return (control.touched || control.dirty || this.submitAttempted()) && control.hasError('required');
  });
  readonly tokenInvalidError = computed(
    () => {
      this.calibrationValues();
      this.tokenBlurVersion();
      const control = this.calibrationForm.controls.token;
      return (control.touched || control.dirty || this.submitAttempted()) && control.hasError('tokenFormat');
    },
  );
  readonly canSubmit = computed(
    () =>
      this.hasLoadedFile() &&
      !this.loading() &&
      this.normalizedToken().length > 0 &&
      this.calibrationForm.controls.token.valid,
  );
  readonly hasActiveFilters = computed(
    () =>
      this.filterValues().participant !== 'Todos' ||
      !!this.filterValues().keyword.trim() ||
      !!this.filterValues().dateFrom.trim() ||
      !!this.filterValues().dateTo.trim(),
  );
  readonly activeFilterChips = computed(() => {
    const chips: string[] = [];
    const filters = this.filterValues();

    if (filters.participant !== 'Todos') {
      chips.push(`Participante: ${filters.participant}`);
    }

    if (filters.keyword.trim()) {
      chips.push(`Palavra-chave: ${filters.keyword.trim()}`);
    }

    if (filters.dateFrom.trim()) {
      chips.push(`Data inicial: ${filters.dateFrom}`);
    }

    if (filters.dateTo.trim()) {
      chips.push(`Data final: ${filters.dateTo}`);
    }

    return chips;
  });

  readonly filteredMessages = computed(() => {
    const filters = this.filterValues();
    const participant = filters.participant;
    const keyword = filters.keyword.trim().toLowerCase();
    const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
    const toDate = filters.dateTo ? new Date(filters.dateTo) : null;

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
    const current = this.filterValues().participant;
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

  resetFilters(): void {
    this.filtersForm.reset({
      participant: 'Todos',
      keyword: '',
      dateFrom: '',
      dateTo: '',
    });
  }

  onTokenBlur(): void {
    this.tokenBlurVersion.update((value) => value + 1);
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
    this.submitAttempted.set(true);
    this.calibrationForm.controls.token.markAsTouched();
    this.calibrationForm.controls.token.updateValueAndValidity({ onlySelf: true });

    const sanitizedToken = this.normalizedToken();

    if (!sanitizedToken) {
      this.error.set('Token e obrigatorio');
      return;
    }

    if (this.calibrationForm.controls.token.hasError('tokenFormat')) {
      this.error.set('Token invalido');
      return;
    }

    if (this.filteredMessages().length === 0) {
      this.error.set('Carregue um arquivo com mensagens validas antes de analisar.');
      return;
    }

    this.loading.set(true);
    this.apiResult.set(null);
    const calibration = this.calibrationForm.getRawValue();
    const filters = this.filtersForm.getRawValue();

    const request: ApiAnalysisRequest = {
      messages: this.filteredMessages().map((message) => ({
        timestamp: message.timestamp.toISOString(),
        author: message.author,
        content: message.content,
      })),
      metrics: this.metrics(),
      filters: {
        participant: filters.participant === 'Todos' ? null : filters.participant,
        keyword: filters.keyword.trim() || null,
        dateFrom: filters.dateFrom || null,
        dateTo: filters.dateTo || null,
      },
    };

    try {
      const result = await firstValueFrom(
        this.api.analyze(
          request,
          sanitizedToken,
          calibration.systemPrompt,
          calibration.model,
          calibration.temperature,
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

  private tokenFormatValidator(control: AbstractControl<string>): ValidationErrors | null {
    const token = control.value;

    if (typeof token !== 'string') {
      return { tokenFormat: true };
    }

    if (token.length <= 10) {
      return { tokenFormat: true };
    }

    return /^[A-Za-z0-9._-]+$/.test(token) ? null : { tokenFormat: true };
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
    const participant = this.filterValues().participant;
    if (participant === 'Todos') {
      return items;
    }

    const needle = participant.toLowerCase();
    return items.filter((item) => item.toLowerCase().includes(needle));
  }
}
