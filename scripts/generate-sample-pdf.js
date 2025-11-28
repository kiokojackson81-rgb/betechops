const fs = require('fs');
(async () => {
  const puppeteer = require('puppeteer');

  const MARKETPLACE_SHOPS = [
    "Betech Store",
    "JM Collection",
    "Hitech Power",
    "Maxton",
    "Sky Store",
    "Betech Solar",
    "Kilimall",
  ];

  const reports = [
    {
      date: new Date().toISOString(),
      day: 'Saturday',
      user: { name: 'Alice' },
      tasks: {
        submittedBy: 'Alice',
        marketplaceReview: {
          'Betech Store': { stockChecked: true, pricingConfirmed: true, competitorsReviewed: false, oosReviewed: false, notes: 'OK' },
          'JM Collection': { stockChecked: false, pricingConfirmed: true, competitorsReviewed: true, oosReviewed: false, notes: '' },
        },
        customerComms: {
          walkInServed: 12,
          walkInsWhoPurchased: 8,
          callsHandled: 3,
          whatsappSmsReplied: true,
          fbCommentsReplied: true,
          fbDmsReplied: false,
          igCommentsReplied: true,
          igDmsReplied: false,
        },
        dayFields: {
          liveSessionsCount: 2,
          liveSessionsDurationMinutes: 95,
          liveSessionsPlatform: 'Facebook',
          liveSessionsEstimatedViewers: 420,
          liveSessionsLeadsGenerated: 12,
          liveSessionsHosted: 2,
          officeCleanOrganized: true,
          saturdayNotes: 'Good turnout, stable sales.'
        }
      }
    },
    {
      date: new Date(Date.now()-86400000).toISOString(),
      day: 'Friday',
      user: { name: 'Bob' },
      tasks: {
        submittedBy: 'Bob',
        marketplaceReview: {},
        customerComms: {
          walkInServed: 5,
          onlineServed: 2,
          callsHandled: 1,
          whatsappSmsReplied: false,
          fbCommentsReplied: false,
          fbDmsReplied: false,
          igCommentsReplied: false,
          igDmsReplied: false,
        },
        dayFields: {}
      }
    }
  ];

  const rows = reports.map((r) => {
    const dateStr = new Date(r.date).toISOString().split('T')[0];
    const attendant = r.user?.name ?? '';
    const mr = (r.tasks || {}).marketplaceReview || {};
    const shopCells = MARKETPLACE_SHOPS.map((s) => {
      const v = mr[s] || {};
      return `<td style="padding:6px;border:1px solid #ddd">${v.stockChecked ? 'Yes' : ''}</td>`+
             `<td style="padding:6px;border:1px solid #ddd">${v.pricingConfirmed ? 'Yes' : ''}</td>`+
             `<td style="padding:6px;border:1px solid #ddd">${v.competitorsReviewed ? 'Yes' : ''}</td>`+
             `<td style="padding:6px;border:1px solid #ddd">${v.oosReviewed ? 'Yes' : ''}</td>`;
    }).join('');

    const cc = (r.tasks || {}).customerComms || {};
    const walkInServed = cc.walkInServed ?? '';
    const walkInsPurchased = cc.walkInsWhoPurchased ?? cc.onlineServed ?? '';
    const callsHandled = cc.callsHandled ?? '';
    const whatsappSmsReplied = cc.whatsappSmsReplied ? 'Yes' : '';
    const fbComments = cc.fbCommentsReplied ? 'Yes' : '';
    const fbDms = cc.fbDmsReplied ? 'Yes' : '';
    const igComments = cc.igCommentsReplied ? 'Yes' : '';
    const igDms = cc.igDmsReplied ? 'Yes' : '';

    const df = (r.tasks || {}).dayFields || {};
    const satCount = df.liveSessionsCount ?? '';
    const satDuration = df.liveSessionsDurationMinutes ?? '';
    const satPlatform = df.liveSessionsPlatform ?? '';
    const satViewers = df.liveSessionsEstimatedViewers ?? '';
    const satLeads = df.liveSessionsLeadsGenerated ?? '';
    const satHostedLegacy = df.liveSessionsHosted ?? '';
    const satOfficeClean = df.officeCleanOrganized ? 'Yes' : '';
    const satNotes = df.saturdayNotes ?? '';

    return `<tr>
      <td style="padding:6px;border:1px solid #ddd">${dateStr}</td>
      <td style="padding:6px;border:1px solid #ddd">${r.day}</td>
      <td style="padding:6px;border:1px solid #ddd">${attendant}</td>
      <td style="padding:6px;border:1px solid #ddd">${r.tasks?.submittedBy ?? ''}</td>
      ${shopCells}
      <td style="padding:6px;border:1px solid #ddd">${walkInServed}</td>
      <td style="padding:6px;border:1px solid #ddd">${walkInsPurchased}</td>
      <td style="padding:6px;border:1px solid #ddd">${callsHandled}</td>
      <td style="padding:6px;border:1px solid #ddd">${whatsappSmsReplied}</td>
      <td style="padding:6px;border:1px solid #ddd">${fbComments}</td>
      <td style="padding:6px;border:1px solid #ddd">${fbDms}</td>
      <td style="padding:6px;border:1px solid #ddd">${igComments}</td>
      <td style="padding:6px;border:1px solid #ddd">${igDms}</td>
      <td style="padding:6px;border:1px solid #ddd">${satCount}</td>
      <td style="padding:6px;border:1px solid #ddd">${satDuration}</td>
      <td style="padding:6px;border:1px solid #ddd">${satPlatform}</td>
      <td style="padding:6px;border:1px solid #ddd">${satViewers}</td>
      <td style="padding:6px;border:1px solid #ddd">${satLeads}</td>
      <td style="padding:6px;border:1px solid #ddd">${satHostedLegacy}</td>
      <td style="padding:6px;border:1px solid #ddd">${satOfficeClean}</td>
      <td style="padding:6px;border:1px solid #ddd">${satNotes}</td>
    </tr>`;
  }).join('');

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Daily Reports PDF (Sample)</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; color:#111; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; }
          th { background: #f4f4f4; }
        </style>
      </head>
      <body>
        <h1>Daily Reports Export (Sample)</h1>
        <table>
          <thead>
            <tr>
              <th rowspan="2">Date</th>
              <th rowspan="2">Day</th>
              <th rowspan="2">Attendant</th>
              <th rowspan="2">SubmittedBy</th>
              ${MARKETPLACE_SHOPS.map((s)=>`<th colspan="4" style="padding:6px;border:1px solid #ddd">${s}</th>`).join('')}
              <th rowspan="2">WalkIn Served</th>
              <th rowspan="2">WalkIns Purchased</th>
              <th rowspan="2">Calls Handled</th>
              <th rowspan="2">WhatsApp/SMS Replied</th>
              <th rowspan="2">FB Comments</th>
              <th rowspan="2">FB DMs</th>
              <th rowspan="2">IG Comments</th>
              <th rowspan="2">IG DMs</th>
              <th colspan="6">Saturday Live Session</th>
              <th rowspan="2">Saturday Office Cleaned</th>
              <th rowspan="2">Saturday Notes</th>
            </tr>
            <tr>
              ${MARKETPLACE_SHOPS.map(()=>`<th>Stock</th><th>Pricing</th><th>Comp</th><th>OOS</th>`).join('')}
              <th>Count</th><th>Duration (min)</th><th>Platform</th><th>Estimated Viewers</th><th>Leads</th><th>Legacy Hosted</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>`;

  const outDir = 'tmp';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const out = `${outDir}/daily_reports_sample.pdf`;

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: out, format: 'A4', printBackground: true });
  await browser.close();
  console.log('Sample PDF written to', out);
})();
