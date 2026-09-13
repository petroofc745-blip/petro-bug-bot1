import os
import re
from pathlib import Path

root = Path(r'c:\Users\ADITHYAN P B\Downloads\md')
allowed_ext = {'.js', '.json', '.md', '.txt'}

replacements = [
    ('shadowhacr', 'petrohacr'),
    ('shadowofficial786', 'petroofficial786'),
    ('shadowbanproof', 'petrobanproof'),
    ('SHADOWMD', 'PETROMD'),
    ('shadowMD', 'petroMD'),
]

for dirpath, _, filenames in os.walk(root):
    for filename in filenames:
        ext = Path(filename).suffix.lower()
        if ext not in allowed_ext:
            continue
        path = Path(dirpath) / filename
        try:
            text = path.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            continue

        for old, new in replacements:
            text = text.replace(old, new)

        # Replace whole-word brand name by case-preserving style-like variants
        text = re.sub(r'\bSHADOW\b', 'PETRO', text)
        text = re.sub(r'\bShadow\b', 'Petro', text)
        text = re.sub(r'\bshadow\b', 'petro', text)

        # Replace stylized branding phrases and obvious UI labels with Petro-preserving visual styles
        text = text.replace('☠︎︎ 𝑺𝒉𝒂𝒅𝒐𝒘', '☠︎︎ 𝑷𝒆𝒕𝒓𝒐')
        text = text.replace('☠︎︎ 𝑺𝒉𝒂𝒅𝒐𝒘 𝑴𝑫', '☠︎︎ 𝑷𝒆𝒕𝒓𝒐 𝑴𝑫')
        text = text.replace('☠︎︎ 𝑺𝒉𝒂𝒅𝒐𝒘 𝑶𝒇𝒇𝒊𝒄𝒊𝒂𝒍', '☠︎︎ 𝑷𝒆𝒕𝒓𝒐 𝑶𝒇𝒇𝒊𝒄𝒊𝒂𝒍')
        text = text.replace('☠︎︎ 𝑺𝒉𝒂𝒅𝒐𝒘 𝑴𝑫 ☠︎︎', '☠︎︎ 𝑷𝒆𝒕𝒓𝒐 𝑴𝑫 ☠︎︎')

        # Make sure the bot menu strings reflect the new Petro label instead of Shadow.
        text = text.replace('Powered by ☠︎︎ 𝑺𝒉𝒂𝒅𝒐𝒘 𝑴𝑫 ☠︎︎', 'Powered by ☠︎︎ 𝑷𝒆𝒕𝒓𝒐 𝑴𝑫 ☠︎︎')
        text = text.replace('☠︎︎ 𝑺𝒉𝒂𝒅𝒐𝒘 𝑴𝑫 ☠', '☠︎︎ 𝑷𝒆𝒕𝒓𝒐 𝑴𝑫 ☠')

        path.write_text(text, encoding='utf-8')

print('Shadow-to-Petro normalization complete.')
