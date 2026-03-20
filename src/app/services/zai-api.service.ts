import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, throwError, timeout, TimeoutError } from 'rxjs';
import { z } from 'zod';

import { environment } from '../../environments/environment';
import {
  ApiAnalysisRequest,
  ApiAnalysisResponse,
  ZAiChatCompletionResponse,
} from '../models/chat-insights.models';
import { WHATSANALIZER_SYSTEM_PROMPT } from '../prompts/system-prompt';

const analysisResponseSchema = z.object({
  summary: z.string(),
  sentiment: z.enum(['positivo', 'negativo', 'neutro']),
  sentimentDescription: z.string(),
  participants: z.array(z.string()),
  tasks: z.array(z.string()),
  deadlines: z.array(z.string()),
  risks: z.array(z.string()),
  conflicts: z.array(z.string()),
  metrics: z.record(z.string(), z.unknown()),
  confidence: z.enum(['low', 'medium', 'high']),
});

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
      const parsed = JSON.parse(rawContent) as unknown;
      const contract = analysisResponseSchema.safeParse(parsed);

      if (!contract.success) {
        throw this.createSemanticError('INVALID_CONTRACT', 'Contrato de dados invalido: formato inesperado.');
      }

      return contract.data;
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
