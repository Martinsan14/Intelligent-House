const fs = require('node:fs');
const path = require('node:path');

function validName(name) {
 return typeof name === 'string' && name.trim().length > 0 &&
  Array.from(name.trim()).length <= 40 && !/[\u0000-\u001f\u007f]/.test(name);
}

function createNameStore(file) {
 let names = {};
 try {
  names = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!names || Array.isArray(names) || typeof names !== 'object' ||
   !Object.entries(names).every(([id, name]) => /^(?:[1-9]|1[0-8])$/.test(id) && validName(name))) {
   throw Error('Invalid light name data');
  }
 } catch (error) {
  if (error.code !== 'ENOENT') throw Error(`Cannot load light names from ${file}: ${error.message}`);
 }
 return {
  get(id, fallback) { return names[id] ?? fallback; },
  set(id, name) {
   const next = { ...names, [id]: name };
   fs.mkdirSync(path.dirname(file), { recursive: true });
   const temporary = `${file}.tmp`;
   try {
    fs.writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(temporary, file);
   } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
   }
   names = next;
  }
 };
}
module.exports = { createNameStore, validName };
