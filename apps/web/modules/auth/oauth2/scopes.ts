const SCOPE_RESOURCE_PREFIXES = ["EVENT_TYPE", "BOOKING", "SCHEDULE"] as const;

export function resolveScopes(scopeParam: string | null | undefined, clientScopes: string[]): string[] {
  if (scopeParam) {
    const parsed = scopeParam.split(/[, ]+/).filter(Boolean);
    if (parsed.length > 0) return parsed;
  }
  return clientScopes;
}

export function getScopeDisplayItems(scopes: string[], t: (key: string) => string): string[] {
  const scopeSet = new Set(scopes);
  const items: string[] = [];

  if (scopeSet.has("PROFILE_READ")) {
    items.push(t(scopeTranslationKey("PROFILE_READ")));
  }

  for (const resource of SCOPE_RESOURCE_PREFIXES) {
    const hasRead = scopeSet.has(`${resource}_READ`);
    const hasWrite = scopeSet.has(`${resource}_WRITE`);

    if (hasRead && hasWrite) {
      items.push(t(scopeTranslationKey(`${resource}_READ_WRITE`)));
    } else if (hasRead) {
      items.push(t(scopeTranslationKey(`${resource}_READ`)));
    } else if (hasWrite) {
      items.push(t(scopeTranslationKey(`${resource}_WRITE`)));
    }
  }

  return items;
}

export function scopeTranslationKey(scope: string): string {
  return `oauth_scope_${scope.toLowerCase()}`;
}
