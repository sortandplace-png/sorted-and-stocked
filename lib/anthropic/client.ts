// lib/anthropic/client.ts
// SERVER-ONLY. ANTHROPIC_API_KEY must never reach the browser — only call
// this from Route Handlers (app/api/**/route.ts), never from a 'use client'
// component or anything bundled into client JS.

type ImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
};

type TextBlock = { type: 'text'; text: string };

export async function callClaudeWithText({
  systemPrompt,
  userText,
}: {
  systemPrompt: string;
  userText: string;
}) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }],
      tools: [{ type: 'web_search_20260209', name: 'web_search' }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = (data.content ?? [])
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('\n\n');

  return { text, raw: data };
}

export async function callClaudeWithImage({
  systemPrompt,
  userText,
  imageBase64,
  mediaType,
  useWebSearch = false,
}: {
  systemPrompt: string;
  userText: string;
  imageBase64: string;
  mediaType: string;
  useWebSearch?: boolean;
}) {
  const content: (ImageBlock | TextBlock)[] = [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
    { type: 'text', text: userText },
  ];

  const body: Record<string, unknown> = {
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  };

  if (useWebSearch) {
    body.tools = [{ type: 'web_search_20260209', name: 'web_search' }];
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errText}`);
  }

  const data = await response.json();

  // Concatenate all text blocks — web_search runs produce interleaved
  // tool_use/tool_result/text blocks, we only want the prose for display.
  const text = (data.content ?? [])
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('\n\n');

  return { text, raw: data };
}
