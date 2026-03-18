import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, throwError, timeout, TimeoutError } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  ApiAnalysisRequest,
  ApiAnalysisResponse,
  ZAiChatCompletionResponse,
} from '../models/chat-insights.models';
import { WHATSANALIZER_SYSTEM_PROMPT } from '../prompts/system-prompt';

@Injectable({ providedIn: 'root' })
export class ZAiApiService {
  private readonly http = inject(HttpClient);
  private readonly requestTimeoutMs = 150000;

  analyze(
    request: ApiAnalysisRequest,
    token: string,
    systemPrompt?: string,
    model?: string,
    temperature?: number,
  ): Observable<ApiAnalysisResponse> {
    if (!this.isValidToken(token)) {
      return throwError(() => this.createSemanticError('INVALID_TOKEN', 'Token invalido'));
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    const payload = {
      model: model || environment.zai.model,
      temperature: typeof temperature === 'number' ? temperature : 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: systemPrompt?.trim() || WHATSANALIZER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: JSON.stringify(request),
        },
      ],
    };

    return this.http
      .post<ZAiChatCompletionResponse>(environment.zai.apiBaseUrl, payload, { headers })
      .pipe(
        timeout(this.requestTimeoutMs),
        map((response) => this.toAnalysis(response)),
        catchError((error: unknown) => throwError(() => this.normalizeHttpError(error))),
      );
  }

  private toAnalysis(response: ZAiChatCompletionResponse): ApiAnalysisResponse {
    const rawContent = response.choices[0]?.message?.content?.trim();

    if (!rawContent) {
      throw this.createSemanticError('INVALID_CONTRACT', 'Contrato de dados invalido: resposta vazia.');
    }

    try {
      const parsed = JSON.parse(rawContent) as Record<string, unknown>;
      this.validateStrictContract(parsed);

      return {
        summary: parsed['summary'] as string,
        sentiment: parsed['sentiment'] as 'positivo' | 'negativo' | 'neutro',
        sentimentDescription: parsed['sentimentDescription'] as string,
        participants: this.ensureStringArray(parsed['participants']),
        tasks: this.ensureStringArray(parsed['tasks']),
        deadlines: this.ensureStringArray(parsed['deadlines']),
        risks: this.ensureStringArray(parsed['risks']),
        conflicts: this.ensureStringArray(parsed['conflicts']),
        metrics: parsed['metrics'] as Record<string, unknown>,
        confidence: parsed['confidence'] as 'low' | 'medium' | 'high',
      };
    } catch (error: unknown) {
      if (this.isSemanticError(error)) {
        throw error;
      }
      throw this.createSemanticError('INVALID_CONTRACT', 'Contrato de dados invalido: JSON invalido.');
    }
  }

  private normalizeHttpError(error: unknown): Error {
    if (error instanceof TimeoutError) {
      return this.createSemanticError('TIMEOUT', 'Tempo de resposta excedido. Tente novamente.');
    }

    const status = this.readStatus(error);

    if (status === 429) {
      return this.createSemanticError(
        'RATE_LIMIT',
        'Limite de requisições atingido. Tente novamente mais tarde.',
      );
    }

    if (status === 0) {
      return this.createSemanticError('TIMEOUT', 'Tempo de resposta excedido. Tente novamente.');
    }

    if (this.isSemanticError(error)) {
      return error;
    }

    return this.createSemanticError('GENERIC', 'Ocorreu um erro ao processar a análise.');
  }

  private readStatus(error: unknown): number | null {
    if (typeof error !== 'object' || error === null) {
      return null;
    }

    const maybeStatus = (error as { status?: unknown }).status;
    return typeof maybeStatus === 'number' ? maybeStatus : null;
  }

  private validateStrictContract(parsed: Record<string, unknown>): void {
    const summary = parsed['summary'];
    const sentiment = parsed['sentiment'];
    const sentimentDescription = parsed['sentimentDescription'];
    const participants = parsed['participants'];
    const tasks = parsed['tasks'];
    const deadlines = parsed['deadlines'];
    const risks = parsed['risks'];
    const conflicts = parsed['conflicts'];
    const metrics = parsed['metrics'];
    const confidence = parsed['confidence'];

    if (typeof summary !== 'string') {
      throw this.createSemanticError('INVALID_CONTRACT', 'Contrato de dados invalido: campo summary ausente ou invalido.');
    }

    if (sentiment !== 'positivo' && sentiment !== 'negativo' && sentiment !== 'neutro') {
      throw this.createSemanticError('INVALID_CONTRACT', 'Contrato de dados invalido: campo sentiment ausente ou invalido.');
    }

    if (typeof sentimentDescription !== 'string') {
      throw this.createSemanticError(
        'INVALID_CONTRACT',
        'Contrato de dados invalido: campo sentimentDescription ausente ou invalido.',
      );
    }

    if (!this.isStringArray(participants)) {
      throw this.createSemanticError('INVALID_CONTRACT', 'Contrato de dados invalido: campo participants ausente ou invalido.');
    }

    if (!this.isStringArray(tasks)) {
      throw this.createSemanticError('INVALID_CONTRACT', 'Contrato de dados invalido: campo tasks ausente ou invalido.');
    }

    if (!this.isStringArray(deadlines)) {
      throw this.createSemanticError('INVALID_CONTRACT', 'Contrato de dados invalido: campo deadlines ausente ou invalido.');
    }

    if (!this.isStringArray(risks)) {
      throw this.createSemanticError('INVALID_CONTRACT', 'Contrato de dados invalido: campo risks ausente ou invalido.');
    }

    if (!this.isStringArray(conflicts)) {
      throw this.createSemanticError('INVALID_CONTRACT', 'Contrato de dados invalido: campo conflicts ausente ou invalido.');
    }

    if (typeof metrics !== 'object' || metrics === null || Array.isArray(metrics)) {
      throw this.createSemanticError('INVALID_CONTRACT', 'Contrato de dados invalido: campo metrics ausente ou invalido.');
    }

    if (confidence !== 'low' && confidence !== 'medium' && confidence !== 'high') {
      throw this.createSemanticError('INVALID_CONTRACT', 'Contrato de dados invalido: campo confidence ausente ou invalido.');
    }
  }

  private ensureStringArray(value: unknown): string[] {
    if (!this.isStringArray(value)) {
      throw this.createSemanticError('INVALID_CONTRACT', 'Contrato de dados invalido: array de strings esperado.');
    }

    return value;
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }

  private isValidToken(token: string): boolean {
    if (typeof token !== 'string') {
      return false;
    }

    const sanitized = token.trim();
    if (!sanitized || sanitized.length <= 10) {
      return false;
    }

    return /^[A-Za-z0-9._-]+$/.test(sanitized);
  }

  private createSemanticError(code: string, message: string): Error {
    const error = new Error(message) as Error & { code: string };
    error.code = code;
    return error;
  }

  private isSemanticError(error: unknown): error is Error & { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      typeof (error as { code?: unknown }).code === 'string' &&
      typeof (error as { message?: unknown }).message === 'string'
    );
  }
}
