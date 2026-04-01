import test from 'node:test';
import assert from 'node:assert/strict';

import { callXapi, getAllFollowingUsers } from '../../scripts/xapiClient.js';

test('callXapi throws when XAPI_API_KEY is missing', async () => {
  await assert.rejects(
    () => callXapi('twitter.user_by_screen_name', { screen_name: 'OpenAI' }, {
      apiKey: '',
      executor: async () => {
        throw new Error('executor should not be called');
      },
    }),
    /XAPI_API_KEY/
  );
});

test('callXapi passes JSON input to the executor and parses JSON output', async () => {
  const calls = [];

  const result = await callXapi('twitter.user_by_screen_name', { screen_name: 'OpenAI' }, {
    apiKey: 'test-key',
    executor: async (command, args, options) => {
      calls.push({ command, args, options });
      return {
        stdout: JSON.stringify({
          success: true,
          data: { screen_name: 'OpenAI', rest_id: '4398626122' },
        }),
        stderr: '',
      };
    },
  });

  assert.equal(result.data.screen_name, 'OpenAI');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.at(-1), JSON.stringify({ screen_name: 'OpenAI' }));
  assert.equal(calls[0].options.env.XAPI_API_KEY, 'test-key');
});

test('callXapi can execute through direct HTTP without the bun-based CLI', async () => {
  const calls = [];

  const result = await callXapi('twitter.user_by_screen_name', { screen_name: 'OpenAI' }, {
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 201,
        async text() {
          return JSON.stringify({
            success: true,
            data: { screen_name: 'OpenAI', rest_id: '4398626122' },
          });
        },
      };
    },
  });

  assert.equal(result.data.screen_name, 'OpenAI');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://action.xapi.to/v1/actions/execute');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['XAPI-Key'], 'test-key');
});

test('getAllFollowingUsers paginates until cursor_bottom is exhausted', async () => {
  const seenInputs = [];

  const users = await getAllFollowingUsers('4398626122', {
    apiKey: 'test-key',
    pageSize: 2,
    executor: async (_command, args) => {
      const payload = JSON.parse(args.at(-1));
      seenInputs.push(payload);

      if (!payload.cursor) {
        return {
          stdout: JSON.stringify({
            success: true,
            data: {
              users: [{ screen_name: 'first' }, { screen_name: 'second' }],
              cursor_bottom: 'next-cursor',
            },
          }),
          stderr: '',
        };
      }

      return {
        stdout: JSON.stringify({
          success: true,
          data: {
            users: [{ screen_name: 'third' }],
          },
        }),
        stderr: '',
      };
    },
  });

  assert.deepEqual(
    seenInputs,
    [
      { user_id: '4398626122', count: 2 },
      { user_id: '4398626122', count: 2, cursor: 'next-cursor' },
    ]
  );
  assert.deepEqual(
    users.map((user) => user.screen_name),
    ['first', 'second', 'third']
  );
});
