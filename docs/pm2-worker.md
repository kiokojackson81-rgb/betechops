# PM2 workers

The former continuous Jumia sync worker was removed because it created overlapping vendor syncs and excessive production load. Jumia orders are refreshed only by an authenticated administrator using the bounded incremental sync in the Orders screen.

`ecosystem.worker.config.cjs` now contains only the unrelated POD retry worker. If an existing PM2 host still has `jumia-sync` or `jumia-sync-worker`, remove it there and save the PM2 process list:

```bash
pm2 delete jumia-sync jumia-sync-worker
pm2 save
```
