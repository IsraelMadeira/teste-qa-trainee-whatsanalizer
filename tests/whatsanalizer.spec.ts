import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const validTxtPath = join(process.cwd(), 'tests', 'data', 'chat1.txt');
const invalidTxtPath = join(process.cwd(), 'tests', 'data', 'invalido.txt');
const massCsvPath = join(process.cwd(), 'tests', 'data', 'massa.csv');

const validApiResponse = {
  summary: 'Resumo executivo da conversa com foco em entrega e riscos.',
  sentiment: 'positivo',
  sentimentDescription: 'Conversa colaborativa, com riscos mapeados e plano de acao definido.',
  participants: ['Ana', 'Bruno', 'Carla'],
  tasks: [
    'Ana - Consolidar backlog da sprint',
    'Bruno - Executar homologacao ate quinta',
    'Carla - Revisar documento final',
  ],
  deadlines: ['Ana - 21/03', 'Bruno - 20/03', 'Carla - 22/03'],
  risks: ['Carla - Risco de atraso por dependencia externa', 'Ana - Possivel indisponibilidade do ambiente'],
  conflicts: ['Bruno - Divergencia de prioridade com area parceira'],
  metrics: {
    sentimentScore: 8,
  },
  confidence: 'high',
};

const fillTokenAndUpload = async (page: import('@playwright/test').Page, token = 'tokenvalido12345') => {
  await page.getByTestId('token-input').fill(token);
  await page.getByTestId('upload-input').setInputFiles(validTxtPath);
};

const submitAnalysis = async (page: import('@playwright/test').Page) => {
  await page.getByTestId('analyze-button').click();
};

const parseMassData = () => {
  const rows = readFileSync(massCsvPath, 'utf-8').trim().split(/\r?\n/).slice(1);
  return rows.map((line) => {
    const [token, arquivo, resultado] = line.split(',');
    return { token, arquivo, resultado };
  });
};

const dataDrivenRows = parseMassData();

test.describe('WhatsAnalizer - fluxos criticos', () => {
  test('TESTE 1 - fluxo feliz end-to-end', async ({ page }) => {
    await page.route('**/v1/chat/completions', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ok-1',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: JSON.stringify(validApiResponse),
              },
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await fillTokenAndUpload(page);
    await submitAnalysis(page);

    await expect(page.getByText('Analisando com Z.AI...')).toBeVisible();
    await expect(page.getByTestId('dashboard-header')).toBeVisible();
    await expect(page.getByTestId('kpi-envolvidos').locator('.kpi-value')).not.toHaveText('0');
    await expect(page.getByTestId('resumo-card')).toBeVisible();
    await expect(page.getByText('Resumo executivo da conversa com foco em entrega e riscos.')).toBeVisible();
  });

  test('TESTE 2 - validacao de upload invalido', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('upload-input').setInputFiles({
      name: 'invalido.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('a,b,c'),
    });
    await expect(page.getByText('Apenas arquivos .txt sao permitidos.')).toBeVisible();

    await page.getByTestId('upload-input').setInputFiles(invalidTxtPath);
    await expect(page.getByText('Nao foi possivel extrair mensagens do arquivo enviado.')).toBeVisible();
  });

  test('TESTE 3 - filtro por participante atualiza listas e badges', async ({ page }) => {
    await page.route('**/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ok-2',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: JSON.stringify(validApiResponse),
              },
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await fillTokenAndUpload(page);
    await submitAnalysis(page);
    await expect(page.getByTestId('dashboard-header')).toBeVisible();

    await page.getByTestId('participant-filter').selectOption({ label: 'Bruno' });
    await expect(page.getByText('Bruno - Executar homologacao ate quinta')).toBeVisible();
    await expect(page.getByText('Ana - Consolidar backlog da sprint')).toHaveCount(0);

    await expect(page.getByTestId('tarefas-card').locator('.badge')).toHaveText('1');
  });

  test('TESTE 4 - erro de API mockado (500, 429 e timeout)', async ({ page }) => {
    await page.goto('/');
    await fillTokenAndUpload(page);

    await page.route('**/v1/chat/completions', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
    await submitAnalysis(page);
    await expect(page.getByText('Ocorreu um erro ao processar a análise.')).toBeVisible();

    await page.unroute('**/v1/chat/completions');
    await page.route('**/v1/chat/completions', async (route) => {
      await route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
    });
    await submitAnalysis(page);
    await expect(page.getByText('Limite de requisições atingido. Tente novamente mais tarde.')).toBeVisible();

    await page.unroute('**/v1/chat/completions');
    await page.route('**/v1/chat/completions', async (route) => {
      await route.abort('timedout');
    });
    await submitAnalysis(page);
    await expect(page.getByText('Tempo de resposta excedido. Tente novamente.')).toBeVisible();

    await expect(page.getByTestId('dashboard-header')).toHaveCount(0);
  });

  test('TESTE 5 - contrato invalido nao renderiza dashboard', async ({ page }) => {
    await page.route('**/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'bad-contract',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  summary: 'ok sem campos obrigatorios',
                  tasks: ['x'],
                }),
              },
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await fillTokenAndUpload(page);
    await submitAnalysis(page);

    await expect(page.getByText('Resposta da IA inválida. Tente novamente.')).toBeVisible();
    await expect(page.getByTestId('dashboard-header')).toHaveCount(0);
  });
});

for (const scenario of dataDrivenRows) {
  test(`TESTE 6 - data-driven com CSV | token=${scenario.token} arquivo=${scenario.arquivo} resultado=${scenario.resultado}`, async ({ page }) => {
    await page.route('**/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ok-dd',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: JSON.stringify(validApiResponse),
              },
            },
          ],
        }),
      });
    });

    await page.goto('/');

    const token = scenario.token === 'valido' ? 'tokenvalido12345' : 'tok';
    const filePath = scenario.arquivo === 'chat1.txt' ? validTxtPath : invalidTxtPath;

    await page.getByTestId('token-input').fill(token);
    await page.getByTestId('upload-input').setInputFiles(filePath);

    if (scenario.resultado === 'sucesso') {
      await submitAnalysis(page);
      await expect(page.getByTestId('dashboard-header')).toBeVisible();
    } else if (scenario.token === 'invalido') {
      await expect(page.getByTestId('analyze-button')).toBeDisabled();
      await expect(page.getByText('Token inválido')).toBeVisible();
    } else {
      await expect(page.getByText('Nao foi possivel extrair mensagens do arquivo enviado.')).toBeVisible();
      await expect(page.getByTestId('analyze-button')).toBeDisabled();
    }
  });
}

test('TESTE 7 - token obrigatorio com erro visual', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('upload-input').setInputFiles(validTxtPath);
  await page.getByTestId('token-input').click();
  await page.getByRole('heading', { name: 'Upload' }).click();

  await expect(page.getByTestId('analyze-button')).toBeDisabled();
  await expect(page.getByText('Token é obrigatório')).toBeVisible();
  await expect(page.getByTestId('token-input')).toHaveClass(/input-invalid/);
});
