#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const email = 'brendah@betech.co.ke'
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return console.log(JSON.stringify({ error: 'user-not-found' }))

    const [earningsCount, recordsCount, commsCount, ledgersCount, balance, recentEarnings, recentRecords] = await Promise.all([
      prisma.commissionEarning.count({ where: { staffId: user.id } }),
      prisma.commissionRecord.count({ where: { attendantId: user.id } }),
      prisma.attendantCommission.count({ where: { userId: user.id } }),
      prisma.commissionLedger.count({ where: { userId: user.id } }),
      prisma.balance.findUnique({ where: { userId: user.id } }),
      prisma.commissionEarning.findMany({ where: { staffId: user.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.commissionRecord.findMany({ where: { attendantId: user.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ])

    const out = {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      counts: { earnings: earningsCount, records: recordsCount, attendantCommissions: commsCount, ledgers: ledgersCount },
      balance: balance || null,
      recentEarnings,
      recentRecords,
    }

    console.log(JSON.stringify(out, null, 2))
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err)
    process.exitCode = 2
  } finally {
    await new PrismaClient().$disconnect().catch(()=>{})
  }
}

main()
