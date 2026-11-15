import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  buildAuthFileFieldsPatch,
  type PrefixProxyEditorState,
} from '../src/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';
import { supportsAuthFileQuotaReserve } from '../src/features/authFiles/constants';
import { normalizeAuthFilesResponse } from '../src/services/api/authFiles';
import type { AuthFilesResponse } from '../src/types/authFile';
import {
  isValidQuotaReserveText,
  parseQuotaReserveText,
  readQuotaReservePercent,
} from '../src/utils/quotaReserve';

const makeEditor = (
  json: Record<string, unknown>,
  quotaReserve: string,
  providerKey = 'codex'
): PrefixProxyEditorState => ({
  fileName: 'codex.json',
  fileInfoText: '',
  loading: false,
  saving: false,
  error: null,
  originalText: JSON.stringify(json),
  rawText: JSON.stringify(json),
  invalidContentPreview: '',
  json,
  providerKey,
  prefix: '',
  proxyUrl: '',
  priority: '',
  weight: '',
  weightError: null,
  quotaReserve,
  quotaReserveError: null,
  disableCooling: false,
  disableCoolingTouched: false,
  websockets: false,
  websocketsTouched: false,
  useSiwc: false,
  useSiwcTouched: false,
  usingApi: false,
  usingApiTouched: false,
  note: '',
  noteTouched: false,
  excludedModelsText: '',
  excludedModelsTouched: false,
  headersText: '',
  headersTouched: false,
  headersError: null,
});

const resolveError = (key: string) => key;

describe('quota reserve value parsing', () => {
  test('accepts numbers from 0 to 100 and treats empty or 0 as disabled', () => {
    expect(isValidQuotaReserveText('')).toBe(true);
    expect(isValidQuotaReserveText('0')).toBe(true);
    expect(isValidQuotaReserveText('12.5')).toBe(true);
    expect(isValidQuotaReserveText('100')).toBe(true);
    expect(isValidQuotaReserveText('-1')).toBe(false);
    expect(isValidQuotaReserveText('100.1')).toBe(false);
    expect(isValidQuotaReserveText('abc')).toBe(false);
    expect(parseQuotaReserveText('')).toBeUndefined();
    expect(parseQuotaReserveText('0')).toBeUndefined();
    expect(parseQuotaReserveText(' 20 ')).toBe(20);
  });

  test('reads stored numbers and numeric strings, ignoring invalid or disabled values', () => {
    expect(readQuotaReservePercent(20)).toBe(20);
    expect(readQuotaReservePercent('15.5')).toBe(15.5);
    expect(readQuotaReservePercent(0)).toBeUndefined();
    expect(readQuotaReservePercent(null)).toBeUndefined();
    expect(readQuotaReservePercent(101)).toBeUndefined();
    expect(readQuotaReservePercent('x')).toBeUndefined();
  });

  test('is limited to Codex credentials, matching the backend', () => {
    expect(supportsAuthFileQuotaReserve('codex')).toBe(true);
    expect(supportsAuthFileQuotaReserve('claude')).toBe(false);
  });
});

describe('auth-file quota reserve patch', () => {
  test('writes a new reserve and uses null to disable an existing one', () => {
    expect(buildAuthFileFieldsPatch(makeEditor({}, '20'), resolveError)).toEqual({
      quota_reserve_percent: 20,
    });
    expect(
      buildAuthFileFieldsPatch(makeEditor({ quota_reserve_percent: 20 }, ''), resolveError)
    ).toEqual({ quota_reserve_percent: null });
    expect(
      buildAuthFileFieldsPatch(makeEditor({ quota_reserve_percent: 20 }, '0'), resolveError)
    ).toEqual({ quota_reserve_percent: null });
  });

  test('sends nothing when the reserve is unchanged or already disabled', () => {
    expect(
      buildAuthFileFieldsPatch(makeEditor({ quota_reserve_percent: '20' }, '20'), resolveError)
    ).toEqual({});
    expect(buildAuthFileFieldsPatch(makeEditor({}, '0'), resolveError)).toEqual({});
    expect(
      buildAuthFileFieldsPatch(makeEditor({ quota_reserve_percent: null }, ''), resolveError)
    ).toEqual({});
  });

  test('rejects out-of-range values before PATCH', () => {
    expect(() => buildAuthFileFieldsPatch(makeEditor({}, '150'), resolveError)).toThrow(
      'auth_files.quota_reserve_invalid'
    );
  });

  test('never patches the reserve on non-Codex credentials', () => {
    expect(buildAuthFileFieldsPatch(makeEditor({}, '20', 'claude'), resolveError)).toEqual({});
  });
});

describe('auth-files list normalization', () => {
  test('exposes only active reserves', () => {
    const result = normalizeAuthFilesResponse({
      files: [
        { name: 'a.json', quota_reserve_percent: 20 },
        { name: 'b.json' },
        { name: 'c.json', quota_reserve_percent: 0 },
      ],
    } as unknown as AuthFilesResponse);
    const byName = new Map(result.files.map((file) => [file.name, file.quotaReservePercent]));
    expect(byName.get('a.json')).toBe(20);
    expect(byName.get('b.json')).toBeUndefined();
    expect(byName.get('c.json')).toBeUndefined();
  });
});

describe('auth-file quota reserve localization', () => {
  const locales = ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko', 'tr'];
  const keys = [
    'quota_reserve_label',
    'quota_reserve_hint',
    'quota_reserve_invalid',
    'quota_reserve_display',
    'quota_reserve_tooltip',
  ];

  test('defines every key in all locales', () => {
    for (const locale of locales) {
      const messages = JSON.parse(
        readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8')
      ) as { auth_files: Record<string, string> };
      for (const key of keys) {
        expect(messages.auth_files[key]).toBeTruthy();
      }
      expect(messages.auth_files.quota_reserve_tooltip).toContain('{{percent}}');
    }
  });
});
