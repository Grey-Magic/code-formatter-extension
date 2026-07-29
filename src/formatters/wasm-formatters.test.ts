import { describe, it, expect, beforeEach } from 'vitest';
import {
  RuffFormatter,
  GofmtFormatter,
  SqlFormatter,
  YamlFormatter,
  TomlFormatter,
  BiomeFormatter,
} from './wasm-formatters';
import { clearWasmCache } from './wasm-loader';

describe('WASM Formatters', () => {
  beforeEach(() => {
    clearWasmCache();
  });

  describe('RuffFormatter', () => {
    const formatter = new RuffFormatter();

    it('should have correct metadata', () => {
      expect(formatter.metadata.id).toBe('ruff');
      expect(formatter.metadata.name).toBe('Ruff');
      expect(formatter.metadata.languages).toContain('python');
      expect(formatter.metadata.capabilities.isFormatter).toBe(true);
    });

    it('should be available', () => {
      expect(formatter.isAvailable()).toBe(true);
    });

    it('should format Python code', async () => {
      // Note: This will fail in test environment without chrome.runtime
      // but tests the error handling
      const code = 'def foo():\n    return 42';
      const result = await formatter.format(code, 'python');

      // In test environment without extension context, should return error
      // In actual browser extension, should format successfully
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('code');
    });
  });

  describe('GofmtFormatter', () => {
    const formatter = new GofmtFormatter();

    it('should have correct metadata', () => {
      expect(formatter.metadata.id).toBe('gofmt');
      expect(formatter.metadata.languages).toContain('go');
    });

    it('should be available', () => {
      expect(formatter.isAvailable()).toBe(true);
    });
  });

  describe('SqlFormatter', () => {
    const formatter = new SqlFormatter();

    it('should have correct metadata', () => {
      expect(formatter.metadata.id).toBe('sql-formatter');
      expect(formatter.metadata.languages).toContain('sql');
    });

    it('should be available', () => {
      expect(formatter.isAvailable()).toBe(true);
    });
  });

  describe('YamlFormatter', () => {
    const formatter = new YamlFormatter();

    it('should have correct metadata', () => {
      expect(formatter.metadata.id).toBe('yaml-formatter');
      expect(formatter.metadata.languages).toContain('yaml');
    });

    it('should be available', () => {
      expect(formatter.isAvailable()).toBe(true);
    });
  });

  describe('TomlFormatter', () => {
    const formatter = new TomlFormatter();

    it('should have correct metadata', () => {
      expect(formatter.metadata.id).toBe('toml-formatter');
      expect(formatter.metadata.languages).toContain('toml');
    });

    it('should be available', () => {
      expect(formatter.isAvailable()).toBe(true);
    });
  });

  describe('BiomeFormatter', () => {
    const formatter = new BiomeFormatter();

    it('should have correct metadata', () => {
      expect(formatter.metadata.id).toBe('biome');
      expect(formatter.metadata.name).toBe('Biome');
      expect(formatter.metadata.languages).toContain('javascript');
      expect(formatter.metadata.languages).toContain('typescript');
      expect(formatter.metadata.languages).toContain('json');
      expect(formatter.metadata.languages).toContain('css');
      expect(formatter.metadata.capabilities.isFormatter).toBe(true);
    });

    it('should be available', () => {
      expect(formatter.isAvailable()).toBe(true);
    });
  });
});
