const UPLOAD_PATH_PATTERN = /\/uploads\/[^\s"'`()<>]+/g;

export function collectUploadPaths(value) {
  const paths = new Set();

  const visit = (current) => {
    if (typeof current === 'string') {
      for (const match of current.matchAll(UPLOAD_PATH_PATTERN)) paths.add(match[0]);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (current && typeof current === 'object') Object.values(current).forEach(visit);
  };

  visit(value);
  return [...paths].sort((left, right) => left.localeCompare(right));
}

export function rewriteUploadPaths(value, replacements) {
  if (typeof value === 'string') {
    return value.replace(UPLOAD_PATH_PATTERN, (path) => replacements.get(path) || path);
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteUploadPaths(item, replacements));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewriteUploadPaths(item, replacements)]),
    );
  }
  return value;
}

export function assertScoreDataUnchanged(before, after) {
  for (const key of ['scoreMembers', 'dailyScores', 'weekendScores']) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      throw new Error(`媒体迁移不得修改 ${key}`);
    }
  }
}
