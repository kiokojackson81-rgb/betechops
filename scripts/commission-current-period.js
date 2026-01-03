#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const email = 'brendah@betech.co.ke'
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return console.log(JSON.stringify({ error: 'user-not-found' }))

    const now = new Date()
    const period = await prisma.commissionPeriod.findFirst({
      where: { startDate: { lte: now }, endDate: { gte: now } },
      orderBy: { startDate: 'desc' }
    })

    if (!period) return console.log(JSON.stringify({ error: 'no-active-commission-period' }))

    const start = period.startDate
    const end = period.endDate

    const [sumEarnings, sumRecordAmounts, attendantComm, ledger] = await Promise.all([
      prisma.commissionEarning.aggregate({
        _sum: { amount: true },
        where: { staffId: user.id, createdAt: { gte: start, lte: end } }
      }),
      prisma.commissionRecord.aggregate({
        _sum: { amount: true },
        where: { attendantId: user.id, createdAt: { gte: start, lte: end }, amount: { not: null } }
      }),
      prisma.attendantCommission.findFirst({ where: { userId: user.id, periodId: period.id } }),
      prisma.commissionLedger.findUnique({ where: { userId_periodStart_periodEnd: { userId: user.id, periodStart: period.startDate, periodEnd: period.endDate } } }).catch(()=>null),
    ])

    const out = {
      user: { id: user.id, email: user.email, name: user.name },
      period: { id: period.id, name: period.name, startDate: period.startDate, endDate: period.endDate },
      totals: {
        commissionEarnings_sum: (sumEarnings._sum.amount || 0).toString(),
        commissionRecords_sum: (sumRecordAmounts._sum.amount || 0).toString(),
      },
      attendantCommission: attendantComm || null,
      ledger: ledger || null
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
