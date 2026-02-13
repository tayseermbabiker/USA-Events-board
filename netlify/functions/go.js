const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const SITE_URL = process.env.SITE_URL || 'https://conferix.com/usa';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function buildEventPage(ev, related) {
  const title = ev.title || 'Event';
  const desc = ev.description || '';
  const date = formatDate(ev.start_date);
  const endDate = ev.end_date && ev.end_date !== ev.start_date ? ` — ${formatDate(ev.end_date)}` : '';
  const venue = ev.venue_name || '';
  const address = ev.venue_address || '';
  const city = ev.city || '';
  const organizer = ev.organizer || '';
  const industry = ev.industry || '';
  const isFree = ev.is_free ? 'Free' : 'Paid';
  const regUrl = ev.registration_url || '';
  const imageUrl = ev.image_url || '';

  // Google Calendar link
  const calStart = (ev.start_date || '').replace(/-/g, '');
  const calEnd = ev.end_date ? ev.end_date.replace(/-/g, '') : calStart;
  const calTitle = encodeURIComponent(title);
  const calDetails = encodeURIComponent(desc.substring(0, 200) + (regUrl ? `\n\nRegister: ${regUrl}` : ''));
  const calLocation = encodeURIComponent([venue, address, city].filter(Boolean).join(', '));
  const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&dates=${calStart}/${calEnd}&details=${calDetails}&location=${calLocation}`;

  const imageBanner = imageUrl
    ? `<img src="${imageUrl}" alt="${title}" style="width:100%;max-height:280px;object-fit:cover;border-radius:8px;margin-bottom:24px;">`
    : '';

  const detailRow = (label, value) => value
    ? `<tr><td style="padding:6px 0;font-size:13px;color:#94a3b8;width:100px;vertical-align:top;">${label}</td><td style="padding:6px 0;font-size:14px;color:#0B1426;">${value}</td></tr>`
    : '';

  const relatedHtml = related.length > 0
    ? `<p style="margin:32px 0 12px;font-size:18px;font-weight:600;color:#0B1426;">More events you might like</p>
       <table width="100%" cellpadding="0" cellspacing="0">
         ${related.map((r, i) => {
           const rDate = formatDate(r.start_date);
           const rCity = r.city ? `, ${r.city}` : '';
           return `<tr><td style="padding:6px 0;font-size:14px;color:#0B1426;line-height:1.5;">${i + 1}. <a href="${SITE_URL}/.netlify/functions/go?id=${r.id}" style="color:#1E3A5F;text-decoration:none;font-weight:600;">${r.title}</a> — <span style="color:#64748b;">${rDate}${rCity}</span></td></tr>`;
         }).join('')}
       </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Conferix USA</title>
  <meta name="description" content="${desc.substring(0, 155)}">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": "${title.replace(/"/g, '\\"')}",
    "startDate": "${ev.start_date || ''}",
    ${ev.end_date ? `"endDate": "${ev.end_date}",` : ''}
    "description": "${desc.substring(0, 300).replace(/"/g, '\\"').replace(/\n/g, ' ')}",
    ${venue ? `"location": { "@type": "Place", "name": "${venue.replace(/"/g, '\\"')}", "address": "${(address || city).replace(/"/g, '\\"')}" },` : ''}
    ${organizer ? `"organizer": { "@type": "Organization", "name": "${organizer.replace(/"/g, '\\"')}" },` : ''}
    "isAccessibleForFree": ${ev.is_free ? 'true' : 'false'}
  }
  </script>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0B1426,#1C2333);padding:20px 24px;border-radius:12px 12px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td><a href="${SITE_URL}" style="font-size:20px;font-weight:700;color:#ffffff;text-decoration:none;">Conferix <span style="color:#D4A853;">USA</span></a></td>
              <td style="text-align:right;"><a href="${SITE_URL}" style="font-size:13px;color:#94a3b8;text-decoration:none;">Browse All Events</a></td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px 24px;">
          ${imageBanner}
          <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0B1426;line-height:1.3;">${title}</p>
          <p style="margin:0 0 20px;font-size:14px;color:#64748b;">${date}${endDate}${city ? ` · ${city}` : ''}</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            ${detailRow('Venue', venue + (address ? `, ${address}` : ''))}
            ${detailRow('Organizer', organizer)}
            ${detailRow('Industry', industry)}
            ${detailRow('Cost', isFree)}
          </table>

          ${desc ? `<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">${desc}</p>` : ''}

          <table cellpadding="0" cellspacing="0" width="100%">
            <tr><td align="center" style="padding-bottom:12px;">
              ${regUrl ? `<a href="${regUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 36px;background:#1E3A5F;color:#ffffff;border-radius:8px;font-size:16px;font-weight:600;text-decoration:none;">Register on Official Site</a>` : ''}
            </td></tr>
            <tr><td align="center">
              <a href="${calUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 24px;background:#ffffff;color:#1E3A5F;border:2px solid #1E3A5F;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Add to Calendar</a>
            </td></tr>
          </table>

          ${relatedHtml}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 24px;border-radius:0 0 12px 12px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:13px;color:#94a3b8;"><a href="${SITE_URL}" style="color:#64748b;text-decoration:underline;">conferix.com/usa</a> — Professional events in the USA</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

exports.handler = async (event) => {
  const id = (event.queryStringParameters || {}).id;

  if (!id) {
    return { statusCode: 302, headers: { Location: SITE_URL } };
  }

  try {
    const record = await base('Events').find(id);

    // Track the click
    const clicks = (record.get('click_count') || 0) + 1;
    const today = new Date().toISOString().split('T')[0];
    await base('Events').update(id, {
      click_count: clicks,
      last_clicked_at: today,
    });

    const ev = {
      title: record.get('title'),
      description: record.get('description'),
      start_date: record.get('start_date'),
      end_date: record.get('end_date'),
      venue_name: record.get('venue_name'),
      venue_address: record.get('venue_address'),
      city: record.get('city'),
      organizer: record.get('organizer'),
      industry: record.get('industry'),
      is_free: record.get('is_free') || false,
      registration_url: record.get('registration_url'),
      image_url: record.get('image_url'),
    };

    // Fetch related events (same city or industry, upcoming, max 5)
    const relatedRecords = await base('Events').select({
      filterByFormula: `AND({start_date} >= "${today}", RECORD_ID() != "${id}", OR({city} = "${ev.city}", {industry} = "${ev.industry}"))`,
      sort: [{ field: 'start_date', direction: 'asc' }],
      maxRecords: 5,
    }).all();

    const related = relatedRecords.map(r => ({
      id: r.id,
      title: r.get('title'),
      start_date: r.get('start_date'),
      city: r.get('city'),
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
      body: buildEventPage(ev, related),
    };
  } catch (err) {
    console.error('Event page error:', err.message);
    return { statusCode: 302, headers: { Location: SITE_URL } };
  }
};
