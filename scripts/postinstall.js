const { spawnSync } = require('child_process');

function run(cmd, args) {
  console.log('> ' + [cmd].concat(args).join(' '));
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (res.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(' ')}`);
    process.exit(res.status || 1);
  }
}

try {
  // 1) Generate Prisma client
  run('npm', ['run', 'prisma:generate']);
  // 2) Setup git hooks
  run('npm', ['run', 'setup:hooks']);
  console.log('postinstall completed');
} catch (err) {
  console.error('postinstall failed', err);
  process.exit(1);
}
