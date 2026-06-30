from __future__ import annotations
import subprocess, re, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import config

voices = ['andrew-ml', 'david-c', 'erik-adsa', 'grant-llm']
base = r'D:\Projects\TeacherClone\backend\data\voices'

print('Voice file quality report (post-normalization):')
print('-' * 65)

for v in voices:
    path = os.path.join(base, v + '.wav')
    cmd = ['ffmpeg', '-y', '-i', path, '-af', 'volumedetect', '-f', 'null', '-']
    r = subprocess.run(cmd, capture_output=True, text=True, errors='replace')
    mean_v = max_v = dur = '?'
    for line in r.stderr.splitlines():
        if 'mean_volume' in line:
            m = re.search(r'mean_volume: ([-\d.]+)', line)
            if m: mean_v = m.group(1) + ' dB'
        if 'max_volume' in line:
            m = re.search(r'max_volume: ([-\d.]+)', line)
            if m: max_v = m.group(1) + ' dB'
        if 'Duration' in line:
            m = re.search(r'Duration: ([\d:]+)', line)
            if m: dur = m.group(1)
    status = 'GOOD' if mean_v != '?' and float(mean_v.replace(' dB','')) > -25 else 'CHECK'
    print(v + ' | dur=' + dur + ' | mean=' + mean_v + ' | max=' + max_v + ' | ' + status)
