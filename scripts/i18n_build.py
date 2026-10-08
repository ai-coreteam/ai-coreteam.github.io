#!/usr/bin/env python3
"""Sinh assets/i18n/en.js từ assets/i18n/en_source.json (bản dịch để người đọc / duyệt).
en_source.json: {"dict": {"câu tiếng Việt": "English"}, "patterns": [["^regex$", "English $1"], ...]}
Kiểm tra: khoá không trùng sau khi chuẩn hoá khoảng trắng; mẫu câu biên dịch được; bản dịch không còn chữ tiếng Việt
(trừ tên riêng được phép: Jeong-Do, VietQR…)."""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = json.load(open(os.path.join(ROOT, 'assets/i18n/en_source.json'), encoding='utf-8'))
VI = re.compile(r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]')
norm = lambda s: re.sub(r'\s+', ' ', s).strip()
d, bad = {}, []
for k, v in src['dict'].items():
    nk = norm(k)
    if nk in d and d[nk] != v: bad.append(f'trùng khoá khác nghĩa: {nk}')
    if VI.search(re.sub(r'\d[\d.,]*\s*đ', '', v)) or re.search(r'\b(SP|NV|Kho|kho|Tivi)\b', v): bad.append(f'bản dịch còn tiếng Việt: {nk} → {v}')
    d[nk] = v
for rx, rep in src.get('patterns', []):
    try: re.compile(rx)
    except re.error as e: bad.append(f'mẫu lỗi {rx}: {e}')
if bad: print('\n'.join(bad)); sys.exit(1)
js = ('/* Từ điển tiếng Anh — SINH TỰ ĐỘNG từ assets/i18n/en_source.json bằng scripts/i18n_build.py. Không sửa tay. */\n'
      'window.LG_I18N_EN = ' + json.dumps({'dict': d, 'patterns': src.get('patterns', [])}, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(ROOT, 'assets/i18n/en.js'), 'w', encoding='utf-8').write(js)
print(f'en.js: {len(d)} câu, {len(src.get("patterns", []))} mẫu câu, {len(js)//1024} KB')
