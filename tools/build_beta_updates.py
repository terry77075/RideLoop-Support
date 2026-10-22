"""Build accessible static markup from reviewed release data; no runtime fetch."""
import argparse
import datetime
import html
import json
from pathlib import Path

def esc(value):
    return html.escape(str(value), quote=True)

def safe_link(url):
    if not (url.startswith('https://') or url.startswith('#') or url.startswith('release-notes.html#')):
        raise ValueError('Only HTTPS or page anchors are permitted')
    return esc(url)

def bullets(title, entries):
    if entries is None:
        return f'<h5>{esc(title)}</h5><p>Not yet documented for this build.</p>'
    if not entries:
        return ''
    return f'<h5>{esc(title)}</h5><ul>' + ''.join(f'<li>{esc(item)}</li>' for item in entries) + '</ul>'

def release_card(release):
    status = release['status']
    if status not in ('available', 'development'):
        raise ValueError('Invalid status')
    datetime.date.fromisoformat(release['date'])
    label = 'Available to beta testers' if status == 'available' else 'In development · not yet released'
    out = f'<article class="beta-release"><span class="beta-status beta-status-{status}">{label}</span>'
    out += f'<h4>{esc(release["label"])}</h4><p class="beta-release-meta">{esc(release.get("dateLabel", "Released"))}: <time datetime="{esc(release["date"])}">{esc(release["date"])}</time></p>'
    for title, key in [("What’s new", 'added'), ('Fixes', 'fixed'), ('Known issues', 'knownIssues')]:
        out += bullets(title, release.get(key))
    if release.get('testFocus'):
        out += bullets('Please help test', release['testFocus'])
    if release.get('notesUrl'):
        out += f'<p><a href="{safe_link(release["notesUrl"])}">Full release notes</a></p>'
    return out + '</article>'

def render(data, publish=False):
    if publish and (not data.get('publishApproved') or not data.get('reviewedAt')):
        raise ValueError('Release review and publication approval are required')
    out = '<section class="beta-updates" id="beta-updates" aria-labelledby="beta-updates-title"><p class="section-kicker">Building outabit together</p><h2 id="beta-updates-title">Beta updates &amp; installation.</h2><p class="beta-updates-intro">See what is available for your device, what changed between builds, and how to install or update. Work in development is listed separately and is not a promise of availability.</p><div class="beta-platforms">'
    for platform in data['platforms']:
        releases = sorted(platform['releases'], key=lambda r: (r['date'], r.get('buildOrder', 0)), reverse=True)
        if publish and any(not r.get('verified') for r in releases):
            raise ValueError('Unverified release record')
        available = [r for r in releases if r['status'] == 'available']
        development = [r for r in releases if r['status'] == 'development']
        out += f'<details class="beta-platform"><summary><h3 id="beta-{esc(platform["id"])}">{esc(platform["label"])}</h3></summary><div class="beta-platform-content">'
        out += release_card(available[0]) if available else '<p>Release details awaiting verification.</p>'
        install = platform['installation']
        out += '<h4>Install or update</h4><p>' + esc(install['summary']) + '</p><ol>' + ''.join('<li>'+esc(step)+'</li>' for step in install['steps']) + '</ol>'
        out += f'<p><a href="{safe_link(install["href"])}">{esc(install["linkLabel"])}</a></p>'
        if development:
            out += '<h4>In development</h4>' + ''.join(release_card(r) for r in development)
        if len(available) > 1:
            out += '<details><summary>Earlier builds</summary>' + ''.join(release_card(r) for r in available[1:]) + '</details>'
        out += '</div></details>'
    out += '</div><p class="beta-updates-footer">Found a problem? Tell us your device, app build, what happened, and what you expected. Please do not include private route or location data unless needed and requested. <a href="mailto:support@outabit.com">Contact support</a>.</p></section>'
    return out

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    here = Path(__file__).resolve().parent
    if here.name == 'tools':
        here = here.parent
    data = json.loads((here/'beta-updates.json').read_text())
    (here/'beta-updates.fragment.html').write_text(render(data, args.publish))
