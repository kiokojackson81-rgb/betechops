#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const email = 'brendah@betech.co.ke'

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      console.log(JSON.stringify({ error: `User not found: ${email}` }))
      return
    }

    const [earnings, records, attendantComms, ledgers, balance, dailyReports] = await Promise.all([
      prisma.commissionEarning.findMany({ where: { staffId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.commissionRecord.findMany({ where: { attendantId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.attendantCommission.findMany({ where: { userId: user.id }, orderBy: { computedAt: 'desc' }, take: 20 }),
      prisma.commissionLedger.findMany({ where: { userId: user.id }, orderBy: { periodStart: 'desc' }, take: 10 }),
      prisma.balance.findUnique({ where: { userId: user.id } }),
      prisma.dailyReport.findMany({ where: { userId: user.id }, orderBy: { date: 'desc' }, take: 20 }),
    ])

    console.log(JSON.stringify({ user, earnings, records, attendantComms, ledgers, balance, dailyReports }, null, 2))
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err)
    process.exitCode = 2
  } finally {
    try { await new PrismaClient().$disconnect() } catch (e) {}
  }
}

main()
