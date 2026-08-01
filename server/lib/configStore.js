import * as defaultFileSystem from 'node:fs/promises';
import { join } from 'node:path';
import { createSeedConfig, migrateRawConfig } from '../../src/data/siteConfig.js';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isNonNegativeFinite = (value) => Number.isFinite(value) && value >= 0;
const isValidDateKey = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};
const rawTopLevelKeys = ['team', 'stats', 'roster', 'albums', 'dailyScores', 'news', 'music'];
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

  requireStrings(config.team, ['name', 'label', 'motto', 'heroImage'], 'team', details);
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
    const singlesStatCount = config.stats.filter(
      (stat) => isObject(stat) && isNonEmptyString(stat.label) && stat.label.trim() === '单身贵族',
    ).length;
    if (singlesStatCount !== 1) {
      details.push('stats must contain exactly one 单身贵族 item');
    }

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

      if (isNonEmptyString(stat.label) && stat.label.trim() === '单身贵族') {
        for (const field of ['male', 'female']) {
          if (!isObject(stat.value) || !isNonNegativeFinite(stat.value[field])) {
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
      requireString(member, ['avatar', 'videoUrl'], path, details);
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
        requireStrings(photo, ['src', 'title', 'date', 'alt'], photoPath, details);
        if (photo.mediaType !== undefined && !['image', 'video'].includes(photo.mediaType)) {
          details.push(`${photoPath}.mediaType must be image or video`);
        }
        if (photo.featured !== undefined && typeof photo.featured !== 'boolean') {
          details.push(`${photoPath}.featured must be a boolean`);
        }
        if (photo.videoUrl !== undefined && typeof photo.videoUrl !== 'string') {
          details.push(`${photoPath}.videoUrl must be a string`);
        }
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
        if (!memberIds.has(row.id)) {
          details.push(`${path}.id must reference an existing roster member`);
        } else if (seenRowIds.has(row.id)) {
          details.push(`${path}.id must be unique within its date`);
        } else {
          seenRowIds.add(row.id);
        }
        for (const field of ['name', 'score', 'total']) {
          if (field in row) {
            details.push(`${path}.${field} is derived and must not be stored`);
          }
        }
        for (const field of ['teamRace', 'openRace']) {
          const race = row[field];
          let hasInvalidRaceValue = false;
          if (Array.isArray(race)) {
            for (let raceIndex = 0; raceIndex < race.length; raceIndex += 1) {
              if (!isNonNegativeFinite(race[raceIndex])) {
                hasInvalidRaceValue = true;
              }
            }
          }
          if (!Array.isArray(race) || race.length !== 3 || hasInvalidRaceValue) {
            details.push(
              `${path}.${field} must contain exactly 3 non-negative finite numbers`,
            );
          }
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
    const snapshot = structuredClone(selectRawConfig(config));
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
        if (JSON.stringify(migrated) !== JSON.stringify(config)) return write(migrated);
        return migrated;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;

        const config = createSeedConfig();
        return write(config);
      }
    },
    write,
  };
}
