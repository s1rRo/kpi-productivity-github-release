#!/bin/bash

# Script to add type safety for Express 5 params and query

echo "🔧 Adding Express 5 type safety helpers..."

# Add helper function at the top of problematic files
add_helpers() {
  local file=$1

  # Check if helpers already exist
  if grep -q "getQueryParamAsString" "$file"; then
    echo "  ⏭️  Skipping $file (already has helpers)"
    return
  fi

  # Add import after other imports
  if grep -q "from '../utils/express-helpers'" "$file"; then
    echo "  ⏭️  Skipping $file (already has import)"
    return
  fi

  # Find last import and add our import after it
  awk '
    /^import .* from/ { last_import=NR }
    { lines[NR]=$0 }
    END {
      for(i=1; i<=NR; i++) {
        print lines[i]
        if(i==last_import) {
          print "import { getQueryParam, getQueryParamAsString, getQueryParamAsNumber } from '"'"'../utils/express-helpers'"'"';"
        }
      }
    }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"

  echo "  ✅ Added helpers to $(basename $file)"
}

# List of files that need fixes
files=(
  "src/routes/analytics.ts"
  "src/routes/dailyRecords.ts"
  "src/routes/dashboard.ts"
  "src/routes/eisenhower.ts"
  "src/routes/exceptions.ts"
  "src/routes/friendInvites.ts"
  "src/routes/friends.ts"
  "src/routes/goals.ts"
  "src/routes/habits.ts"
  "src/routes/kpi.ts"
  "src/routes/principles.ts"
  "src/routes/skills.ts"
  "src/routes/teams.ts"
)

cd /Users/sirro/safe-project/backend

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    add_helpers "$file"
  fi
done

echo ""
echo "✅ Express 5 type safety helpers added"
echo ""
echo "⚠️  Manual fixes still needed for:"
echo "   - Replace: const { param } = req.query"
echo "   - With: const param = getQueryParamAsString(req.query.param)"
echo ""
echo "   - Replace: new Date(req.query.date as string)"
echo "   - With: new Date(getQueryParamAsString(req.query.date))"
echo ""
echo "   - Replace: parseInt(req.query.num as string)"
echo "   - With: getQueryParamAsNumber(req.query.num)"
echo ""
