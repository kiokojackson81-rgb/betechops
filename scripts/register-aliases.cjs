const Module = require('module');
const path = require('path');
const fs = require('fs');
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function(request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    const rel = request.slice(2);
    // Prefer compiled worker-dist JS path
    const candidateWorker = path.join(process.cwd(), '.worker-dist', 'src', ...rel.split('/'));
    const tryExt = ['.js', '.cjs', '.mjs'];
    for (const ext of tryExt) {
      const p = candidateWorker + ext;
      if (fs.existsSync(p)) return originalResolve.call(this, p, parent, isMain, options);
    }
    // Fallback to source JS/TS (may not be loadable)
    const candidateSrc = path.join(process.cwd(), 'src', ...rel.split('/'));
    for (const ext of tryExt) {
      const p = candidateSrc + ext;
      if (fs.existsSync(p)) return originalResolve.call(this, p, parent, isMain, options);
    }
    // Also try .cjs shim names
    const candidateCjs = candidateSrc + '.cjs';
    if (fs.existsSync(candidateCjs)) return originalResolve.call(this, candidateCjs, parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
