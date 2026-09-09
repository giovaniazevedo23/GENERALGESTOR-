# -*- coding: utf-8 -*-
import sys

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if content.startswith('\ufeff'):
            content = content[1:]
            
        fixed_content = content.encode('windows-1252', errors='replace').decode('utf-8')
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        print(f"Fixed {filepath}")
    except Exception as e:
        print(f"Error fixing {filepath}: {e}")

fix_file(r'C:\Users\giova\.gemini\antigravity\scratch\gestor-app\index.html')
fix_file(r'C:\Users\giova\.gemini\antigravity\scratch\gestor-app\js\app.js')
