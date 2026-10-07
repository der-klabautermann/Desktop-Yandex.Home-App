// Ядро локализации без React: поиск ключей, подстановка, множественное число.

export type Language = 'de' | 'en' | 'ru';
export const LANGUAGES: Language[] = ['de', 'en', 'ru'];

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export type PluralForms = { one: string; few?: string; many?: string; other: string };
export interface Dictionary {
  [key: string]: string | PluralForms | Dictionary;
}

const isPluralForms = (value: unknown): value is PluralForms =>
  typeof value === 'object' && value !== null && 'one' in value && 'other' in value;

export const resolveKey = (dict: Dictionary, key: string): string | PluralForms | undefined => {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node === 'string' || isPluralForms(node)) return node;
  return undefined;
};

export const interpolate = (text: string, vars?: Record<string, string | number>): string =>
  vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text;

export const pluralCategory = (lang: Language, count: number): keyof PluralForms => {
  const category = new Intl.PluralRules(lang).select(count);
  if (category === 'one' || category === 'few' || category === 'many') return category;
  return 'other';
};

export const pickPlural = (forms: PluralForms, lang: Language, count: number): string =>
  forms[pluralCategory(lang, count)] ?? forms.other;

export const detectLanguage = (stored: string | null, systemLocale: string | undefined): Language => {
  if (stored && (LANGUAGES as string[]).includes(stored)) return stored as Language;
  const prefix = (systemLocale ?? '').slice(0, 2).toLowerCase();
  if ((LANGUAGES as string[]).includes(prefix)) return prefix as Language;
  return 'en';
};

/** Собирает все листовые ключи словаря, например 'dashboard.title'. */
export const collectKeys = (dict: Dictionary, prefix = ''): string[] =>
  Object.entries(dict).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' || isPluralForms(value)) return [path];
    return collectKeys(value, path);
  });
