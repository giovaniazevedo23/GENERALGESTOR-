# -*- coding: utf-8 -*-

replacements = {
    'Ã£': 'ã',
    'Ã§': 'ç',
    'Ã©': 'é',
    'Ãª': 'ê',
    'Ã³': 'ó',
    'Ã¡': 'á',
    'Ã­': 'í',
    'Ãµ': 'õ',
    'Ãº': 'ú',
    'Ã¢': 'â',
    'Ã‡': 'Ç',
    'Ã‰': 'É',
    'Ã“': 'Ó',
    'Ã€': 'À',
    'Ã': 'í', # sometimes alone
    'Â': '', # sometimes Â appears before nbsp or spaces?
    'â€œ': '"',
    'â€': '"',
    'â€˜': "'",
    'â€™': "'",
    'Âº': 'º',
    'Âª': 'ª',
    'Ã£o': 'ão',
}

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        for k, v in replacements.items():
            content = content.replace(k, v)
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filepath}")
    except Exception as e:
        print(f"Error fixing {filepath}: {e}")

fix_file(r'C:\Users\giova\.gemini\antigravity\scratch\gestor-app\index.html')
fix_file(r'C:\Users\giova\.gemini\antigravity\scratch\gestor-app\js\app.js')
