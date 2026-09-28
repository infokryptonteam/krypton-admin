export const entityDefinitions = {
  clients: { idField: 'Client ID', prefix: 'CLI', required: ['Client Name'] },
  projects: { idField: 'Project ID', prefix: 'PRJ', required: ['Client ID', 'Project Name'] },
  files: { idField: 'File ID', prefix: 'FIL', required: ['File Name', 'Client ID', 'Project ID'] },
  urls: { idField: 'URL ID', prefix: 'URL', required: ['Client ID', 'Project ID', 'URL Name', 'URL'] },
  tasks: { idField: 'Task ID', prefix: 'TSK', required: ['Client ID', 'Project ID', 'Task'] },
  team: { idField: 'Member ID', prefix: 'MEM', required: ['Name'] },
  payments: { idField: 'Payment ID', prefix: 'PAY', required: ['Client ID', 'Amount'] },
  reports: { idField: 'Report ID', prefix: 'RPT', required: ['Client ID', 'Month'] },
  settings: { idField: 'Setting ID', prefix: 'SET', required: [] },
};

export function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function normalizeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Record data must be an object.');
  const entries = Object.entries(value);
  if (entries.length > 80 || JSON.stringify(value).length > 40000) throw new Error('Record data is too large.');
  const record = {};
  for (const [key, item] of entries) {
    if (!key || key.length > 100 || ['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    if (item === null || ['string', 'number', 'boolean'].includes(typeof item)) record[key] = typeof item === 'string' ? item.trim() : item;
  }
  return record;
}

export function validateRecord(entity, record) {
  const definition = entityDefinitions[entity];
  if (!definition) throw new Error('Unsupported record type.');
  for (const field of definition.required) {
    if (record[field] === undefined || record[field] === null || String(record[field]).trim() === '') {
      throw new Error(`${field} is required.`);
    }
  }
  if (entity === 'payments') {
    const amount = Number(record.Amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero.');
    record.Amount = amount;
  }
  if (entity === 'projects' && record.Budget !== undefined && record.Budget !== '') {
    const budget = Number(record.Budget);
    if (!Number.isFinite(budget) || budget < 0) throw new Error('Project budget must be zero or greater.');
    record.Budget = budget;
  }
  if (entity === 'urls' || (entity === 'reports' && record['Report URL']) || (entity === 'files' && record['File Link'])) {
    const value = String(record.URL || record['Report URL'] || record['File Link'] || '');
    if (value && !/^https?:\/\//i.test(value)) throw new Error('Links must use http or https.');
  }
}

export async function readEntity(db, entity) {
  const result = await db.prepare('SELECT data_json FROM records WHERE entity = ? ORDER BY created_at DESC').bind(entity).all();
  return result.results.map(row => JSON.parse(row.data_json));
}

async function validateRelationships(db, entity, record) {
  if (['projects', 'urls', 'tasks', 'payments', 'reports', 'files'].includes(entity)) {
    const clientId = String(record['Client ID'] || '');
    const clients = await readEntity(db, 'clients');
    if (!clients.some(client => String(client['Client ID']) === clientId)) throw new Error('Select an existing client.');
  }

  const projectId = String(record['Project ID'] || '');
  const projectRequired = ['urls', 'tasks', 'files'].includes(entity);
  if (projectRequired && !projectId) throw new Error('Select a project.');
  if (projectId && ['urls', 'tasks', 'payments', 'reports', 'files'].includes(entity)) {
    const projects = await readEntity(db, 'projects');
    if (!projects.some(project => String(project['Project ID']) === projectId && String(project['Client ID']) === String(record['Client ID']))) {
      throw new Error('Select a project that belongs to the selected client.');
    }
  }
}

export async function saveEntity(db, entity, value) {
  const definition = entityDefinitions[entity];
  if (!definition) throw new Error('Unsupported record type.');
  const record = normalizeRecord(value);
  validateRecord(entity, record);
  await validateRelationships(db, entity, record);
  record[definition.idField] = createId(definition.prefix);
  const now = Date.now();
  await db.prepare('INSERT INTO records (entity, record_id, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(entity, record[definition.idField], JSON.stringify(record), now, now).run();
  return record;
}

export async function updateEntity(db, entity, recordId, value) {
  const definition = entityDefinitions[entity];
  if (!definition) throw new Error('Unsupported record type.');
  const existing = await db.prepare('SELECT data_json FROM records WHERE entity = ? AND record_id = ?').bind(entity, recordId).first();
  if (!existing) throw new Error('Record not found. Refresh the page and try again.');

  const record = normalizeRecord(value);
  validateRecord(entity, record);
  await validateRelationships(db, entity, record);
  record[definition.idField] = recordId;

  if (entity === 'projects') {
    const previous = JSON.parse(existing.data_json);
    if (String(previous['Client ID']) !== String(record['Client ID'])) {
      const dependents = ['urls', 'tasks', 'payments', 'reports', 'files'];
      for (const dependent of dependents) {
        const rows = await readEntity(db, dependent);
        if (rows.some(row => String(row['Project ID']) === String(recordId))) {
          throw new Error('Cannot change the client while this project has linked records.');
        }
      }
    }
  }

  await db.prepare('UPDATE records SET data_json = ?, updated_at = ? WHERE entity = ? AND record_id = ?')
    .bind(JSON.stringify(record), Date.now(), entity, recordId).run();
  return record;
}

export async function deleteEntity(db, entity, recordId) {
  if (!entityDefinitions[entity]) throw new Error('Unsupported record type.');
  const existing = await db.prepare('SELECT record_id FROM records WHERE entity = ? AND record_id = ?').bind(entity, recordId).first();
  if (!existing) throw new Error('Record not found. Refresh the page and try again.');

  const references = entity === 'clients'
    ? [['projects', 'Client ID'], ['urls', 'Client ID'], ['tasks', 'Client ID'], ['payments', 'Client ID'], ['reports', 'Client ID'], ['files', 'Client ID']]
    : entity === 'projects'
      ? [['urls', 'Project ID'], ['tasks', 'Project ID'], ['payments', 'Project ID'], ['reports', 'Project ID'], ['files', 'Project ID']]
      : [];
  for (const [dependent, field] of references) {
    const rows = await readEntity(db, dependent);
    if (rows.some(row => String(row[field]) === String(recordId))) {
      throw new Error(`Cannot delete this ${entity.slice(0, -1)} while it has linked ${dependent} records.`);
    }
  }

  await db.prepare('DELETE FROM records WHERE entity = ? AND record_id = ?').bind(entity, recordId).run();
  return { deleted: true };
}

export async function readWorkspace(db) {
  const workspace = {};
  for (const entity of Object.keys(entityDefinitions)) workspace[entity] = await readEntity(db, entity);
  return workspace;
}
