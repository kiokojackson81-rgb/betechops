#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
(async function main(){
  try{
    const projectRoot = path.resolve(__dirname,'..');
    require('ts-node').register({ transpileOnly: true, project: path.join(projectRoot,'tsconfig.json'), compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
    const tsconfigPath = path.join(projectRoot,'tsconfig.json');
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath,'utf8'));
    require('tsconfig-paths').register({ baseUrl: projectRoot, paths: (tsconfig.compilerOptions&&tsconfig.compilerOptions.paths) || {} });

    const { getOnlineEarningsSummary } = require('../src/lib/onlineOps.ts');
    const { prisma } = require('../src/lib/prisma.ts');

    const emailOrId = process.argv[2] || 'brendah@betech.co.ke';
    let user = await prisma.user.findUnique({ where: { email: String(emailOrId).toLowerCase() } });
    const userId = user ? user.id : emailOrId;

    const summary = await getOnlineEarningsSummary(userId);
    console.log(JSON.stringify(summary, null, 2));
  }catch(e){
    console.error(e && e.stack ? e.stack : e);
    process.exitCode = 1;
  }
})();
