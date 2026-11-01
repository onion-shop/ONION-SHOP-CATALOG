"""Собирает index.html (GitHub Pages) и artifact.html (предпросмотр) из index.src.html, а также backend/Code.gs."""
import re, os, subprocess
ROOT = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(ROOT, 'index.src.html'), encoding='utf-8').read()
sprite = open(os.path.join(ROOT, 'assets', 'sprite.svg'), encoding='utf-8').read()
src = src.replace('<!--SPRITE-->', sprite)
site = re.sub(r'<!--/?(HEAD|BODY|MANIFEST)-->\n?', '', src)
# ?v=отпечаток файла: после обновления сайта браузер сразу берёт новые скрипты и стили, а не старые из кеша
import hashlib
def _ver(m):
    path = os.path.join(ROOT, m.group(2))
    if not os.path.exists(path):
        return m.group(0)
    return m.group(1) + m.group(2) + '?v=' + hashlib.md5(open(path, 'rb').read()).hexdigest()[:8] + m.group(3)
site = re.sub(r'((?:src|href)=")(assets/[\w.-]+\.(?:js|css)|data/colors\.js)(")', _ver, site)
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(site)
head = src.split('<!--HEAD-->')[1].split('<!--/HEAD-->')[0]
head = re.sub(r'<!--MANIFEST-->.*?<!--/MANIFEST-->\n?', '', head, flags=re.S)
body = src.split('<!--BODY-->')[1].split('<!--/BODY-->')[0]
open(os.path.join(ROOT, 'artifact.html'), 'w', encoding='utf-8').write(head.strip() + '\n' + body.strip() + '\n')
subprocess.run(['python3', os.path.join(ROOT, 'backend', 'build_gs.py')], check=True)
print('ok', len(site), 'bytes')
