#!/bin/bash

echo "🔍 Searching and removing Lovable branding..."

# 1. Replace any text occurrences
find . -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.html" \) \
-exec sed -i 's/lovable/Z/gI' {} +

echo "🧹 Replacing logo imports and references..."

# 2. Replace likely logo image paths
find . -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) \
-exec sed -i 's/lovable-logo\.png/z-logo.png/gI' {} +

find . -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) \
-exec sed -i 's/lovable-logo\.svg/z-logo.svg/gI' {} +

echo "📁 Ensuring assets folder exists..."
mkdir -p public

echo "🖼️ Adding placeholder Z logo..."

# 3. Create a simple SVG Z logo
cat > public/z-logo.svg << 'EOF'
<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="120" height="120" rx="20" fill="black"/>
  <text x="50%" y="55%" text-anchor="middle" fill="white" font-size="64" font-family="Arial" dy=".3em">Z</text>
</svg>
EOF

echo "🔗 Updating common logo imports..."

# 4. Replace imports
find . -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) \
-exec sed -i 's|/lovable-logo|/z-logo|g' {} +

echo "✅ Done! Lovable branding replaced with Z logo."