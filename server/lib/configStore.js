import * as defaultFileSystem from 'node:fs/promises';
import { join } from 'node:path';
import { createSeedConfig, migrateRawConfig } from '../../src/data/siteConfig.js';
import { sanitizeNewsBodyHtml } from './newsRichText.js';
import { normalizeNickname } from '../../src/data/scoreRules.js';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isNonNegativeFinite = (value) => Number.isFinite(value) && value >= 0;
const isValidDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};
const rawTopLevelKeys = ['team', 'stats', 'roster', 'scoreMembers', 'albums', 'dailyScores', 'weekendScores', 'memberAliases', 'news', 'newsCategories', 'music'];
const rawTopLevelKeySet = new Set(rawTopLevelKeys);

function rejectUnexpectedTopLevelKeys(config) {
  if (!isObject(config)) return;
  const details = Object.keys(config)
    .filter((key) => !rawTopLevelKeySet.has(key))
    .map((key) => `unexpected top-level key "${key}"; remove it from the config root`);
  if (!details.length) return;
  const error = new Error('Invalid configuration');
  error.code = 'INVALID_CONFIG';
  error.details = details;
  throw error;
}

function selectRawConfig(config) {
  if (!isObject(config)) return config;

  const rawConfig = {};
  for (const key of rawTopLevelKeys) {
    if (key in config) {
      rawConfig[key] = config[key];
    }
  }
  return rawConfig;
}

function requireStrings(value, fields, path, details) {
  for (const field of fields) {
    if (!isObject(value) || !isNonEmptyString(value[field])) {
      details.push(`${path}.${field} must be a non-empty string`);
    }
  }
}

function requireString(value, fields, path, details) {
  for (const field of fields) {
    if (!isObject(value) || typeof value[field] !== 'string') {
      details.push(`${path}.${field} must be a string`);
    }
  }
}

function validateOptionalStrings(value, fields, path, details) {
  for (const field of fields) {
    if (value?.[field] !== undefined && typeof value[field] !== 'string') {
      details.push(`${path}.${field} must be a string`);
    }
  }
}

function validateOptionalNumbers(value, fields, path, details) {
  for (const field of fields) {
    if (value?.[field] !== undefined && !isNonNegativeFinite(value[field])) {
      details.push(`${path}.${field} must be a non-negative finite number`);
    }
  }
}

function requireUniqueString(value, path, seen, details) {
  if (!isNonEmptyString(value)) {
    details.push(`${path} must be a non-empty string`);
    return;
  }

  const normalized = value.trim();
  if (seen.has(normalized)) {
    details.push(`${path} must be unique`);
  } else {
    seen.add(normalized);
  }
}

function validateConfig(config) {
  const details = [];

  if (!isObject(config)) {
    const error = new Error('Invalid configuration');
    error.code = 'INVALID_CONFIG';
    error.details = ['config must be an object'];
    throw error;
  }

  for (const key of Object.keys(config)) {
    if (!rawTopLevelKeySet.has(key)) {
      details.push(`unexpected top-level key "${key}"; remove it from the config root`);
    }
  }

  requireStrings(config.team, ['name', 'label', 'motto'], 'team', details);
  if (!isObject(config.team?.heroMedia)) {
    details.push('team.heroMedia must be an object');
  } else {
    if (typeof config.team.heroMedia.src !== 'string') {
      details.push('team.heroMedia.src must be a string');
    }
    if (!['image', 'video'].includes(config.team.heroMedia.type)) {
      details.push('team.heroMedia.type must be image or video');
    }
    validateOptionalStrings(
      config.team.heroMedia,
      ['originalSrc', 'posterSrc', 'thumbSrc', 'cardSrc'],
      'team.heroMedia',
      details,
    );
    validateOptionalNumbers(
      config.team.heroMedia,
      ['originalSize', 'width', 'height', 'duration'],
      'team.heroMedia',
      details,
    );
  }
  if (typeof config.team?.heroFallbackImage !== 'string') {
    details.push('team.heroFallbackImage must be a string');
  }
  if (!Array.isArray(config.team?.heroLines) || config.team.heroLines.length === 0) {
    details.push('team.heroLines must contain at least one sentence');
  } else {
    config.team.heroLines.forEach((line, index) => {
      if (!isNonEmptyString(line)) details.push(`team.heroLines[${index}] must be a non-empty string`);
    });
  }

  if (!Array.isArray(config.stats) || config.stats.length !== 4) {
    details.push('stats must contain exactly 4 entries');
  }
  if (Array.isArray(config.stats)) {
    for (let index = 0; index < config.stats.length; index += 1) {
      const stat = config.stats[index];
      const path = `stats[${index}]`;
      if (!isObject(stat)) {
        details.push(`${path} must be an object`);
        continue;
      }
      if (!isNonEmptyString(stat.label)) {
        details.push(`${path}.label must be a non-empty string`);
      }

      if (isObject(stat.value)) {
        for (const field of ['male', 'female']) {
          if (!isNonNegativeFinite(stat.value[field])) {
            details.push(`${path}.value.${field} must be a non-negative finite number`);
          }
        }
      } else if (!isNonEmptyString(stat.value) && !Number.isFinite(stat.value)) {
        details.push(`${path}.value must be a non-empty string or finite number`);
      }
    }
  }

  const memberIds = new Set();
  const seenMemberIds = new Set();
  const seenMemberNumbers = new Set();
  if (!Array.isArray(config.roster) || config.roster.length === 0) {
    details.push('roster must be a non-empty array');
  } else {
    for (let index = 0; index < config.roster.length; index += 1) {
      const member = config.roster[index];
      const path = `roster[${index}]`;
      if (!isObject(member)) {
        details.push(`${path} must be an object`);
        continue;
      }

      requireUniqueString(member.id, `${path}.id`, seenMemberIds, details);
      requireUniqueString(member.number, `${path}.number`, seenMemberNumbers, details);
      requireStrings(member, ['name', 'role'], path, details);
      requireString(member, ['avatar', 'videoUrl', 'signature'], path, details);
      validateOptionalStrings(
        member,
        ['avatarThumb', 'avatarCard', 'avatarOriginalSrc', 'videoPosterSrc', 'videoOriginalUrl'],
        path,
        details,
      );
      validateOptionalNumbers(
        member,
        ['avatarOriginalSize', 'videoOriginalSize', 'videoWidth', 'videoHeight', 'videoDuration'],
        path,
        details,
      );
      for (const field of ['basePoints', 'wins']) {
        if (!isNonNegativeFinite(member[field])) {
          details.push(`${path}.${field} must be a non-negative finite number`);
        }
      }
      if ('points' in member) {
        details.push(`${path}.points is derived and must not be stored`);
      }
      if (isNonEmptyString(member.id)) memberIds.add(member.id);
    }
  }

  const scoreMemberIds = new Set();
  const seenScoreMemberIds = new Set();
  const seenScoreMemberNames = new Set();
  if (!Array.isArray(config.scoreMembers)) {
    details.push('scoreMembers must be an array');
  } else {
    for (let index = 0; index < config.scoreMembers.length; index += 1) {
      const member = config.scoreMembers[index];
      const path = `scoreMembers[${index}]`;
      if (!isObject(member)) {
        details.push(`${path} must be an object`);
        continue;
      }

      requireUniqueString(member.id, `${path}.id`, seenScoreMemberIds, details);
      requireStrings(member, ['name'], path, details);
      const normalizedName = normalizeNickname(member.name);
      if (normalizedName && seenScoreMemberNames.has(normalizedName)) {
        details.push(`${path}.name must be unique after normalization`);
      } else if (normalizedName) {
        seenScoreMemberNames.add(normalizedName);
      }
      for (const field of ['basePoints', 'wins']) {
        if (!isNonNegativeFinite(member[field])) {
          details.push(`${path}.${field} must be a non-negative finite number`);
        }
      }
      if (isNonEmptyString(member.id)) scoreMemberIds.add(member.id);
    }
  }

  const seenRosterScoreMemberIds = new Set();
  if (Array.isArray(config.roster)) {
    for (let index = 0; index < config.roster.length; index += 1) {
      const member = config.roster[index];
      if (!isObject(member) || !isNonEmptyString(member.scoreMemberId)) continue;
      const path = `roster[${index}].scoreMemberId`;
      if (!scoreMemberIds.has(member.scoreMemberId)) {
        details.push(`${path} must reference an existing score member`);
      } else if (seenRosterScoreMemberIds.has(member.scoreMemberId)) {
        details.push(`${path} must be unique`);
      } else {
        seenRosterScoreMemberIds.add(member.scoreMemberId);
      }
    }
  }

  const seenAlbumIds = new Set();
  const seenPhotoIds = new Set();
  if (!Array.isArray(config.albums)) {
    details.push('albums must be an array');
  } else {
    for (let albumIndex = 0; albumIndex < config.albums.length; albumIndex += 1) {
      const album = config.albums[albumIndex];
      const path = `albums[${albumIndex}]`;
      if (!isObject(album)) {
        details.push(`${path} must be an object`);
        continue;
      }

      requireUniqueString(album.id, `${path}.id`, seenAlbumIds, details);
      requireStrings(album, ['name', 'date', 'coverSrc'], path, details);
      if (album.password !== undefined && typeof album.password !== 'string') {
        details.push(`${path}.password must be a string`);
      }
      validateOptionalStrings(
        album,
        ['coverThumbSrc', 'coverCardSrc', 'coverOriginalSrc'],
        path,
        details,
      );
      validateOptionalNumbers(album, ['coverOriginalSize'], path, details);
      if (!Array.isArray(album.photos)) {
        details.push(`${path}.photos must be an array`);
        continue;
      }

      for (let photoIndex = 0; photoIndex < album.photos.length; photoIndex += 1) {
        const photo = album.photos[photoIndex];
        const photoPath = `${path}.photos[${photoIndex}]`;
        if (!isObject(photo)) {
          details.push(`${photoPath} must be an object`);
          continue;
        }

        requireUniqueString(photo.id, `${photoPath}.id`, seenPhotoIds, details);
        requireStrings(photo, ['src', 'title', 'date'], photoPath, details);
        if (photo.alt !== undefined && typeof photo.alt !== 'string') {
          details.push(`${photoPath}.alt must be a string`);
        }
        if (photo.mediaType !== undefined && !['image', 'video'].includes(photo.mediaType)) {
          details.push(`${photoPath}.mediaType must be image or video`);
        }
        if (photo.featured !== undefined && typeof photo.featured !== 'boolean') {
          details.push(`${photoPath}.featured must be a boolean`);
        }
        if (photo.videoUrl !== undefined && typeof photo.videoUrl !== 'string') {
          details.push(`${photoPath}.videoUrl must be a string`);
        }
        validateOptionalStrings(
          photo,
          ['thumbSrc', 'cardSrc', 'originalSrc', 'videoPosterSrc', 'videoOriginalUrl'],
          photoPath,
          details,
        );
        validateOptionalNumbers(
          photo,
          ['originalSize', 'videoOriginalSize', 'videoWidth', 'videoHeight', 'videoDuration'],
          photoPath,
          details,
        );
      }
    }
  }

  const seenNewsIds = new Set();
  if (!Array.isArray(config.news)) {
    details.push('news must be an array');
  } else {
    for (let index = 0; index < config.news.length; index += 1) {
      const item = config.news[index];
      const path = `news[${index}]`;
      if (!isObject(item)) {
        details.push(`${path} must be an object`);
        continue;
      }
      requireUniqueString(item.id, `${path}.id`, seenNewsIds, details);
      requireStrings(
        item,
        ['title', 'category', 'date', 'imageSrc', 'imageAlt', 'summary', 'body'],
        path,
        details,
      );
      if (item.bodyHtml !== undefined && typeof item.bodyHtml !== 'string') {
        details.push(`${path}.bodyHtml must be a string`);
      }
      if (item.pinned !== undefined && typeof item.pinned !== 'boolean') {
        details.push(`${path}.pinned must be a boolean`);
      }
      if (item.hidden !== undefined && typeof item.hidden !== 'boolean') {
        details.push(`${path}.hidden must be a boolean`);
      }
    }
  }

  if (!Array.isArray(config.newsCategories)) {
    details.push('newsCategories must be an array');
  } else {
    const seenNewsCategories = new Set();
    for (let index = 0; index < config.newsCategories.length; index += 1) {
      const category = config.newsCategories[index];
      const path = `newsCategories[${index}]`;
      if (!isNonEmptyString(category)) {
        details.push(`${path} must be a non-empty string`);
      } else if (seenNewsCategories.has(category.trim())) {
        details.push(`${path} must be unique`);
      } else {
        seenNewsCategories.add(category.trim());
      }
    }
  }

  if (!Array.isArray(config.dailyScores)) {
    details.push('dailyScores must be an array');
  } else {
    const seenDates = new Set();
    for (let roundIndex = 0; roundIndex < config.dailyScores.length; roundIndex += 1) {
      const round = config.dailyScores[roundIndex];
      const roundPath = `dailyScores[${roundIndex}]`;
      if (!isObject(round)) {
        details.push(`${roundPath} must be an object`);
        continue;
      }
      if (!isValidDateKey(round.date)) {
        details.push(`${roundPath}.date must use a valid YYYY-MM-DD date`);
      } else if (seenDates.has(round.date)) {
        details.push(`${roundPath}.date must be unique`);
      } else {
        seenDates.add(round.date);
      }
      if ('weekday' in round) {
        details.push(`${roundPath}.weekday is derived and must not be stored`);
      }
      if (!Array.isArray(round.rows)) {
        details.push(`${roundPath}.rows must be an array`);
        continue;
      }

      const seenRowIds = new Set();
      for (let rowIndex = 0; rowIndex < round.rows.length; rowIndex += 1) {
        const row = round.rows[rowIndex];
        const path = `${roundPath}.rows[${rowIndex}]`;
        if (!isObject(row)) {
          details.push(`${path} must be an object`);
          continue;
        }
        if (!scoreMemberIds.has(row.id)) {
          details.push(`${path}.id must reference an existing score member`);
        } else if (seenRowIds.has(row.id)) {
          details.push(`${path}.id must be unique within its date`);
        } else {
          seenRowIds.add(row.id);
        }
        if ('name' in row) {
          details.push(`${path}.name is derived and must not be stored`);
        }
        for (const field of ['score', 'total']) {
          if (field in row && row[field] != null && !isNonNegativeFinite(row[field])) {
            details.push(`${path}.${field} must be a non-negative finite number or null`);
          }
        }
        for (const field of ['teamRace', 'openRace']) {
          const race = row[field];
          let hasInvalidRaceValue = false;
          if (Array.isArray(race)) {
            for (let raceIndex = 0; raceIndex < race.length; raceIndex += 1) {
              if (race[raceIndex] !== null && !isNonNegativeFinite(race[raceIndex])) {
                hasInvalidRaceValue = true;
              }
            }
          }
          if (!Array.isArray(race) || race.length !== 3 || hasInvalidRaceValue) {
            details.push(
              `${path}.${field} must contain exactly 3 non-negative finite numbers or null`,
            );
          }
        }
      }
    }
  }

  if (config.weekendScores != null) {
    if (!Array.isArray(config.weekendScores)) {
      details.push('weekendScores must be an array');
    } else {
      for (let roundIndex = 0; roundIndex < config.weekendScores.length; roundIndex += 1) {
        const round = config.weekendScores[roundIndex];
        const roundPath = `weekendScores[${roundIndex}]`;
        if (!isObject(round)) {
          details.push(`${roundPath} must be an object`);
          continue;
        }
        if (!isValidDateKey(round.date)) {
          details.push(`${roundPath}.date must use a valid YYYY-MM-DD date`);
        }
        if (!Array.isArray(round.rows)) {
          details.push(`${roundPath}.rows must be an array`);
          continue;
        }
        for (let rowIndex = 0; rowIndex < round.rows.length; rowIndex += 1) {
          const row = round.rows[rowIndex];
          const path = `${roundPath}.rows[${rowIndex}]`;
          if (!isObject(row)) {
            details.push(`${path} must be an object`);
            continue;
          }
          if (!scoreMemberIds.has(row.id)) {
            details.push(`${path}.id must reference an existing score member`);
          }
          for (const field of ['previousPoints', 'points', 'score', 'total']) {
            if (field in row && row[field] != null && !isNonNegativeFinite(row[field])) {
              details.push(`${path}.${field} must be a non-negative finite number or null`);
            }
          }
        }
      }
    }
  }

  if (config.memberAliases != null) {
    if (!Array.isArray(config.memberAliases)) {
      details.push('memberAliases must be an array');
    } else {
      for (let aliasIndex = 0; aliasIndex < config.memberAliases.length; aliasIndex += 1) {
        const alias = config.memberAliases[aliasIndex];
        const path = `memberAliases[${aliasIndex}]`;
        if (!isObject(alias)) {
          details.push(`${path} must be an object`);
          continue;
        }
        if (!memberIds.has(alias.memberId)) {
          details.push(`${path}.memberId must reference an existing roster member`);
        }
        if (!isNonEmptyString(alias.value)) {
          details.push(`${path}.value must be a non-empty string`);
        }
      }
    }
  }

  requireStrings(config.music, ['src', 'cover'], 'music', details);

  if (details.length > 0) {
    const error = new Error('Invalid configuration');
    error.code = 'INVALID_CONFIG';
    error.details = details;
    throw error;
  }
}

function sanitizeNews(config) {
  return {
    ...config,
    news: config.news.map((item, index) => {
      if (item.bodyHtml === undefined) return item;
      if (!item.bodyHtml.trim()) return { ...item, bodyHtml: '' };

      const richText = sanitizeNewsBodyHtml(item.bodyHtml);
      if (!richText.text) {
        const error = new Error('Invalid configuration');
        error.code = 'INVALID_CONFIG';
        error.details = [`news[${index}].bodyHtml must contain readable text`];
        throw error;
      }

      return { ...item, bodyHtml: richText.html, body: richText.text };
    }),
  };
}

export async function createConfigStore({ dataDir, fileSystem: providedFileSystem = {} }) {
  const fileSystem = { ...defaultFileSystem, ...providedFileSystem };
  await fileSystem.mkdir(dataDir, { recursive: true });

  const configPath = join(dataDir, 'site-config.json');
  const backupPath = join(dataDir, 'site-config.json.bak');
  const temporaryPath = join(dataDir, 'site-config.json.next');
  const stagedBackupPath = join(dataDir, 'site-config.json.bak.next');
  let writeQueue = Promise.resolve();

  async function cleanupTemporaryFiles() {
    for (const path of [temporaryPath, stagedBackupPath]) {
      try {
        await fileSystem.rm(path, { force: true });
      } catch {
        // Preserve the original persistence failure.
      }
    }
  }

  async function restoreBackup(priorBackupBytes) {
    if (priorBackupBytes === null) {
      await fileSystem.rm(backupPath, { force: true });
      return;
    }

    try {
      await fileSystem.writeFile(stagedBackupPath, priorBackupBytes);
      await fileSystem.rename(stagedBackupPath, backupPath);
    } catch (error) {
      try {
        await fileSystem.rm(stagedBackupPath, { force: true });
      } catch {
        // Preserve the original rollback failure.
      }
      throw error;
    }
  }

  async function persist(rawConfig, serializedConfig) {
    let priorBackupBytes = null;
    try {
      priorBackupBytes = await fileSystem.readFile(backupPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    try {
      await fileSystem.writeFile(temporaryPath, serializedConfig);
    } catch (error) {
      await cleanupTemporaryFiles();
      throw error;
    }

    try {
      await fileSystem.copyFile(configPath, stagedBackupPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        try {
          await fileSystem.rename(temporaryPath, configPath);
        } catch (renameError) {
          await cleanupTemporaryFiles();
          throw renameError;
        }
        return rawConfig;
      }

      await cleanupTemporaryFiles();
      throw error;
    }

    try {
      await fileSystem.rename(stagedBackupPath, backupPath);
    } catch (error) {
      await cleanupTemporaryFiles();
      throw error;
    }

    try {
      await fileSystem.rename(temporaryPath, configPath);
    } catch (error) {
      try {
        await restoreBackup(priorBackupBytes);
      } catch (rollbackError) {
        await cleanupTemporaryFiles();
        const compositeError = new AggregateError(
          [error, rollbackError],
          'Failed to replace the active config and restore the previous backup',
          { cause: error },
        );
        compositeError.code = 'CONFIG_ROLLBACK_FAILED';
        throw compositeError;
      }
      await cleanupTemporaryFiles();
      throw error;
    }

    return rawConfig;
  }

  async function write(config) {
    const rawSnapshot = structuredClone(selectRawConfig(config));
    const rosterIdSet = new Set((rawSnapshot.roster || []).map((member) => member.id));
    if (Array.isArray(rawSnapshot.memberAliases)) {
      rawSnapshot.memberAliases = rawSnapshot.memberAliases.filter(
        (alias) => rosterIdSet.has(alias.memberId),
      );
    }
    validateConfig(rawSnapshot);
    const snapshot = sanitizeNews(rawSnapshot);
    validateConfig(snapshot);
    const serializedConfig = `${JSON.stringify(snapshot, null, 2)}\n`;

    const operation = writeQueue.then(() => persist(snapshot, serializedConfig));
    writeQueue = operation.catch(() => {});
    return operation;
  }

  return {
    async read() {
      try {
        const config = JSON.parse(await fileSystem.readFile(configPath, 'utf8'));
        rejectUnexpectedTopLevelKeys(config);
        const migrated = migrateRawConfig(config);
        validateConfig(migrated);
        const sanitized = sanitizeNews(migrated);
        validateConfig(sanitized);
        if (JSON.stringify(sanitized) !== JSON.stringify(config)) return write(sanitized);
        return sanitized;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;

        const config = createSeedConfig();
        return write(config);
      }
    },
    write,
  };
}
