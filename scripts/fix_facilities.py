#!/usr/bin/env python3
import re

# Read the file
with open('data/facilities.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix images: from `images: '/images/placeholder.svg'` to `images: ['/images/placeholder.svg']`
content = re.sub(
    r"images: '([^']+)'",
    r"images: ['\1']",
    content
)

# Add description and created_at, updated_at fields before closing brace
# Find each facility object and add missing fields
content = re.sub(
    r'(images: \[[^\]]+\])\n  \}',
    r'''\1,
    description: '',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }''',
    content
)

# Write back
with open('data/facilities.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("facilities.ts fixed!")
