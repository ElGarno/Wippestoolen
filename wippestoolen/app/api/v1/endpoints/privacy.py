"""Privacy policy and legal information endpoints."""

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["legal"])

PRIVACY_HTML = """<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Datenschutzerklärung — Wippestoolen</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6; }
  h1 { color: #E8470A; font-size: 1.5em; }
  h2 { color: #444; font-size: 1.2em; margin-top: 1.5em; }
  a { color: #E8470A; }
</style>
</head>
<body>
<h1>Datenschutzerklärung</h1>
<p><strong>Stand:</strong> März 2026</p>

<h2>1. Verantwortlicher</h2>
<p>Fabian Wörenkämper<br>Wippeskuhlen 53<br>57439 Attendorn<br>E-Mail: <a href="mailto:faffi@gmx.de">faffi@gmx.de</a></p>

<h2>2. Erhobene Daten</h2>
<p>Bei der Nutzung von Wippestoolen werden folgende Daten erhoben:</p>
<ul>
<li><strong>Account-Daten:</strong> Name, E-Mail-Adresse, Passwort (verschlüsselt), Adresse</li>
<li><strong>Profil-Daten:</strong> Anzeigename, Telefonnummer (optional), Profilbild</li>
<li><strong>Werkzeug-Daten:</strong> Fotos, Beschreibungen, Standort (PLZ-basiert)</li>
<li><strong>Buchungs-Daten:</strong> Buchungsanfragen, Zeiträume, Nachrichten</li>
<li><strong>Bewertungen:</strong> Sternebewertung und Kommentare</li>
</ul>

<h2>3. Zweck der Datenverarbeitung</h2>
<p>Die Daten werden ausschließlich für den Betrieb der Werkzeugverleih-Plattform verwendet:</p>
<ul>
<li>Bereitstellung und Verwaltung deines Benutzerkontos</li>
<li>Vermittlung von Werkzeugausleihen zwischen Nachbarn</li>
<li>Benachrichtigungen über Buchungsanfragen und -status</li>
<li>Optionale KI-gestützte Werkzeugerkennung (Foto-Analyse)</li>
</ul>

<h2>4. Rechtsgrundlage</h2>
<p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. a DSGVO (Einwilligung bei optionalen Funktionen wie der KI-Fotoanalyse).</p>

<h2>5. Speicherung und Hosting</h2>
<ul>
<li><strong>Backend &amp; Datenbank:</strong> Railway (EU Region, europe-west4)</li>
<li><strong>Fotos:</strong> Cloudflare R2 (EU)</li>
<li><strong>DNS &amp; CDN:</strong> Cloudflare</li>
</ul>

<h2>6. Drittanbieter</h2>
<ul>
<li><strong>Anthropic (Claude API):</strong> Optionale KI-Fotoanalyse zur Werkzeugerkennung. Fotos werden nur für die Analyse übertragen und nicht gespeichert.</li>
<li><strong>Cloudflare:</strong> CDN, DNS und Objektspeicher.</li>
</ul>

<h2>7. Speicherdauer</h2>
<p>Deine Daten werden gespeichert, solange dein Account besteht. Nach einer Kontolöschung werden personenbezogene Daten sofort anonymisiert und nach 30 Tagen endgültig gelöscht.</p>

<h2>8. Deine Rechte</h2>
<p>Du hast folgende Rechte:</p>
<ul>
<li><strong>Auskunft</strong> (Art. 15 DSGVO)</li>
<li><strong>Berichtigung</strong> (Art. 16 DSGVO)</li>
<li><strong>Löschung</strong> (Art. 17 DSGVO) — In der App unter Einstellungen → "Account löschen"</li>
<li><strong>Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO)</li>
<li><strong>Datenportabilität</strong> (Art. 20 DSGVO)</li>
<li><strong>Widerspruch</strong> (Art. 21 DSGVO)</li>
</ul>
<p>Kontakt: <a href="mailto:faffi@gmx.de">faffi@gmx.de</a></p>

<h2>9. Beschwerderecht</h2>
<p>Du hast das Recht, eine Beschwerde bei der zuständigen Datenschutzbehörde einzureichen:<br>
Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen<br>
<a href="https://www.ldi.nrw.de">www.ldi.nrw.de</a></p>

<hr>
<h1>Impressum</h1>
<p>Fabian Wörenkämper<br>Wippeskuhlen 53<br>57439 Attendorn<br>E-Mail: <a href="mailto:faffi@gmx.de">faffi@gmx.de</a></p>
<p>Inhaltlich Verantwortlicher gemäß § 55 Abs. 2 RStV: Fabian Wörenkämper (Anschrift wie oben).</p>
</body>
</html>"""


@router.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    """Return privacy policy and legal information as HTML."""
    return PRIVACY_HTML
